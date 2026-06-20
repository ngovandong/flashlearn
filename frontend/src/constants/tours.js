/**
 * Page tour registry — the single source of truth for onboarding guides.
 *
 * Each tour targets one page/route and lists the steps Dragon walks the user
 * through. A step `selector` points at a REAL element in the UI (prefer a
 * stable `[data-tour="…"]` marker; existing unique class names are fine too).
 *
 * Persistence is per-step (see utils/tourStorage): a tour auto-shows on a
 * user's first visit to its page, marks each step done as the user clicks
 * "Next", and on later visits only shows the steps that are still left. Once
 * every step is done it never auto-shows again.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ADDING A NEW PAGE? You MUST add a tour entry here describing how to use it,
 * and add matching `data-tour` markers to that page's key controls.
 * ───────────────────────────────────────────────────────────────────────────
 */

const exact = (path) => (pathname) => pathname === path;

export const TOURS = [
  {
    id: "home",
    label: "Home",
    match: (p) => p === "/" || p === "",
    steps: [
      {
        id: "home.create-deck",
        selector: '[data-tour="create-deck"]',
        title: "Create a new deck",
        body: "Tap the + button to build a brand-new deck — add terms, definitions, and images, then start studying.",
      },
      {
        id: "home.reminders",
        selector: '[data-tour="reminders"]',
        title: "Pick up where you left off",
        body: "These cards suggest your next move — continue a course, revise a deck, replay a conversation, or train your listening. They refresh each visit.",
      },
      {
        id: "home.decks",
        selector: '[data-tour="decks"]',
        title: "Browse & clone public decks",
        body: "Open Decks to explore community decks. Found one you like? Clone it into your own library and make it yours.",
      },
      {
        id: "home.course",
        selector: '[data-tour="course"]',
        title: "Guided courses",
        body: "Open Course to work through structured, level-based dialogues — listen, study the transcript, then pass each lesson with a Live Role-play.",
      },
      {
        id: "home.number-test",
        selector: '[data-tour="number-test"]',
        title: "Number Listening",
        body: "Train your ear by typing the English numbers you hear — from quick digits to phone, tax, and ID numbers.",
      },
      {
        id: "home.speaking-coach",
        selector: '[data-tour="speaking-coach"]',
        title: "Speaking Coach",
        body: "Practice real conversations out loud — the AI generates dialogues, reads them aloud, and scores your pronunciation.",
      },
      {
        id: "home.writing-coach",
        selector: '[data-tour="writing-coach"]',
        title: "Writing Coach",
        body: "Improve your writing — chat with Dragon for instant feedback on every message, or write freely and get an IELTS-style band score.",
      },
      {
        id: "home.assistant",
        selector: '[data-tour="assistant"]',
        title: "Meet Dragon, your buddy",
        body: "That's me! Click anytime you need help, tips, or to reopen a guide. I'm always here in the corner.",
      },
      {
        id: "home.account",
        selector: '[data-tour="account"]',
        title: "Your settings",
        body: "Open your account menu to edit your profile, switch color themes, toggle dark mode, and manage your account.",
      },
    ],
  },
  {
    id: "deck-detail",
    label: "Deck",
    match: (p) => /^\/deck\/[^/]+$/.test(p),
    steps: [
      {
        id: "deck.learn",
        selector: '[data-tour="deck-learn"]',
        title: "Learn this deck",
        body: "Start a guided, spaced-repetition session that introduces new terms and checks what you remember.",
      },
      {
        id: "deck.revise",
        selector: '[data-tour="deck-revise"]',
        title: "Revise",
        body: "Already studied? Flip through flashcards to reinforce the terms you've seen before.",
      },
      {
        id: "deck.quick-revise",
        selector: '[data-tour="deck-quick-revise"]',
        title: "Quick Revise",
        body: "Short on time? A fast-paced round to test yourself in just a few minutes.",
      },
      {
        id: "deck.edit-btn",
        selector: '[data-tour="deck-edit-btn"]',
        title: "Edit your deck",
        body: "Update the deck's details and add or change terms — a quick two-step flow guides you through it.",
      },
      {
        id: "deck.share-btn",
        selector: '[data-tour="deck-share-btn"]',
        title: "Share with friends",
        body: "Generate an invite link to share your deck — choose view-only or let others edit.",
      },
      {
        id: "deck.more-btn",
        selector: '[data-tour="deck-more-btn"]',
        title: "More options",
        body: "Reset your learning progress to study from scratch, or delete the deck here.",
      },
    ],
  },
  {
    id: "deck-learn",
    label: "Learn",
    match: (p) => /^\/deck\/[^/]+\/learn(\/[^/]+)?$/.test(p),
    steps: [
      {
        id: "learn.flip",
        selector: ".flip-card",
        title: "Flip the card",
        body: "Read the term, then tap the card to reveal its meaning. Try to recall it before flipping!",
      },
      {
        id: "learn.navigate",
        selector: ".navigate-btns",
        title: "Move between cards",
        body: "Use these arrows to go back and forward — you can also swipe or use the left/right arrow keys.",
      },
      {
        id: "learn.ai",
        selector: ".definition-card",
        title: "Definitions & AI",
        body: "See the definition here, and tap “Fill with AI” to auto-enrich a term with examples, synonyms, and more.",
      },
      {
        id: "learn.extras",
        selector: ".learn-right-col",
        title: "Build out the word",
        body: "Add synonyms, antonyms, word forms, and example sentences to deepen your understanding.",
      },
    ],
  },
  {
    id: "deck-revise",
    label: "Revise",
    match: (p) => /^\/deck\/[^/]+\/revise$/.test(p),
    steps: [
      {
        id: "revise.answer",
        selector: ".learn-container",
        title: "Answer to revise",
        body: "Pick the correct option or type the word. Dragon reads the answer aloud so you learn the sound too.",
      },
      {
        id: "revise.progress",
        selector: ".center-header",
        title: "Track your round",
        body: "Your position in the round shows here. Finish every question to complete the revision.",
      },
    ],
  },
  {
    id: "deck-quick-revise",
    label: "Quick Revise",
    match: (p) => /^\/deck\/[^/]+\/quick-revise$/.test(p),
    steps: [
      {
        id: "quick.timer",
        selector: ".left-header",
        title: "Beat the timer",
        body: "Each question is timed — the bar turns orange then red as time runs out. Answer fast to keep your streak!",
      },
      {
        id: "quick.answer",
        selector: ".learn-container",
        title: "Answer quickly",
        body: "Choose the right answer to score a point. One wrong answer or a timeout ends the run.",
      },
    ],
  },
  {
    id: "deck-edit",
    label: "Add terms",
    match: (p, s) => /^\/deck\/[^/]+\/edit$/.test(p) && (s || "").includes("tab=1"),
    steps: [
      {
        id: "edit.add",
        selector: ".add-more-container",
        title: "Add your terms",
        body: "Tap “Add term” to create a card, then fill in the word and its meaning. Repeat for every term.",
      },
      {
        id: "edit.save",
        selector: ".save-btn",
        title: "Save your work",
        body: "Save as you go so you never lose progress. When you're finished, hit Done to start studying.",
      },
    ],
  },
  {
    id: "number-test",
    label: "Number Listening",
    match: (p) => p.endsWith("/number-test") || p === "/number-test",
    steps: [
      {
        id: "nt.modes",
        selector: ".modes-row",
        title: "Pick a difficulty",
        body: "Choose what to practice — single digits, the tricky teens-vs-tens, big numbers, or phone/tax/ID sequences.",
      },
      {
        id: "nt.settings",
        selector: ".flex-row-settings",
        title: "Tune your round",
        body: "Set how many questions you want and choose a voice accent. You can also adjust speed and pitch below.",
      },
      {
        id: "nt.start",
        selector: ".start-test-btn",
        title: "Start practising",
        body: "Hit Start practice — Dragon will read a number aloud and you type what you hear. Good luck!",
      },
    ],
  },
  {
    id: "course",
    label: "Course",
    match: (p) => p === "/course" || p.startsWith("/course/"),
    steps: [
      {
        id: "course.catalog",
        selector: '[data-tour="sc-course-catalog"]',
        title: "Guided courses",
        body: "Pick a level-based course, then open a lesson to listen to the dialogue, study the transcript, and pass it with a Live Role-play scored by Dragon.",
      },
      {
        id: "course.vocab",
        selector: '[data-tour="sc-course-vocab"]',
        title: "Tap words to study",
        body: "In a lesson, select any word or phrase to see its meaning, IPA and a speaking tip — then save it as a term or highlight it. Your saved words stay underlined, and your last role-play breakdown is kept here so you can revisit it.",
      },
    ],
  },
  {
    id: "speaking-coach",
    label: "Speaking Coach",
    match: (p) => p.endsWith("/speaking-coach") || p === "/speaking-coach",
    steps: [
      {
        id: "sc.setup",
        selector: '[data-tour="sc-setup"]',
        title: "Set up your practice",
        body: "Pick an AI topic or paste your own text, then choose the accent, level, tone, and length of the dialogue.",
      },
      {
        id: "sc.vocab-pick",
        selector: '[data-tour="sc-vocab-pick"]',
        title: "Practice your own words",
        body: "Turn this on to generate a natural conversation built around the vocabulary you've saved — great for revising in context. We pick the topic and title for you.",
      },
      {
        id: "sc.voice",
        selector: '[data-tour="sc-voice"]',
        title: "Choose your tutor voice",
        body: "Pick a natural AI reference voice — you'll hear a quick sample, or tap Demo to replay it. Dragon reads every line aloud in this voice when you tap Listen or play the conversation.",
      },
      {
        id: "sc.generate",
        selector: '[data-tour="sc-generate"]',
        title: "Generate a conversation",
        body: "Dragon builds a realistic two-person dialogue you can listen to, read along with, and practice out loud.",
      },
      {
        id: "sc.actions",
        selector: '[data-tour="sc-actions"]',
        title: "Listen & role-play",
        body: "Play the whole dialogue, or start Live role play to record your lines and get a pronunciation score.",
      },
      {
        id: "sc.vocab",
        selector: '[data-tour="sc-vocab"]',
        title: "Learn & save vocabulary",
        body: "Select any word or phrase in a line for its meaning, IPA and a speaking tip — then save it as a term or highlight it to revisit. Words you've already saved appear underlined; click them to study.",
      },
      {
        id: "sc.tabs",
        selector: '[data-tour="sc-tabs"]',
        title: "Review your history",
        body: "Switch to History anytime to revisit past conversations. Star favorites to pin them to the top, or select several to delete in one go.",
      },
      {
        id: "sc.course",
        selector: '[data-tour="sc-course-tab"]',
        title: "Follow a guided course",
        body: "Open Course to work through structured dialogues organized by level. Listen, study the transcript, then pass each lesson with a Live Role-play scored by Dragon.",
      },
    ],
  },
  {
    id: "writing-coach",
    label: "Writing Coach",
    match: (p) => p.endsWith("/writing-coach") || p === "/writing-coach",
    steps: [
      {
        id: "wc.setup",
        selector: '[data-tour="wc-setup"]',
        title: "Set up your practice",
        body: "Pick a suggested topic or type your own, then choose your level. Dragon tailors everything to it.",
      },
      {
        id: "wc.mode",
        selector: '[data-tour="wc-mode"]',
        title: "Chat or Free-form",
        body: "Chat: have a back-and-forth with Dragon and get feedback on every message. Free-form: write a full piece and get an IELTS-style band score.",
      },
      {
        id: "wc.feedback",
        selector: '[data-tour="wc-feedback"]',
        title: "Instant feedback",
        body: "In chat, click any of your messages to see its corrections, a better version, tips and examples — Dragon reads each reply aloud too.",
      },
      {
        id: "wc.suggestions",
        selector: '[data-tour="wc-suggestions"]',
        title: "Writing support",
        body: "In free-form, the side panel suggests useful words, phrases, grammar and a structure to follow before you submit.",
      },
      {
        id: "wc.vocab",
        selector: '[data-tour="wc-vocab"]',
        title: "Learn & save vocabulary",
        body: "Select any word or phrase to see its meaning and examples — then save it as a term or highlight it to revisit. Saved words appear underlined.",
      },
      {
        id: "wc.tabs",
        selector: '[data-tour="wc-tabs"]',
        title: "Review your history",
        body: "Switch to History to revisit past sessions, star favorites, or restart a topic to write an even better version.",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    match: exact("/settings"),
    steps: [
      {
        id: "settings.appearance",
        selector: '[data-tour="settings-appearance"]',
        title: "Make it yours",
        body: "Switch between light and dark mode and pick a color theme — the whole app re-themes instantly.",
      },
      {
        id: "settings.save",
        selector: ".settings-footer",
        title: "Save your changes",
        body: "Adjust notifications above, then hit Save to keep your preferences.",
      },
    ],
  },
  {
    id: "create-deck",
    label: "Create deck",
    match: exact("/create-deck"),
    steps: [
      {
        id: "cd.form",
        selector: ".create-deck__tab",
        title: "Describe your deck",
        body: "Give your deck a name and description, optionally a cover image, then continue to add terms.",
      },
    ],
  },
];

export function getTourForPath(pathname, search = "") {
  return TOURS.find((t) => t.match(pathname, search));
}

export function getTourById(id) {
  return TOURS.find((t) => t.id === id);
}
