export const queryKeys = {
  reminders: ["reminders"] as const,
  streak: ["streak"] as const,
  decks: {
    myOwn: (page: number) => ["decks", "my_own", page] as const,
    others: (page: number) => ["decks", "others", page] as const,
    public: (page: number) => ["decks", "public", page] as const,
    detail: (id: string) => ["decks", id] as const,
  },
  terms: {
    byDeck: (deckId: string, page: number) => ["terms", deckId, page] as const,
  },
  learning: {
    reviseTerms: (deckId: string) => ["learning", "revise", deckId] as const,
    terms: (deckId: string, page: number) => ["learning", "terms", deckId, page] as const,
  },
  courses: {
    catalog: (page: number, level: string) => ["courses", page, level] as const,
    detail: (slug: string) => ["courses", slug] as const,
  },
  listening: {
    topics: ["listening", "topics"] as const,
    topic: (slug: string) => ["listening", "topic", slug] as const,
    exercise: (id: string) => ["listening", "exercise", id] as const,
  },
  grammar: {
    books: ["grammar", "books"] as const,
    catalog: (book?: string) => ["grammar", "catalog", book ?? ""] as const,
    unit: (key: string) => ["grammar", "unit", key] as const,
  },
  speaking: {
    history: ["speaking", "history"] as const,
    detail: (id: string) => ["speaking", id] as const,
    voices: ["speaking", "voices"] as const,
  },
  writing: {
    history: ["writing", "history"] as const,
    detail: (id: string) => ["writing", id] as const,
  },
  revise: {
    session: (size: number) => ["revise", "session", size] as const,
  },
};
