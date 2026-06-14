/**
 * Smart answer checking for the revise/learn modes.
 *
 * Instead of a raw case-insensitive string equality, we:
 *   1. Normalize both strings (lowercase, strip accents/punctuation, collapse
 *      whitespace, drop a leading article).
 *   2. Expand the expected answer into acceptable variants — alternatives
 *      separated by `/ ; ,` and optional `[..]` segments (e.g. `color[s]`).
 *   3. Accept small typos via Levenshtein distance with a length-proportional
 *      tolerance, so things like a missing `?`, a stray plural `s`, or a
 *      `colour`/`color` spelling no longer count as wrong.
 *
 * Approach follows the common "normalize + Levenshtein similarity threshold"
 * recipe used by quiz engines (e.g. Moodle STACK's Levenshtein answer test).
 */

/** Levenshtein edit distance (iterative two-row implementation). */
export function levenshtein(a = "", b = "") {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Remove diacritics so "café" matches "cafe". */
function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize a string for comparison:
 * trim, lowercase, drop accents/punctuation, collapse whitespace, and remove a
 * single leading article ("a"/"an"/"the").
 */
export function normalizeAnswer(str) {
  if (str == null) return "";
  let s = stripDiacritics(String(str).trim().toLowerCase());
  // Normalize fancy quotes to plain ones first.
  s = s.replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"');
  // Keep letters/numbers/spaces and intra-word apostrophes & hyphens; drop the rest.
  s = s.replace(/[^\p{L}\p{N}\s'-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Drop a leading article only when something else follows.
  s = s.replace(/^(?:a|an|the)\s+/, "");
  return s;
}

/**
 * Expand an `[optional]` segment, e.g. `color[s]` -> ["colors", "color"].
 * Only square brackets are treated as optional (parentheses are common in
 * normal prose, so we leave them to normalization).
 */
function expandOptional(raw) {
  const match = raw.match(/\[([^\]]*)\]/);
  if (!match) return [raw];
  const withText = raw.replace(match[0], match[1]);
  const without = raw.replace(match[0], "");
  // Recurse to handle multiple optional groups.
  return [...expandOptional(withText), ...expandOptional(without)];
}

/**
 * Build the set of acceptable normalized variants for an expected answer.
 * Always includes the full answer plus any `/ ; ,`-separated alternatives, each
 * with their optional `[..]` segments expanded.
 */
export function buildVariants(correctAnswer) {
  const raw = String(correctAnswer ?? "");
  const pieces = [raw, ...raw.split(/[/;,]/)];
  const variants = new Set();
  for (const piece of pieces) {
    for (const expanded of expandOptional(piece)) {
      const norm = normalizeAnswer(expanded);
      if (norm) variants.add(norm);
    }
  }
  if (variants.size === 0) variants.add("");
  return [...variants];
}

/** Allowed edit distance for a target — strict for short answers, ~20% for longer. */
function toleranceFor(target) {
  const len = target.length;
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return Math.floor(len * 0.2);
}

/**
 * Check a typed answer against the expected one.
 * @returns {{status: "correct"|"accepted"|"incorrect", isCorrect: boolean, distance: number}}
 *  - "correct"  : exact match after normalization
 *  - "accepted" : close enough (minor typo) — still counts as correct
 *  - "incorrect": no acceptable match
 */
export function checkAnswer(userAnswer, correctAnswer) {
  const user = normalizeAnswer(userAnswer);
  const variants = buildVariants(correctAnswer);

  if (!user) return { status: "incorrect", isCorrect: false, distance: Infinity };
  if (variants.includes(user)) {
    return { status: "correct", isCorrect: true, distance: 0 };
  }

  let best = { distance: Infinity, target: variants[0] };
  for (const variant of variants) {
    const distance = levenshtein(user, variant);
    if (distance < best.distance) best = { distance, target: variant };
  }

  if (best.distance <= toleranceFor(best.target)) {
    return { status: "accepted", isCorrect: true, distance: best.distance };
  }
  return { status: "incorrect", isCorrect: false, distance: best.distance };
}

/**
 * Character-level diff (case-insensitive) between the user's answer and the
 * expected answer, used to highlight exactly what differs.
 * @returns {{
 *   user: Array<{text: string, match: boolean}>,
 *   correct: Array<{text: string, match: boolean}>
 * }}
 *  - user[].match=false  -> extra / wrong characters the user typed
 *  - correct[].match=false -> characters the user missed
 */
export function diffAnswer(userAnswer, correctAnswer) {
  const a = String(userAnswer ?? "");
  const b = String(correctAnswer ?? "");
  const eq = (x, y) => x.toLowerCase() === y.toLowerCase();

  // LCS length table.
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const user = [];
  const correct = [];
  const pushSeg = (arr, ch, match) => {
    const last = arr[arr.length - 1];
    if (last && last.match === match) last.text += ch;
    else arr.push({ text: ch, match });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      pushSeg(user, a[i], true);
      pushSeg(correct, b[j], true);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSeg(user, a[i], false); // extra char in the user's answer
      i++;
    } else {
      pushSeg(correct, b[j], false); // char missing from the user's answer
      j++;
    }
  }
  while (i < n) pushSeg(user, a[i++], false);
  while (j < m) pushSeg(correct, b[j++], false);

  return { user, correct };
}
