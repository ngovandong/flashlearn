import asyncio
import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from backend.deck.domain.access import DeckAccessPolicy
from backend.learning.application.quick_revise_game import QuickReviseGame
from backend.models import Deck
from backend.serializers import ReviseTermSerializer
from backend.services import learning_progress_cache, learning_service, term_service

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

        self.scope["user"] = user
        self.user = user
        self.deck_id = deck_id
        await self.accept()

        self.game_state = {
            "score": 0,
            "current_index": 0,
            "queue": [],
            "timer_task": None,
            "game_over": False,
            "question_start_time": 0,
            "leftover_time": 0,
        }
        self.game_lock = asyncio.Lock()

    @database_sync_to_async
    def get_user_and_deck(self, token, deck_id):
        try:
            access_token = AccessToken(token)
            user_id = access_token["user_id"]
            user = User.objects.get(id=user_id)
            deck = Deck.objects.get(id=deck_id)
            if DeckAccessPolicy.can_view(deck, user):
                return user, deck
            return None, None
        except (TokenError, User.DoesNotExist, Deck.DoesNotExist, ValidationError):
            return None, None

    @database_sync_to_async
    def save_learning_progress(self, term_id):
        learning_service.record_quick_revise_answer(self.user, term_id)

    @database_sync_to_async
    def get_revise_terms(self):
        data = term_service.get_revise_terms(self.user, self.deck_id)
        serializer = ReviseTermSerializer(data)
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
        except Exception as e:
            logger.error(f"Error in receive handler: {e}", exc_info=True)
            try:
                await self.send(
                    text_data=json.dumps({"type": "error", "message": "Something went wrong. Please try again."})
                )
            except Exception:
                pass

    async def start_game(self):
        async with self.game_lock:
            try:
                self.revise_terms = []
                self.all_terms = []
                self.game_state["current_index"] = 0
                await self.send_next_question(is_first=True)
            except Exception as e:
                logger.error(f"Error starting game: {e}", exc_info=True)
                self._cleanup_game_memory()
                try:
                    await self.send(text_data=json.dumps({"type": "error", "message": "Failed to start game"}))
                except Exception:
                    pass

    async def send_next_question(self, is_first=False):
        try:
            index = self.game_state["current_index"]

            if not self.revise_terms:
                data = await self.get_revise_terms()
                self.revise_terms = data.get("revise_terms", [])
                self.all_terms = data.get("all_terms", [])
                if not self.revise_terms:
                    await self.close()
                    return

            current_term = self.revise_terms.pop(0)
            question_payload = QuickReviseGame.build_question(current_term, self.all_terms)
            time_limit = QuickReviseGame.calculate_time_limit(index, self.game_state.get("leftover_time", 0))

            self.game_state["current_question_term"] = current_term

            await self.send(
                text_data=json.dumps(
                    {
                        "type": "new_question",
                        "question": question_payload,
                        "time_limit": time_limit,
                        "index": index + 1,
                    }
                )
            )

            self.game_state["question_start_time"] = asyncio.get_event_loop().time()

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
            try:
                await self.send(text_data=json.dumps({"type": "game_over", "reason": "timeout"}))
            except Exception as e:
                logger.debug(f"Could not send timeout message (connection closed?): {e}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Unexpected error in game_timer: {e}", exc_info=True)

    async def handle_answer(self, user_answer):
        try:
            if self.game_state["timer_task"]:
                try:
                    self.game_state["timer_task"].cancel()
                except Exception as e:
                    logger.warning(f"Error cancelling timer in handle_answer: {e}")

            now = asyncio.get_event_loop().time()
            start_time = self.game_state.get("question_start_time", now)
            elapsed = now - start_time
            index = self.game_state["current_index"]
            self.game_state["leftover_time"] = QuickReviseGame.calculate_leftover(
                elapsed, index, self.game_state.get("leftover_time", 0)
            )

            current_term = self.game_state.get("current_question_term")
            if not current_term:
                await self.close()
                return

            correct_answer = current_term["name"]

            if QuickReviseGame.is_correct(user_answer, correct_answer):
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
        except Exception as e:
            logger.error(f"Error handling answer: {e}", exc_info=True)
            self._cleanup_game_memory()
            try:
                await self.send(text_data=json.dumps({"type": "error", "message": "Error processing answer"}))
            except Exception:
                pass

    async def disconnect(self, code):
        try:
            if hasattr(self, "game_state") and self.game_state.get("timer_task"):
                timer_task = self.game_state.get("timer_task")
                if timer_task and not timer_task.done():
                    timer_task.cancel()
        except Exception as e:
            logger.error(f"Error cancelling timer in disconnect: {e}")

        try:
            self._cleanup_game_memory()
        except Exception as e:
            logger.error(f"Error cleaning up game memory in disconnect: {e}")

        try:
            if hasattr(self, "user") and hasattr(self, "deck_id") and self.user and self.deck_id:
                learning_progress_cache.delete_combine(self.deck_id, self.user.id)
        except Exception as e:
            logger.error(f"Error deleting cache in disconnect: {e}")

        logger.info(
            f"User {getattr(self, 'user', 'unknown')} disconnected from deck {getattr(self, 'deck_id', 'unknown')}"
        )

    def _cleanup_game_memory(self):
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
