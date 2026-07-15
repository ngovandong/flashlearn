import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal, ProgressBar, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { QuickReviseQuestion } from "@flashlearn/core";
import { QuizQuestion } from "@/features/study/QuizQuestion";
import { useQuickReviseWs, type WsMessage } from "@/features/quickRevise/useQuickReviseWs";
import { speakText } from "@/utils/audio";

// Sent to the server when the user picks a wrong option so it can end the game.
// The real answer is a term name, so this sentinel can never accidentally match.
const WRONG_ANSWER = "__flashlearn_wrong__";

export default function QuickReviseScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [question, setQuestion] = useState<QuickReviseQuestion | null>(null);
  const [timer, setTimer] = useState(0);
  const [initialTimer, setInitialTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [index, setIndex] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [gameOver, setGameOver] = useState<{ reason: string; answer?: string; finalScore?: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const handleMessage = (msg: WsMessage) => {
    if (msg.type === "new_question") {
      setQuestion(msg.question as QuickReviseQuestion);
      setTimer(msg.time_limit);
      setInitialTimer(msg.time_limit);
      setIndex(msg.index);
      setDisabled(false);
    } else if (msg.type === "result") {
      if (msg.correct) setScore((s) => s + 1);
    } else if (msg.type === "game_over") {
      setGameOver({ reason: msg.reason, answer: msg.correct_answer, finalScore: msg.final_score });
    } else if (msg.type === "finished") {
      setFinished(true);
      setScore(msg.score);
    }
  };

  const { sendAnswer } = useQuickReviseWs({ deckId: deckId!, onMessage: handleMessage });

  React.useEffect(() => {
    if (timer <= 0 || disabled) return;
    const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timer, disabled]);

  const onAnswer = (correct: boolean) => {
    if (disabled || !question?.answer) return;
    setDisabled(true);
    speakText(question.answer);
    // The server decides win/lose from the answer we send, so a wrong pick must
    // send a non-matching value — otherwise the game could never be lost.
    sendAnswer(correct ? question.answer : WRONG_ANSWER);
  };

  const timerRatio = initialTimer > 0 ? timer / initialTimer : 0;
  const timerColor =
    timer < 3 ? theme.colors.error : timer < 5 ? "#ed6c02" : theme.colors.primary;

  const q = question
    ? {
        type: "QUIZ" as const,
        question: question.question,
        answer: question.answer,
        options: question.options,
        image: question.image,
        progressId: question.progressId,
      }
    : null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.top}>
        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
          🔥 {score}
        </Text>
        <Text variant="titleMedium" style={{ color: timerColor }}>
          ⏱ {timer}s
        </Text>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
          Q{index}
        </Text>
      </View>
      <ProgressBar progress={timerRatio} color={timerColor} style={styles.timerBar} />

      {q ? <QuizQuestion question={q} onAnswer={onAnswer} disabled={disabled} /> : null}

      <Portal>
        <Modal visible={!!gameOver} onDismiss={() => router.back()} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Game over
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            {gameOver?.reason}
          </Text>
          {gameOver?.answer ? (
            <Text style={{ color: theme.colors.onSurface, marginTop: 8 }}>
              Answer: {gameOver.answer}
            </Text>
          ) : null}
          <Text style={{ color: theme.colors.primary, marginTop: 8 }}>
            Final score: {gameOver?.finalScore ?? score}
          </Text>
          <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 16 }}>
            Exit
          </Button>
        </Modal>
        <Modal visible={finished} onDismiss={() => router.back()} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Well done!
          </Text>
          <Text style={{ color: theme.colors.primary, marginTop: 8 }}>
            Score: {score}
          </Text>
          <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 16 }}>
            Done
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  timerBar: { marginHorizontal: 16, height: 8, borderRadius: 4 },
  modal: { margin: 24, padding: 24, borderRadius: 12 },
});
