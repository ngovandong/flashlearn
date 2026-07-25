import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { GrammarExercise, Highlight } from "@flashlearn/core";
import { grammarApi } from "@/api/services";
import { ErrorView } from "@/components/ErrorView";
import { LoadingView } from "@/components/LoadingView";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { PressableScale } from "@/components/PressableScale";
import { AppCard } from "@/components/ui/AppCard";
import { FeatureTile } from "@/components/ui/FeatureTile";
import { GradientButton } from "@/components/ui/GradientButton";
import { queryKeys } from "@/query/keys";
import { unwrap } from "@/utils/apiError";
import { useTokens, type Tokens } from "@/theme/tokens";

const GREEN = "#10b981";
const RED = "#ef4444";

interface ExplanationBlock {
  label?: string;
  html?: string;
  examples?: string[];
}

interface ExerciseItem {
  text?: string;
  blanks?: number;
  options?: string[];
  tokens?: string[];
}

interface ItemResult {
  blanks?: boolean[];
  correct?: boolean;
  answers?: string[];
  given?: string[];
}

interface GradeResult {
  score?: number;
  completed?: boolean;
  results?: ItemResult[];
}

interface UnitDetail {
  title?: string;
  explanation?: ExplanationBlock[];
  exercises: GrammarExercise[];
  progress?: { highlights?: Highlight[] };
}

// The explanation blocks carry light HTML (`<b>` etc.). React Native has no HTML
// renderer, so flatten to plain text for display and for the highlight helper.
function stripHtml(html?: string): string {
  return (html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tappable option / token chip with result-aware coloring. */
function TapChip({
  label,
  onPress,
  disabled,
  tone = "default",
  t,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "default" | "selected" | "correct" | "wrong";
  t: Tokens;
}) {
  const map = {
    default: { bg: t.neutral.surface2, fg: t.neutral.text },
    selected: { bg: t.palette.primary, fg: t.palette.onPrimary },
    correct: { bg: t.alpha(GREEN, 0.16), fg: GREEN },
    wrong: { bg: t.alpha(RED, 0.16), fg: RED },
  }[tone];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, { backgroundColor: map.bg, borderRadius: t.radii.pill }]}
    >
      <Text style={{ color: map.fg, fontWeight: "700" }}>{label}</Text>
    </PressableScale>
  );
}

