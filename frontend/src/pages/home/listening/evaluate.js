// Client-side dictation evaluation.
//
// A sentence's transcript arrives as `tokens` (DailyDictation's jsonContent): an
// ordered list of slots where each slot is either a string or a list of accepted
// alternatives (e.g. ["Where is", "where's"]). We align the learner's typed words
// to those slots with a small edit-distance DP so contractions/alternatives are
// accepted and insertions/deletions don't cascade into everything after them
// being marked wrong. The result drives both the score and the per-token reveal.

export function normalizeWord(word) {
  return (word || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'") // curly → straight apostrophe
    .replace(/[^a-z0-9']/g, ""); // strip surrounding punctuation
}

// The canonical display string for a slot (first accepted alternative).
export function tokenDisplay(token) {
  return Array.isArray(token) ? String(token[0] ?? "") : String(token ?? "");
}

// Accepted word-sequences for a slot: [[word, ...], ...] (normalized).
function acceptedForms(token) {
  const alternatives = Array.isArray(token) ? token : [token];
  return alternatives
    .map((alt) => String(alt).split(/\s+/).map(normalizeWord).filter(Boolean))
    .filter((form) => form.length);
}

function words(text) {
  return String(text || "").split(/\s+/).map(normalizeWord).filter(Boolean);
}

// Evaluate typed text against a sentence's tokens.
// Returns { tokensCorrect: boolean[], correct, total, score }.
export function evaluateDictation(tokens, typed) {
  const slots = (tokens || []).map(acceptedForms);
  const total = slots.length;
  const typedWords = words(typed);
  const n = total;
  const m = typedWords.length;

  // dp[i][j] = min "errors" aligning the first i slots with the first j typed words.
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
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
      let best = dp[i - 1][j] + 1; // slot i unmatched (missing)
      let step = ["miss", i - 1, j];
      if (dp[i][j - 1] + 1 < best) {
        best = dp[i][j - 1] + 1; // typed word j is extra
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
          best = dp[i - 1][j - len]; // exact slot match (cost 0)
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
    const [type, pi, pj] = back[i][j];
    if (type === "match") tokensCorrect[pi] = true;
    i = pi;
    j = pj;
  }

  const correct = tokensCorrect.filter(Boolean).length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { tokensCorrect, correct, total, score };
}

// Roll per-sentence line results into one exercise score (weighted by tokens).
export function overallScore(lines) {
  let correct = 0;
  let total = 0;
  for (const line of lines || []) {
    correct += line.correct || 0;
    total += line.total || 0;
  }
  return total ? Math.round((correct / total) * 100) : 0;
}
