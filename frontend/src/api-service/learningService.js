import BaseService from "./baseService";

class LearningService extends BaseService {
  constructor() {
    super("learnings");
  }
  getLearningTerms = (deck_id) => {
    return this.request.get(this.action("get_learning_terms"), {
      params: { deck_id },
    });
  };
  getReviseTerms = (deck_id) => {
    return this.request.get(this.action("get_revise_terms"), {
      params: { deck_id },
    });
  };
  correct = (id) => {
    return this.request.put(this.detailAction(id, "correct"));
  };
  incorrect = (id) => {
    return this.request.put(this.detailAction(id, "incorrect"));
  };
}

export const learningService = new LearningService();
