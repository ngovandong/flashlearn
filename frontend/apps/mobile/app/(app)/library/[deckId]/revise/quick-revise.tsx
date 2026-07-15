import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Modal, Portal, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { QuickReviseQuestion } from "@flashlearn/core";
import { QuizQuestion } from "@/features/study/QuizQuestion";
import { useQuickReviseWs, type WsMessage } from "@/features/quickRevise/useQuickReviseWs";
import { GradientButton } from "@/components/ui/GradientButton";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { speakText } from "@/utils/audio";
import { useTokens } from "@/theme/tokens";

// Sent to the server when the user picks a wrong option so it can end the game.
// The real answer is a term name, so this sentinel can never accidentally match.
const WRONG_ANSWER = "__flashlearn_wrong__";

export default function QuickReviseScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
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
    const id = setInterval(() => setTimer((tm) => Math.max(0, tm - 1)), 1000);
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
  const timerColor = timer < 3 ? "#ef4444" : timer < 5 ? "#f59e0b" : t.palette.primary;

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

  const Stat = ({ icon, value, color }: { icon: string; value: string; color: string }) => (
    <View style={[styles.stat, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={{ color, fontWeight: "800" }}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.top}>
        <Stat icon="local-fire-department" value={String(score)} color="#f97316" />
        <Stat icon="timer" value={`${timer}s`} color={timerColor} />
        <Stat icon="tag" value={`Q${index}`} color={t.neutral.textMinor} />
      </View>
      <AnimatedBar progress={timerRatio} color={timerColor} trackColor={t.neutral.surface2} height={8} style={styles.timerBar} />

      {q ? <QuizQuestion question={q} onAnswer={onAnswer} disabled={disabled} /> : null}

      <Portal>
        <Modal visible={!!gameOver} onDismiss={() => router.back()} contentContainerStyle={[styles.modal, { backgroundColor: t.neutral.surface, borderRadius: t.radii.xl }]}>
          <View style={[styles.modalIcon, { backgroundColor: t.alpha("#ef4444", 0.14), borderRadius: t.radii.pill }]}>
            <MaterialIcons name="sports-esports" size={30} color="#ef4444" />
          </View>
          <Text variant="titleLarge" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 12 }}>
            Game over
          </Text>
          <Text style={{ color: t.neutral.textMinor, marginTop: 8, textAlign: "center" }}>
            {gameOver?.reason}
          </Text>
          {gameOver?.answer ? (
            <Text style={{ color: t.neutral.text, marginTop: 8 }}>Answer: {gameOver.answer}</Text>
          ) : null}
          <Text style={{ color: t.palette.primary, marginTop: 8, fontWeight: "800" }}>
            Final score: {gameOver?.finalScore ?? score}
          </Text>
          <GradientButton label="Exit" onPress={() => router.back()} style={styles.modalBtn} />
        </Modal>

        <Modal visible={finished} onDismiss={() => router.back()} contentContainerStyle={[styles.modal, { backgroundColor: t.neutral.surface, borderRadius: t.radii.xl }]}>
          <View style={[styles.modalIcon, { backgroundColor: t.alpha("#10b981", 0.14), borderRadius: t.radii.pill }]}>
            <MaterialIcons name="emoji-events" size={30} color="#10b981" />
          </View>
          <Text variant="titleLarge" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 12 }}>
            Well done!
          </Text>
          <Text style={{ color: t.palette.primary, marginTop: 8, fontWeight: "800" }}>Score: {score}</Text>
          <GradientButton label="Done" onPress={() => router.back()} style={styles.modalBtn} />
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  stat: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  timerBar: { marginHorizontal: 16 },
  modal: { margin: 24, padding: 24, alignItems: "center" },
  modalIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  modalBtn: { marginTop: 20, alignSelf: "stretch" },
});
