// Inspect a deck's terms and report which games it can support.

import type { Term } from "../types";
import {
  MIN_TERMS_FOR_IMAGE,
  MIN_TERMS_FOR_MCQ,
  MIN_TERMS_FOR_SENTENCE,
  MIN_TERMS_FOR_SYN_ANT,
} from "./constants";

export interface GamePoolAvailability {
  mcq: boolean;
  synAnt: boolean;
  images: boolean;
  examples: boolean;
}

export interface GamePoolCounts {
  total: number;
  withSynAnt: number;
  withImages: number;
  withExamples: number;
}

export interface GamePool {
  terms: Term[];
  available: GamePoolAvailability;
  counts: GamePoolCounts;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.some(nonEmptyString);
}

export function termHasSynAnt(term: Term): boolean {
  return nonEmptyStringArray(term.synonyms) || nonEmptyStringArray(term.antonyms);
}

export function termHasImage(term: Term): boolean {
  return nonEmptyString(term.image);
}

export function termHasExample(term: Term): boolean {
  return nonEmptyStringArray(term.examples);
}

// Only terms with both a name and a meaning are usable in any game.
export function isPlayableTerm(term: Term | null | undefined): term is Term {
  return !!term && nonEmptyString(term.name) && nonEmptyString(term.meaning);
}

export function buildGamePool(terms: Term[] | null | undefined): GamePool {
  const playable = (terms ?? []).filter(isPlayableTerm);
  const withSynAnt = playable.filter(termHasSynAnt).length;
  const withImages = playable.filter(termHasImage).length;
  const withExamples = playable.filter(termHasExample).length;

  return {
    terms: playable,
    available: {
      mcq: playable.length >= MIN_TERMS_FOR_MCQ,
      synAnt: withSynAnt >= MIN_TERMS_FOR_SYN_ANT,
      images: withImages >= MIN_TERMS_FOR_IMAGE,
      examples: withExamples >= MIN_TERMS_FOR_SENTENCE,
    },
    counts: {
      total: playable.length,
      withSynAnt,
      withImages,
      withExamples,
    },
  };
}
