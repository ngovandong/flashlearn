// Question builders for the competition mini-games.
// These are pure functions that turn a pool of Terms into ready-to-render
// question objects. MCQ reuses the existing quick-revise builder.

import type { Term } from "../types";
import { shuffleArray } from "../array";
import { buildQuickReviseQuestion } from "../quickRevise";

export interface McqQuestion {
  id?: string;
  prompt: string; // the meaning shown to the player
  answer: string; // the correct term name
  options: string[];
  image?: string;
}

export interface SynAntQuestion {
  id?: string;
  word: string; // the base term
  candidate: string; // a related word (synonym or antonym of `word`)
  isSynonym: boolean; // the correct classification
}

export interface ImageOption {
  name: string;
  image: string;
}

export interface ImageQuestion {
  id?: string;
  answer: string; // correct term name
  prompt: string; // the word to speak / show
  hint?: string; // meaning, shown as a subtitle
  options: ImageOption[];
}

export interface SentenceQuestion {
  id?: string;
  sentence: string; // example with the target word blanked out
  answer: string; // the exact word that was removed
  hint?: string; // meaning
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const SENTENCE_BLANK = "_____";

// -- Multiple choice: meaning -> name (race, blaster, tower, buzzer) ----------

export function buildMcqQuestions(terms: Term[], count?: number): McqQuestion[] {
  const shuffled = shuffleArray([...terms]);
  const chosen = typeof count === "number" ? shuffled.slice(0, count) : shuffled;
  return chosen.map((term) => {
    const q = buildQuickReviseQuestion(term, terms);
    return {
      id: term.id,
      prompt: q.question ?? "",
      answer: q.answer ?? "",
      options: q.options ?? [],
      image: q.image,
    };
  });
}

// -- Synonym / antonym classification (tug) -----------------------------------

export function buildSynAntQuestions(
  terms: Term[],
  count?: number
): SynAntQuestion[] {
  const candidates = terms.filter(
    (t) =>
      (Array.isArray(t.synonyms) && t.synonyms.length > 0) ||
      (Array.isArray(t.antonyms) && t.antonyms.length > 0)
  );
  const shuffled = shuffleArray([...candidates]);
  const chosen = typeof count === "number" ? shuffled.slice(0, count) : shuffled;

  const out: SynAntQuestion[] = [];
  for (const term of chosen) {
    const syns = (term.synonyms ?? []).filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0
    );
    const ants = (term.antonyms ?? []).filter(
      (a): a is string => typeof a === "string" && a.trim().length > 0
    );
    // Randomly show a synonym or antonym, but only from what's available.
    const useSynonym = syns.length > 0 && (ants.length === 0 || Math.random() < 0.5);
    if (useSynonym) {
      out.push({
        id: term.id,
        word: term.name as string,
        candidate: pickOne(syns),
        isSynonym: true,
      });
    } else if (ants.length > 0) {
      out.push({
        id: term.id,
        word: term.name as string,
        candidate: pickOne(ants),
        isSynonym: false,
      });
    }
  }
  return out;
}

// -- Image recognition (picture) ----------------------------------------------

export function buildImageQuestions(
  terms: Term[],
  count?: number
): ImageQuestion[] {
  const withImage = terms.filter(
    (t) => typeof t.image === "string" && t.image.trim().length > 0
  );
  const shuffled = shuffleArray([...withImage]);
  const chosen = typeof count === "number" ? shuffled.slice(0, count) : shuffled;

  const out: ImageQuestion[] = [];
  for (const term of chosen) {
    const distractors = shuffleArray(
      withImage.filter((d) => d.id !== term.id)
    ).slice(0, 3);
    if (distractors.length < 3) continue;
    const options = shuffleArray([term, ...distractors]).map((d) => ({
      name: d.name as string,
      image: d.image as string,
    }));
    out.push({
      id: term.id,
      answer: term.name as string,
      prompt: term.name as string,
      hint: term.meaning,
      options,
    });
  }
  return out;
}

// -- Fill the blank in a sentence (sentence) ----------------------------------

function blankExample(
  example: string,
  name: string,
  forms: string[]
): { sentence: string; answer: string } | null {
  const clean = stripHtml(example);
  // Prefer the longest match so multi-word forms win over substrings.
  const words = [name, ...forms]
    .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  for (const word of words) {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
    if (re.test(clean)) {
      return { sentence: clean.replace(re, SENTENCE_BLANK), answer: word };
    }
  }
  return null;
}

export function buildSentenceQuestions(
  terms: Term[],
  count?: number
): SentenceQuestion[] {
  const withExamples = terms.filter(
    (t) =>
      Array.isArray(t.examples) &&
      t.examples.some((e) => typeof e === "string" && e.trim().length > 0)
  );
  const shuffled = shuffleArray([...withExamples]);
  const chosen = typeof count === "number" ? shuffled.slice(0, count) : shuffled;

  const out: SentenceQuestion[] = [];
  for (const term of chosen) {
    const examples = (term.examples ?? []).filter(
      (e): e is string => typeof e === "string" && e.trim().length > 0
    );
    const forms = (term.word_forms ?? []).filter(
      (f): f is string => typeof f === "string" && f.trim().length > 0
    );
    for (const example of shuffleArray([...examples])) {
      const blanked = blankExample(example, term.name as string, forms);
      if (blanked) {
        out.push({
          id: term.id,
          sentence: blanked.sentence,
          answer: blanked.answer,
          hint: term.meaning,
        });
        break;
      }
    }
  }
  return out;
}
