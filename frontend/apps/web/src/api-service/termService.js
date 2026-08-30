import BaseService from "./baseService";
import { AI_REQUEST_TIMEOUT } from "./httpRequest";
import { TERM_EDIT_PAGE_SIZE } from "@constants/pageSize";

// Fields that the AI populates; arrays are JSON-encoded inside FormData.
const AI_STRING_FIELDS = ["word_type", "pronunciation", "definition"];
const AI_LIST_FIELDS = [
  "synonyms",
  "antonyms",
  "examples",
  "word_forms",
  "word_family",
];

function appendAiFields(formData, prefix, term) {
  AI_STRING_FIELDS.forEach((field) => {
    if (term[field] !== undefined && term[field] !== null) {
      formData.append(`${prefix}[${field}]`, term[field]);
    }
  });
  AI_LIST_FIELDS.forEach((field) => {
    if (term[field] !== undefined) {
      formData.append(`${prefix}[${field}]`, JSON.stringify(term[field] || []));
    }
  });
  if (term.ai_filled !== undefined) {
    formData.append(`${prefix}[ai_filled]`, term.ai_filled ? "true" : "false");
  }
}

class TermService extends BaseService {
  constructor() {
    super("terms");
  }

  getTermsByDeck(deck_id, page = 1) {
    return this.request.get(this.base, { params: { deck_id, page } });
  }
  getTermsByDeckCursor(deck_id, cursor = null) {
    const params = { deck_id };
    if (cursor) {
      params.cursor = cursor;
    }
    return this.request.get(this.base, { params });
  }

  // Numbered page of a deck's terms, optionally filtered by text and re-sorted.
  browseTerms(deck_id, { q = "", sort = "newest", page = 1, pageSize } = {}) {
    return this.request.get(this.action("browse"), {
      params: {
        deck_id,
        q,
        sort,
        page,
        page_size: pageSize ?? TERM_EDIT_PAGE_SIZE,
      },
    });
  }

  bulkDelete(deck_id, ids) {
    return this.request.post(this.action("bulk_delete"), { deck_id, ids });
  }

  addTermsToDeck(deck_id, terms) {
    const formData = new FormData();
    formData.append("deck_id", deck_id);

    terms.forEach((term, index) => {
      const prefix = `terms[${index}]`;
      formData.append(`${prefix}[name]`, term.name);
      formData.append(`${prefix}[meaning]`, term.meaning ?? "");
      formData.append(`${prefix}[image]`, term.image ?? "");
      appendAiFields(formData, prefix, term);
    });
    return this.request.post(this.action("add_terms"), formData);
  }
  updateTerms(terms) {
    const formData = new FormData();
    terms.forEach((term, index) => {
      const prefix = `[${index}]`;
      formData.append(`${prefix}[id]`, term.id);
      formData.append(`${prefix}[name]`, term.name);
      formData.append(`${prefix}[meaning]`, term.meaning ?? "");
      formData.append(`${prefix}[image]`, term.image ?? "");
      appendAiFields(formData, prefix, term);
    });
    return this.request.put(this.action("update_terms"), formData);
  }

  // Generate Oxford-style fields without persisting them. Hits an external AI
  // provider, so allow a longer timeout to ride out the backend rate-limit queue.
  aiEnrich(name, meaning = "") {
    return this.request.post(
      this.action("ai_enrich"),
      { name, meaning },
      { timeout: AI_REQUEST_TIMEOUT }
    );
  }

  // Save a single term (with optional AI fields) into the user's default deck.
  // Sent as JSON so list fields (synonyms, examples, ...) are passed through as-is.
  addToDefaultDeck(term) {
    const payload = {
      name: term.name,
      meaning: term.meaning ?? "",
      word_type: term.word_type ?? "",
      pronunciation: term.pronunciation ?? "",
      definition: term.definition ?? "",
      synonyms: term.synonyms ?? [],
      antonyms: term.antonyms ?? [],
      examples: term.examples ?? [],
      word_forms: term.word_forms ?? [],
      word_family: term.word_family ?? [],
      ai_filled: term.ai_filled ?? true,
    };
    // An https image URL is normalized (uploaded to Cloudinary) server-side.
    if (term.image) payload.image = term.image;
    return this.request.post(this.action("add_to_default_deck"), payload);
  }
}

export const termService = new TermService();
