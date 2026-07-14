export const ASSISTANT_NAME = "Dragon";

export const WELCOME_TEXT =
  `Hi, I'm ${ASSISTANT_NAME} — your FlashLearn study buddy! 🐉 ` +
  `I can help you create decks, learn, revise, and more. ` +
  `Pick a starter below to jump back in.`;

// The same fixed local reply the website uses while real AI chat is not wired
// up yet (the web build's requestAiReply). Adapted to drop the tour reference,
// which the native app intentionally omits.
export const STUB_REPLY =
  "I'm still learning to chat! 🐲 My smart replies are coming soon. " +
  "Meanwhile, tap one of the study shortcuts to jump back in.";

// Local delay so the typing indicator is visible, matching the web stub.
export const STUB_REPLY_DELAY_MS = 700;
