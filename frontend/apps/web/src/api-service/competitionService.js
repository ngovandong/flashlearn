import BaseService from "./baseService";

class CompetitionService extends BaseService {
  constructor() {
    super("competition");
  }
  getPool = (deck_id) => {
    return this.request.get(this.action("pool"), { params: { deck_id } });
  };
  getLeaderboard = (deck_id, game_key) => {
    return this.request.get(this.action("leaderboard"), {
      params: { deck_id, game_key },
    });
  };
  submitScore = (deck_id, game_key, score) => {
    return this.request.post(this.action("submit_score"), {
      deck_id,
      game_key,
      score,
    });
  };
}

export const competitionService = new CompetitionService();
