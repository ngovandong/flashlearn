import BaseService from "./baseService";

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

  addTermsToDeck(deck_id, terms) {
    const formData = new FormData();
    formData.append("deck_id", deck_id);

    terms.forEach((term, index) => {
      const prefix = `terms[${index}]`;
      formData.append(`${prefix}[name]`, term.name);
      formData.append(`${prefix}[meaning]`, term.meaning ?? "");
      formData.append(`${prefix}[image]`, term.image);
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
      formData.append(`${prefix}[image]`, term.image);
      appendAiFields(formData, prefix, term);
    });
    return this.request.put(this.action("update_terms"), formData);
  }

  // Generate Oxford-style fields without persisting them.
  aiEnrich(name, meaning = "") {
    return this.request.post(this.action("ai_enrich"), { name, meaning });
  }
}

export const termService = new TermService();