export default function GrammarUnitScreen() {
  const { unitKey } = useLocalSearchParams<{ unitKey: string }>();
  const t = useTokens();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.grammar.unit(unitKey!),
    queryFn: async () => unwrap<UnitDetail>(await grammarApi.getUnit(unitKey!)),
    enabled: !!unitKey,
  });

  React.useEffect(() => {
    if (data?.progress?.highlights) setHighlights(data.progress.highlights);
  }, [data?.progress?.highlights]);

  const highlightMutation = useMutation({
    mutationFn: async (payload: { text: string; note?: string; remove?: boolean }) => {
      const res = await grammarApi.setHighlight(unitKey!, payload);
      return unwrap<{ highlights: Highlight[] }>(res);
    },
    onSuccess: (res) => setHighlights(res.highlights ?? []),
  });

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView message="Could not load unit" onRetry={() => refetch()} />;

  const exercises = data?.exercises ?? [];
  const blocks = data?.explanation ?? [];
  const plainExplanation = blocks
    .map((b) => [stripHtml(b.html), ...(b.examples ?? [])].filter(Boolean).join(" "))
    .join(" ")
    .trim();

  const saveHighlight = () => {
    if (!selectedWord) return;
    highlightMutation.mutate({ text: selectedWord, note: noteDraft });
    setSelectedWord(null);
    setNoteDraft("");
  };

  return (
    <ScrollView style={{ backgroundColor: t.neutral.bg }} contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <FadeSlideIn>
        <View style={styles.brandRow}>
          <FeatureTile icon="spellcheck" size={46} variant="solid" />
          <Text variant="headlineSmall" style={{ color: t.neutral.text, fontWeight: "800", flex: 1 }}>
            {data?.title}
          </Text>
        </View>
      </FadeSlideIn>

      {blocks.length > 0 ? (
        <FadeSlideIn delay={50} style={{ marginTop: 16 }}>
          <AppCard>
            <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800" }}>
              Grammar
            </Text>
            {blocks.map((block, i) => {
              const body = stripHtml(block.html);
              return (
                <View key={i} style={{ marginTop: i === 0 ? 10 : 14 }}>
                  {block.label ? (
                    <Text variant="labelLarge" style={{ color: t.palette.primary, fontWeight: "800" }}>
                      {block.label}
                    </Text>
                  ) : null}
                  {body ? (
                    <Text variant="bodyMedium" style={{ color: t.neutral.textMinor, marginTop: 2, lineHeight: 21 }}>
                      {body}
                    </Text>
                  ) : null}
                  {(block.examples ?? []).map((ex, k) => (
                    <Text key={k} style={{ color: t.neutral.text, marginTop: 4, marginLeft: 8 }}>
                      • {ex}
                    </Text>
                  ))}
                </View>
              );
            })}
          </AppCard>
        </FadeSlideIn>
      ) : null}

      {highlights.length > 0 ? (
        <View style={styles.chips}>
          {highlights.map((h) => (
            <PressableScale
              key={h.text}
              onPress={() => { setSelectedWord(h.text); setNoteDraft(h.note ?? ""); }}
              style={[styles.wordChip, { backgroundColor: t.feature("spellcheck").tint, borderRadius: t.radii.pill }]}
            >
              <Text style={{ color: t.feature("spellcheck").fg, fontWeight: "700", fontSize: 13 }}>{h.text}</Text>
              <MaterialIcons
                name="close"
                size={15}
                color={t.feature("spellcheck").fg}
                onPress={() => highlightMutation.mutate({ text: h.text, remove: true })}
              />
            </PressableScale>
          ))}
        </View>
      ) : null}

      {exercises.length > 0 ? (
        <Text variant="titleMedium" style={{ color: t.neutral.text, fontWeight: "800", marginTop: 22 }}>
          Practice
        </Text>
      ) : null}

      {exercises.map((exercise, i) => (
        <FadeSlideIn key={exercise.key} delay={40 + i * 30} style={{ marginTop: 12 }}>
          <ExerciseCard exercise={exercise} unitTitle={data?.title ?? ""} />
        </FadeSlideIn>
      ))}

      {plainExplanation ? (
        <PressableScale
          onPress={() => {
            const word = plainExplanation.split(/\s+/).find((w) => w.replace(/[^\w'-]/g, "").length > 4) ?? "";
            const clean = word.replace(/[^\w'-]/g, "");
            if (clean) {
              setSelectedWord(clean);
              setNoteDraft("");
            }
          }}
          hitSlop={8}
          style={{ alignSelf: "center", marginTop: 16 }}
        >
          <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Highlight a word from the explanation</Text>
        </PressableScale>
      ) : null}

      {selectedWord ? (
        <AppCard style={{ marginTop: 14 }}>
          <Text variant="labelLarge" style={{ color: t.neutral.text, fontWeight: "700" }}>
            Highlight “{selectedWord}”
          </Text>
          <TextInput mode="outlined" value={noteDraft} onChangeText={setNoteDraft} multiline outlineStyle={{ borderRadius: t.radii.md }} style={[styles.input, { marginTop: 8 }]} />
          <GradientButton label="Save" onPress={saveHighlight} loading={highlightMutation.isPending} style={{ marginTop: 10 }} />
        </AppCard>
      ) : null}
    </ScrollView>
  );
}

interface ReorderState {
  bank: string[];
  line: string[];
}

// One interactive, server-graded exercise. Mirrors the web `Exercise` component:
// answers are graded on the server, which returns the correct answers so we can
// reveal them per blank after a submission.
function ExerciseCard({ exercise, unitTitle }: { exercise: GrammarExercise; unitTitle: string }) {
  const t = useTokens();
  const kind = exercise.kind ?? "fill_blank";
  const items = (exercise.items ?? []) as ExerciseItem[];
  const exerciseOptions = exercise.options ?? [];

  const initGiven = () =>
    items.map((item) => (kind === "fill_blank" ? Array(item.blanks || 1).fill("") : [""]));
  const initOrder = (): ReorderState[] =>
    items.map((item) => ({ bank: [...(item.tokens ?? [])], line: [] }));

  const [given, setGiven] = useState<string[][]>(initGiven);
  const [order, setOrder] = useState<ReorderState[]>(initOrder);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [explain, setExplain] = useState<Record<number, { answer?: string; examples?: string[]; tip?: string } | { error: string } | { loading: true }>>({});

  const submitMutation = useMutation({
    mutationFn: async () => {
      const submissions = items.map((_, i) => {
        if (kind === "reorder") return [order[i]?.line.join(" ") ?? ""];
        return given[i] ?? [""];
      });
      return unwrap<GradeResult>(await grammarApi.submitExercise(exercise.key, submissions));
    },
    onSuccess: (res) => setResult(res),
  });

  const explainMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) =>
      unwrap<{ answer?: string; examples?: string[]; tip?: string }>(await grammarApi.explain(payload)),
  });

  const setBlank = (itemIndex: number, blankIndex: number, value: string) => {
    setGiven((prev) => {
      const next = prev.map((row) => [...row]);
      next[itemIndex][blankIndex] = value;
      return next;
    });
  };

  const moveToLine = (itemIndex: number, tokenIndex: number) => {
    setOrder((prev) => {
      const next = prev.map((o) => ({ bank: [...o.bank], line: [...o.line] }));
      const [tok] = next[itemIndex].bank.splice(tokenIndex, 1);
      next[itemIndex].line.push(tok);
      return next;
    });
  };

  const moveToBank = (itemIndex: number, tokenIndex: number) => {
    setOrder((prev) => {
      const next = prev.map((o) => ({ bank: [...o.bank], line: [...o.line] }));
      const [tok] = next[itemIndex].line.splice(tokenIndex, 1);
      next[itemIndex].bank.push(tok);
      return next;
    });
  };

  const reset = () => {
    setGiven(initGiven());
    setOrder(initOrder());
    setResult(null);
    setExplain({});
  };

  const askExplain = async (itemIndex: number) => {
    const item = items[itemIndex];
    const r = result?.results?.[itemIndex];
    const sentence = kind === "reorder" ? (r?.answers ?? []).join(" ") : item.text ?? "";
    setExplain((prev) => ({ ...prev, [itemIndex]: { loading: true } }));
    try {
      const data = await explainMutation.mutateAsync({
        unit_title: unitTitle,
        sentence,
        given: (r?.given ?? []).join(" "),
        correct: (r?.answers ?? []).join(" "),
      });
      setExplain((prev) => ({ ...prev, [itemIndex]: data }));
    } catch {
      setExplain((prev) => ({ ...prev, [itemIndex]: { error: "Dragon couldn't explain right now." } }));
    }
  };

  const itemResult = (i: number) => (result ? result.results?.[i] : undefined);

  return (
    <AppCard>
      {exercise.prompt ? (
        <Text variant="titleSmall" style={{ color: t.neutral.text, fontWeight: "700" }}>
          {exercise.prompt}
        </Text>
      ) : null}

      {items.map((item, i) => {
        const r = itemResult(i);
        return (
          <View key={i} style={{ marginTop: 14 }}>
            <ExerciseItemView
              kind={kind}
              item={item}
              exerciseOptions={exerciseOptions}
              given={given[i] ?? [""]}
              order={order[i]}
              result={r}
              onBlank={(bi, v) => setBlank(i, bi, v)}
              onSelect={(v) => setBlank(i, 0, v)}
              onMoveToLine={(ti) => moveToLine(i, ti)}
              onMoveToBank={(ti) => moveToBank(i, ti)}
            />
            {r && !r.correct ? (
              <>
                {(r.answers ?? []).length > 0 ? (
                  <Text style={{ color: RED, marginTop: 6, fontWeight: "600" }}>
                    Answer: {(r.answers ?? []).join(", ")}
                  </Text>
                ) : null}
                <PressableScale onPress={() => askExplain(i)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                  <Text style={{ color: t.palette.primary, fontWeight: "700" }}>
                    {"loading" in (explain[i] ?? {}) ? "Asking…" : "Why?"}
                  </Text>
                </PressableScale>
                {explain[i] && "answer" in explain[i] ? (
                  <View style={[styles.explain, { backgroundColor: t.neutral.surface2, borderRadius: t.radii.md }]}>
                    {explain[i].answer ? (
                      <Text style={{ color: t.neutral.text }}>{explain[i].answer}</Text>
                    ) : null}
                    {(explain[i].examples ?? []).map((ex, k) => (
                      <Text key={k} style={{ color: t.neutral.textMinor, marginTop: 4 }}>
                        • {ex}
                      </Text>
                    ))}
                    {explain[i].tip ? (
                      <Text style={{ color: t.neutral.textMinor, marginTop: 8 }}>💡 {explain[i].tip}</Text>
                    ) : null}
                  </View>
                ) : null}
                {explain[i] && "error" in explain[i] ? (
                  <Text style={{ color: RED, marginTop: 4 }}>{explain[i].error}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      {result ? (
        <View style={{ marginTop: 14 }}>
          <View style={styles.scoreRow}>
            <MaterialIcons
              name={result.completed ? "check-circle" : "cancel"}
              size={20}
              color={result.completed ? GREEN : RED}
            />
            <Text style={{ color: result.completed ? GREEN : RED, fontWeight: "800" }}>
              Score: {result.score}%
            </Text>
          </View>
          <PressableScale onPress={reset} style={[styles.tryAgain, { borderColor: t.neutral.border, borderRadius: t.radii.pill }]}>
            <MaterialIcons name="refresh" size={18} color={t.palette.primary} />
            <Text style={{ color: t.palette.primary, fontWeight: "700" }}>Try again</Text>
          </PressableScale>
        </View>
      ) : (
        <GradientButton
          label="Check answers"
          onPress={() => submitMutation.mutate()}
          loading={submitMutation.isPending}
          style={{ marginTop: 14 }}
        />
      )}
    </AppCard>
  );
}

interface ItemViewProps {
  kind: string;
  item: ExerciseItem;
  exerciseOptions: string[];
  given: string[];
  order?: ReorderState;
  result?: ItemResult;
  onBlank: (blankIndex: number, value: string) => void;
  onSelect: (value: string) => void;
  onMoveToLine: (tokenIndex: number) => void;
  onMoveToBank: (tokenIndex: number) => void;
}

function ExerciseItemView(props: ItemViewProps) {
  const { kind } = props;
  if (kind === "choose" || kind === "match") return <ChooseItem {...props} />;
  if (kind === "reorder") return <ReorderItem {...props} />;
  if (kind === "fill_blank") return <FillBlankItem {...props} />;
  return <RewriteItem {...props} />;
}

function FillBlankItem({ item, given, result, onBlank }: ItemViewProps) {
  const t = useTokens();
  const count = Math.max(item.blanks || 0, given.length, 1);
  const display = (item.text || "").replace(/___/g, "____");
  const disabled = !!result;
  return (
    <View>
      {display ? (
        <Text variant="bodyMedium" style={{ color: t.neutral.text, lineHeight: 22 }}>
          {display}
        </Text>
      ) : null}
      {Array.from({ length: count }).map((_, idx) => {
        const ok = result?.blanks?.[idx];
        const borderColor = result ? (ok ? GREEN : RED) : t.neutral.border;
        return (
          <TextInput
            key={idx}
            mode="outlined"
            dense
            label={count > 1 ? `Blank ${idx + 1}` : "Your answer"}
            value={given[idx] ?? ""}
            onChangeText={(v) => onBlank(idx, v)}
            disabled={disabled}
            outlineColor={borderColor}
            autoCapitalize="none"
            outlineStyle={{ borderRadius: t.radii.md }}
            style={[styles.input, { marginTop: 8 }]}
          />
        );
      })}
    </View>
  );
}

function RewriteItem({ item, given, result, onSelect }: ItemViewProps) {
  const t = useTokens();
  const ok = result?.correct;
  const borderColor = result ? (ok ? GREEN : RED) : t.neutral.border;
  return (
    <View>
      {item.text ? (
        <Text variant="bodyMedium" style={{ color: t.neutral.text, lineHeight: 22 }}>
          {item.text}
        </Text>
      ) : null}
      <TextInput
        mode="outlined"
        dense
        label="Your answer"
        value={given[0] ?? ""}
        onChangeText={onSelect}
        disabled={!!result}
        outlineColor={borderColor}
        autoCapitalize="none"
        outlineStyle={{ borderRadius: t.radii.md }}
        style={[styles.input, { marginTop: 8 }]}
      />
    </View>
  );
}

function ChooseItem({ item, exerciseOptions, given, result, onSelect }: ItemViewProps) {
  const t = useTokens();
  const opts = item.options && item.options.length ? item.options : exerciseOptions;
  const value = given[0] ?? "";
  return (
    <View>
      {item.text ? (
        <Text variant="bodyMedium" style={{ color: t.neutral.text, lineHeight: 22 }}>
          {item.text}
        </Text>
      ) : null}
      <View style={styles.optionRow}>
        {opts.map((opt) => {
          let tone: "default" | "selected" | "correct" | "wrong" = value === opt ? "selected" : "default";
          if (result) {
            if (opt === result.answers?.[0]) tone = "correct";
            else if (opt === value) tone = "wrong";
            else tone = "default";
          }
          return (
            <TapChip key={opt} label={opt} tone={tone} disabled={!!result} onPress={() => onSelect(opt)} t={t} />
          );
        })}
      </View>
    </View>
  );
}

function ReorderItem({ order, result, onMoveToLine, onMoveToBank }: ItemViewProps) {
  const t = useTokens();
  if (!order) return null;
  const lineColor = result ? (result.correct ? GREEN : RED) : t.neutral.border;
  return (
    <View>
      <View style={[styles.tokenLine, { borderColor: lineColor, borderRadius: t.radii.md }]}>
        {order.line.length === 0 ? (
          <Text style={{ color: t.neutral.textMuted }}>Tap the words in order…</Text>
        ) : (
          order.line.map((tok, ti) => (
            <TapChip key={ti} label={tok} disabled={!!result} onPress={() => onMoveToBank(ti)} tone="selected" t={t} />
          ))
        )}
      </View>
      {!result && order.bank.length > 0 ? (
        <View style={styles.optionRow}>
          {order.bank.map((tok, ti) => (
            <TapChip key={ti} label={tok} onPress={() => onMoveToLine(ti)} t={t} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  wordChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  input: { backgroundColor: "transparent" },
  explain: { marginTop: 8, padding: 12 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 9 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tryAgain: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderWidth: 1.5, marginTop: 10 },
  tokenLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    borderWidth: 1.5,
    padding: 10,
    marginTop: 8,
    minHeight: 52,
    alignItems: "center",
  },
});
