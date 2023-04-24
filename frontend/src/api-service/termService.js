import BaseService from "./baseService";

class TermService extends BaseService {
  constructor() {
    super("terms");
  }

  getTermsByDeck(deck_id) {
    return this.request.get(this.base, { params: { deck_id } });
  }

  addTermsToDeck(deck_id, terms) {
    const formData = new FormData();
    formData.append("deck_id", deck_id);

    terms.forEach((term, index) => {
      formData.append(`terms[${index}][name]`, term.name);
      formData.append(`terms[${index}][description]`, term.description);

      formData.append(`terms[${index}][image]`, term.image);
    });
    return this.request.post(this.action("add_terms"), formData);
  }
  updateTerms(terms) {
    const formData = new FormData();
    terms.forEach((term, index) => {
      formData.append(`[${index}][id]`, term.id);
      formData.append(`[${index}][name]`, term.name);
      formData.append(`[${index}][description]`, term.description);
      formData.append(`[${index}][image]`, term.image);
    });
    return this.request.put(this.action("update_terms"), formData);
  }
}

export const termService = new TermService();
