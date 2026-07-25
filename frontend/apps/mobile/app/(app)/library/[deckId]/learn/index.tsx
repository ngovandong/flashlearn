import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { motion, useTokens } from "@/theme/tokens";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { Term } from "@flashlearn/core";
import { deckApi, learningApi } from "@/api/services";
import { TermCard } from "@/components/TermCard";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { PressableScale } from "@/components/PressableScale";
import { GradientButton } from "@/components/ui/GradientButton";
import { AnimatedBar } from "@/components/ui/AnimatedBar";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { speakText } from "@/utils/audio";

const STAR_GOLD = "#f5a623";

function identityOrder(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function shuffledOrder(n: number): number[] {
  const arr = identityOrder(n);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function LearnScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(1);
  const [pos, setPos] = useState(0);
  const [terms, setTerms] = useState<Term[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [shuffled, setShuffled] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const deckQuery = useQuery({
    queryKey: queryKeys.decks.detail(deckId!),
    queryFn: async () => unwrap(await deckApi.retrieve(deckId!)),
    enabled: !!deckId,
  });

  const termsQuery = useQuery({
    queryKey: queryKeys.learning.terms(deckId!, page),
    queryFn: async () =>
      unwrap<{ results: Term[] }>(await learningApi.getLearningTerms(deckId!, page)),
    enabled: !!deckId,
  });

  useEffect(() => {
    if (!termsQuery.data?.results) return;
    setTerms((prev) => {
      const merged = page === 1 ? termsQuery.data!.results : [...prev, ...termsQuery.data!.results];
      // Extend the visiting order for any newly appended terms.
      setOrder((prevOrder) => {
        if (page === 1) return identityOrder(merged.length);
        const added = merged.slice(prevOrder.length).map((_, i) => prevOrder.length + i);
        return [...prevOrder, ...added];
      });
      return merged;
    });
  }, [termsQuery.data, page]);

  const current = terms[order[pos]];
  const total = (deckQuery.data as { number_of_term?: number })?.number_of_term ?? terms.length;
  const isStarred = current?.id ? starred.has(current.id) : false;

  // Fade + slide the card in whenever the visible term changes.
  const cardAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    cardAnim.setValue(0);
    const a = Animated.timing(cardAnim, {
      toValue: 1,
      duration: motion.duration.normal,
      easing: motion.easing.entrance,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [cardAnim, current?.id]);

  // Gentle pop when the meaning is revealed / hidden.
  const revealAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    revealAnim.setValue(0);
    const a = Animated.spring(revealAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...motion.spring.bouncy,
    });
    a.start();
    return () => a.stop();
  }, [revealAnim, revealed]);

  const loadMoreIfNeeded = useCallback(() => {
    if (pos + 1 >= terms.length && terms.length < total) {
      setPage((p) => p + 1);
    }
  }, [pos, terms.length, total]);

  const goNext = useCallback(() => {
    setRevealed(false);
    loadMoreIfNeeded();
    setPos((p) => (p + 1 < terms.length ? p + 1 : p));
  }, [loadMoreIfNeeded, terms.length]);

  const goBack = useCallback(() => {
    setRevealed(false);
    setPos((p) => (p > 0 ? p - 1 : p));
  }, []);

  const restart = useCallback(() => {
    setRevealed(false);
    setPos(0);
  }, []);

  const toggleShuffle = useCallback(() => {
    setRevealed(false);
    setPos(0);
    setShuffled((wasShuffled) => {
      setOrder(wasShuffled ? identityOrder(terms.length) : shuffledOrder(terms.length));
      return !wasShuffled;
    });
  }, [terms.length]);

  const toggleStar = useCallback(() => {
    if (!current?.id) return;
    setStarred((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(current.id!)) nextSet.delete(current.id!);
      else nextSet.add(current.id!);
      return nextSet;
    });
  }, [current]);

  const mark = useCallback(
    async (remember: boolean) => {
      if (current?.learning_progress_id) {
        if (remember) await learningApi.remember(current.learning_progress_id);
        else await learningApi.incorrect(current.learning_progress_id);
      }
      if (pos + 1 >= terms.length && terms.length >= total) {
        router.back();
        return;
      }
      goNext();
    },
    [current, pos, terms.length, total, goNext, router]
  );

  if (deckQuery.isLoading || (termsQuery.isLoading && terms.length === 0)) return <LoadingView />;
  if (deckQuery.isError) return <ErrorView message="Could not load deck" onRetry={() => deckQuery.refetch()} />;
  if (!current) return <LoadingView message="Loading terms…" />;

  const progress = total ? (pos + 1) / total : 0;
  const atStart = pos === 0;
  const atEnd = pos + 1 >= terms.length && terms.length >= total;

  const CtrlBtn = ({ icon, onPress, disabled, active }: { icon: string; onPress: () => void; disabled?: boolean; active?: boolean }) => (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.ctrl,
        {
          backgroundColor: active ? t.palette.primary : t.neutral.surface2,
          borderRadius: t.radii.pill,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <MaterialIcons name={icon as any} size={22} color={active ? t.palette.onPrimary : t.neutral.text} />
    </PressableScale>
  );

  return (
    <View style={[styles.flex, { backgroundColor: t.neutral.bg }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
          <MaterialIcons name="close" size={22} color={t.neutral.text} />
        </PressableScale>
        <Text variant="labelLarge" style={{ color: t.neutral.textMinor, fontWeight: "700" }}>
          Card {pos + 1} of {total}
          {shuffled ? " · Shuffled" : ""}
        </Text>
        <PressableScale onPress={() => speakText(current.name ?? "")} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.pill }]}>
          <MaterialIcons name="volume-up" size={22} color={t.palette.primary} />
        </PressableScale>
      </View>

      <AnimatedBar progress={progress} color={t.palette.primary} trackColor={t.neutral.surface2} style={styles.progress} />

      <Pressable style={styles.cardWrap} onPress={() => setRevealed((r) => !r)}>
        <Animated.View
          style={{
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
              {
                scale: revealAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                }),
              },
            ],
          }}
        >
          <PressableScale onPress={toggleStar} hitSlop={8} style={styles.star}>
            <MaterialIcons
              name={isStarred ? "star" : "star-outline"}
              size={26}
              color={isStarred ? STAR_GOLD : t.neutral.textMuted}
            />
          </PressableScale>
          {revealed ? (
            <TermCard name={current.name} meaning={current.meaning} image={current.image} />
          ) : (
            <TermCard name={current.name} image={current.image} />
          )}
        </Animated.View>
        <Text variant="labelMedium" style={[styles.hint, { color: t.neutral.textMuted }]}>
          {revealed ? "Tap to hide" : "Tap to reveal meaning"}
        </Text>
      </Pressable>

      <View style={styles.controls}>
        <CtrlBtn icon="restart-alt" onPress={restart} disabled={atStart} />
        <CtrlBtn icon="arrow-back" onPress={goBack} disabled={atStart} />
        <CtrlBtn icon="shuffle" onPress={toggleShuffle} disabled={terms.length < 2} active={shuffled} />
        <CtrlBtn icon="arrow-forward" onPress={goNext} disabled={atEnd} />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 72 }]}>
        <PressableScale onPress={() => mark(false)} style={[styles.stillBtn, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}>
          <Text style={{ color: t.neutral.text, fontWeight: "800", fontSize: 15 }}>Still learning</Text>
        </PressableScale>
        <GradientButton label="Got it" icon="check" onPress={() => mark(true)} style={styles.gotBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progress: { marginHorizontal: 16 },
  cardWrap: { flex: 1, padding: 16, justifyContent: "center" },
  star: { position: "absolute", top: 8, right: 8, zIndex: 2 },
  hint: { textAlign: "center", marginTop: 16 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 4 },
  ctrl: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 12, padding: 16, alignItems: "center" },
  stillBtn: { flex: 1, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  gotBtn: { flex: 1 },
});
