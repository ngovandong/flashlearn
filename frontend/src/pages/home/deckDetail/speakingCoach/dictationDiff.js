// Word-level diff + scoring for the course "listen & type" (dictation) drill.
//
// The learner hears a line and types what they heard; we compare their text
// against the transcript word-by-word so the feedback is intuitive: matched
// words read normally, words they missed are marked on the answer, and extra or
// wrong words are marked on what they typed. Comparison ignores case and
// punctuation so "Hello, Tom!" and "hello tom" count as a match, while the
// original words are kept for display.

function tokenize(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean);
}

// Compare-key for a word: lowercase, strip surrounding punctuation (keep inner
// apostrophes/hyphens so "don't" and "well-known" stay intact).
function normWord(word) {
  return (word || "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

// Longest-common-subsequence alignment of the target vs. typed words. Returns
// the tokens tagged for display plus the count of correctly-heard words:
//   targetTokens: [{ word, status: "ok" | "missing" }]
//   typedTokens:  [{ word, status: "ok" | "wrong" }]
//   correct: matched word count, total: target word count.
export function diffLine(target, typed) {
  const tWords = tokenize(target);
  const uWords = tokenize(typed);
  const tn = tWords.map(normWord);
  const un = uWords.map(normWord);
  const n = tn.length;
  const m = un.length;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = tn[i] === un[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const targetTokens = [];
  const typedTokens = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tn[i] === un[j]) {
      targetTokens.push({ word: tWords[i], status: "ok" });
      typedTokens.push({ word: uWords[j], status: "ok" });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      targetTokens.push({ word: tWords[i], status: "missing" });
      i += 1;
    } else {
      typedTokens.push({ word: uWords[j], status: "wrong" });
      j += 1;
    }
  }
  while (i < n) {
    targetTokens.push({ word: tWords[i], status: "missing" });
    i += 1;
  }
  while (j < m) {
    typedTokens.push({ word: uWords[j], status: "wrong" });
    j += 1;
  }

  return { targetTokens, typedTokens, correct: dp[0][0], total: n };
}

// Evaluate every transcript line against the typed inputs. Returns the full
// per-line breakdown (with display tokens) and an overall percentage of words
// heard correctly across the whole dialogue.
export function evaluateDictation(lines, inputs) {
  const perLine = (lines || []).map((line, index) => {
    const target = line?.text || "";
    const typed = inputs?.[index] || "";
    return { target, typed, ...diffLine(target, typed) };
  });
  const totalWords = perLine.reduce((sum, l) => sum + l.total, 0);
  const correctWords = perLine.reduce((sum, l) => sum + l.correct, 0);
  const score = totalWords ? Math.round((correctWords / totalWords) * 100) : 0;
  return { score, lines: perLine };
}

// Rebuild display tokens for a saved dictation (the backend stores only
// { target, typed, correct, total } per line) so a revisit can re-render the
// same colour-coded diff without re-typing.
export function hydrateDictation(saved) {
  if (!saved?.lines?.length) return null;
  const lines = saved.lines.map((l) => ({
    target: l.target || "",
    typed: l.typed || "",
    ...diffLine(l.target || "", l.typed || ""),
  }));
  return { score: saved.score || 0, lines, at: saved.at };
}
