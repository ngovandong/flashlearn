import BaseService from "./baseService";

class LearningService extends BaseService {
  constructor() {
    super("learnings");
  }
  getLearningTerms = (deck_id, page) => {
    return this.request.get(this.action("get_learning_terms"), {
      params: { deck_id, page },
    });
  };
  getLatestLearnedTerm = (deck_id) => {
    return this.request.get(this.action("get_latest_learned_term"), {
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
  remember = (id) => {
    return this.request.put(this.detailAction(id, "remember"));
  };
  changePriority = (id, point) => {
    return this.request.put(this.detailAction(id, "priority"), {
      adjust_point: point,
    });
  };
}

export const learningService = new LearningService();
