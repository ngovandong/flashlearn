import asyncio
import json
import logging
import random
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken, TokenError

from backend.models import Deck
from backend.serializers import ReviseTermSerializer
from backend.services import LearningService, TermService, learning_progress_cache

logger = logging.getLogger(__name__)

User = get_user_model()


class QuickReviseConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query_string = self.scope["query_string"].decode()
        params = parse_qs(query_string)
        token = params.get("token", [None])[0]
        deck_id = params.get("deck_id", [None])[0]

        if not token or not deck_id:
            await self.close()
            return

        user, deck = await self.get_user_and_deck(token, deck_id)
        if not user or not deck:
            await self.close()
            return

        self.scope["user"] = user  # Keep this for consistency with other methods expecting self.scope['user']
        self.user = user  # Also store in self.user for convenience
        self.deck_id = deck_id
        await self.accept()

        # Initialize game state
        self.game_state = {
            "score": 0,
            "current_index": 0,
            "queue": [],
            "timer_task": None,
            "game_over": False,
            "question_start_time": 0,
            "leftover_time": 0,
        }
        # Lock to prevent concurrent start_game() calls
        self.game_lock = asyncio.Lock()

    @database_sync_to_async
    def get_user_and_deck(self, token, deck_id):
        try:
            access_token = AccessToken(token)
            user_id = access_token["user_id"]
            user = User.objects.get(id=user_id)
            deck = Deck.objects.get(id=deck_id)
            if deck.user_can_view_deck(user):
                return user, deck
        except (TokenError, User.DoesNotExist):
            return None, None

    @database_sync_to_async
    def save_learning_progress(self, term_id):
        LearningService.record_quick_revise_answer(self.user, term_id)

    @database_sync_to_async
    def get_revise_terms(self):
        data = TermService.get_revise_terms(self.user, self.deck_id)
        serializer = ReviseTermSerializer(data)
        # We need to serialize it to get the data dict
        # ReviseTermSerializer is a serializer, so we should access .data
        # data is a dict {'deck_name':..., 'all_terms':..., 'revise_terms':...}
        # The serializer expects this structure.
        return serializer.to_representation(data)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")

            if action == "start":
                await self.start_game()
            elif action == "answer":
                await self.handle_answer(data.get("answer"))

        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received: {text_data}")
            pass
        except Exception as e:
            logger.error(f"Error in receive handler: {e}", exc_info=True)
            try:
                await self.send(text_data=json.dumps({"type": "error", "message": "Server error"}))
            except Exception:
                pass  # Connection might be closed

    async def start_game(self):
        # Use lock to prevent concurrent start_game() calls
        async with self.game_lock:
            try:
                self.revise_terms = []
                self.all_terms = []
                self.game_state["current_index"] = 0
                await self.send_next_question(is_first=True)
            except Exception as e:
                logger.error(f"Error starting game: {e}", exc_info=True)
                # Cleanup on error
                self._cleanup_game_memory()
                try:
                    await self.send(text_data=json.dumps({"type": "error", "message": "Failed to start game"}))
                except Exception:
                    pass

    async def send_next_question(self, is_first=False):
        try:
            # Infinite Mode: No queue limit check. Game ends only on timeout/wrong answer.
            index = self.game_state["current_index"]

            # In infinite mode, we pick a random term from all_terms
            if not self.revise_terms:
                data = await self.get_revise_terms()
                self.revise_terms = data.get("revise_terms", [])
                self.all_terms = data.get("all_terms", [])
                if not self.revise_terms:
                    # Should not happen given previous fallback, but safety first
                    await self.close()
                    return

            # Pop first term in revise_terms
            current_term = self.revise_terms.pop(0)

            # Filter out the current term from all_terms
            distractors = [t for t in self.all_terms if t["id"] != current_term["id"]]

            # Pick 3 random distractors
            if len(distractors) < 3:
                # If not enough terms, just duplicate or handle gracefully
                selected_distractors = distractors
            else:
                random.shuffle(distractors)
                selected_distractors = distractors[:3]

            questions_options = [current_term["name"]] + [d["name"] for d in selected_distractors]
            random.shuffle(questions_options)

            question_payload = {
                "progressId": current_term.get("learning_progress_id"),
                "question": current_term["description"],
                "answer": current_term["name"],
                "image": current_term.get("image"),
                "options": questions_options,
                "type": "quiz",
            }

            # Time Calculation
            # Rule: 10s first, then 8s, 6s... + leftover
            # Since index grows indefinitely, we clamp the minimum base time.
            # 10 - (0*2) = 10
            # 10 - (1*2) = 8
            # ...
            # 10 - (4*2) = 2
            # 10 - (5*2) = 0 -> clamped to 2.
            base_time = max(2, 10 - (index * 2))
            leftover = self.game_state.get("leftover_time", 0)
            time_limit = base_time + leftover

            # Save the current_term to queue/history if needed, or just update game_state for handle_answer
            # We need to know the 'correct answer' for handle_answer.
            # Strategy: Store current_term in game_state explicitly.
            self.game_state["current_question_term"] = current_term

            await self.send(
                text_data=json.dumps(
                    {
                        "type": "new_question",
                        "question": question_payload,
                        "time_limit": time_limit,
                        "index": index + 1,
                        # "total": ... - No total in infinite mode
                    }
                )
            )

            # Record start time for calculating leftover later
            self.game_state["question_start_time"] = asyncio.get_event_loop().time()

            # Start timer (cancel previous if exists)
            if self.game_state["timer_task"]:
                try:
                    self.game_state["timer_task"].cancel()
                except Exception as e:
                    logger.warning(f"Error cancelling previous timer: {e}")

            self.game_state["timer_task"] = asyncio.create_task(self.game_timer(time_limit))
        except Exception as e:
            logger.error(f"Error in send_next_question: {e}", exc_info=True)
            self._cleanup_game_memory()
            try:
                await self.send(text_data=json.dumps({"type": "error", "message": "Failed to send question"}))
            except Exception:
                pass

    async def game_timer(self, duration):
        try:
            await asyncio.sleep(duration)
            # Timeout - check if connection is still open
            try:
                await self.send(text_data=json.dumps({"type": "game_over", "reason": "timeout"}))
            except Exception as e:
                logger.debug(f"Could not send timeout message (connection closed?): {e}")
            # Do not close connection to allow replay
            # await self.close()
        except asyncio.CancelledError:
            pass  # Timer was cancelled, normal operation
        except Exception as e:
            logger.error(f"Unexpected error in game_timer: {e}", exc_info=True)

    async def handle_answer(self, user_answer):
        try:
            # Cancel timer immediately
            if self.game_state["timer_task"]:
                try:
                    self.game_state["timer_task"].cancel()
                except Exception as e:
                    logger.warning(f"Error cancelling timer in handle_answer: {e}")

            # Calculate leftover time
            now = asyncio.get_event_loop().time()
            start_time = self.game_state.get("question_start_time", now)
            elapsed = now - start_time

            index = self.game_state["current_index"]
            base_time = max(2, 10 - (index * 2))
            start_leftover = self.game_state.get("leftover_time", 0)
            if start_leftover:
                start_leftover = start_leftover / 2
            current_limit = base_time + start_leftover

            actual_leftover = max(0, current_limit - elapsed)
            self.game_state["leftover_time"] = actual_leftover

            # Get term from state (set in send_next_question)
            current_term = self.game_state.get("current_question_term")

            if not current_term:
                # Should not happen, but robust handling
                await self.close()
                return

            correct_answer = current_term["name"]

            if user_answer.strip().lower() == correct_answer.lower():
                await self.save_learning_progress(current_term["id"])
                self.game_state["score"] += 1
                await self.send(text_data=json.dumps({"type": "result", "correct": True}))
                self.game_state["current_index"] += 1
                await asyncio.sleep(0.5)
                await self.send_next_question(is_first=False)
            else:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "game_over",
                            "reason": "wrong_answer",
                            "correct_answer": correct_answer,
                            "final_score": self.game_state["score"],
                        }
                    )
                )
                # Do not close connection to allow replay
                # await self.close()
        except Exception as e:
            logger.error(f"Error handling answer: {e}", exc_info=True)
            self._cleanup_game_memory()
            try:
                await self.send(text_data=json.dumps({"type": "error", "message": "Error processing answer"}))
            except Exception:
                pass

    async def disconnect(self, code):
        """Cleanup when connection closes - MUST NOT fail"""
        # Cancel timer with proper error handling
        try:
            if hasattr(self, "game_state") and self.game_state.get("timer_task"):
                timer_task = self.game_state.get("timer_task")
                if timer_task and not timer_task.done():
                    timer_task.cancel()
        except Exception as e:
            logger.error(f"Error cancelling timer in disconnect: {e}")

        # Clear game memory
        try:
            self._cleanup_game_memory()
        except Exception as e:
            logger.error(f"Error cleaning up game memory in disconnect: {e}")

        # Clear cache - CRITICAL, must succeed
        try:
            if hasattr(self, "user") and hasattr(self, "deck_id") and self.user and self.deck_id:
                learning_progress_cache.delete_combine(self.deck_id, self.user.id)
        except Exception as e:
            logger.error(f"Error deleting cache in disconnect: {e}")

        logger.info(
            f"User {getattr(self, 'user', 'unknown')} disconnected from deck {getattr(self, 'deck_id', 'unknown')}"
        )

    def _cleanup_game_memory(self):
        """Clear large data structures to prevent memory leaks"""
        try:
            if hasattr(self, "revise_terms"):
                self.revise_terms = []
            if hasattr(self, "all_terms"):
                self.all_terms = []
            if hasattr(self, "game_state"):
                if self.game_state.get("current_question_term"):
                    self.game_state["current_question_term"] = None
        except Exception as e:
            logger.warning(f"Error in _cleanup_game_memory: {e}")
