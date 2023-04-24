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
}

export const learningService = new LearningService();
