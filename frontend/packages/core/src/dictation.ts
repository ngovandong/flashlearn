export function normalizeWord(word: string): string {
  return (word || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9']/g, "");
}

export function tokenDisplay(token: string | string[]): string {
  return Array.isArray(token) ? String(token[0] ?? "") : String(token ?? "");
}

function acceptedForms(token: string | string[]): string[][] {
  const alternatives = Array.isArray(token) ? token : [token];
  return alternatives
    .map((alt) => String(alt).split(/\s+/).map(normalizeWord).filter(Boolean))
    .filter((form) => form.length > 0);
}

function words(text: string): string[] {
  return String(text || "")
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

export interface DictationLineResult {
  tokensCorrect: boolean[];
  correct: number;
  total: number;
  score: number;
}

export function evaluateDictation(
  tokens: (string | string[])[],
  typed: string
): DictationLineResult {
  const slots = (tokens || []).map(acceptedForms);
  const total = slots.length;
  const typedWords = words(typed);
  const n = total;
  const m = typedWords.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  const back: ([string, number, number] | null)[][] = Array.from(
    { length: n + 1 },
    () => new Array(m + 1).fill(null)
  );

  for (let j = 1; j <= m; j++) {
    dp[0][j] = j;
    back[0][j] = ["extra", 0, j - 1];
  }
  for (let i = 1; i <= n; i++) {
    dp[i][0] = i;
    back[i][0] = ["miss", i - 1, 0];
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = dp[i - 1][j] + 1;
      let step: [string, number, number] = ["miss", i - 1, j];
      if (dp[i][j - 1] + 1 < best) {
        best = dp[i][j - 1] + 1;
        step = ["extra", i, j - 1];
      }
      for (const form of slots[i - 1]) {
        const len = form.length;
        if (j < len) continue;
        let matched = true;
        for (let k = 0; k < len; k++) {
          if (typedWords[j - len + k] !== form[k]) {
            matched = false;
            break;
          }
        }
        if (matched && dp[i - 1][j - len] < best) {
          best = dp[i - 1][j - len];
          step = ["match", i - 1, j - len];
        }
      }
      dp[i][j] = best;
      back[i][j] = step;
    }
  }

  const tokensCorrect = new Array(n).fill(false);
  let i = n;
  let j = m;
  while ((i > 0 || j > 0) && back[i][j]) {
    const [type, pi, pj] = back[i][j]!;
    if (type === "match") tokensCorrect[pi] = true;
    i = pi;
    j = pj;
  }

  const correct = tokensCorrect.filter(Boolean).length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { tokensCorrect, correct, total, score };
}

export function overallDictationScore(
  lines: { correct?: number; total?: number }[]
): number {
  let correct = 0;
  let total = 0;
  for (const line of lines || []) {
    correct += line.correct || 0;
    total += line.total || 0;
  }
  return total ? Math.round((correct / total) * 100) : 0;
}
