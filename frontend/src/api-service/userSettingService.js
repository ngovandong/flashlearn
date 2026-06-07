import BaseService from "./baseService";

class UserSettingService extends BaseService {
  constructor() {
    super("users");
  }

  getSettings = () => {
    return this.request.get(this.action("my_settings"));
  };

  updateSettings = (data) => {
    return this.request.patch(this.action("my_settings"), data);
  };

  getLearningStreak = () => {
    return this.request.get(this.action("learning_streak"));
  };

  recordStudyActivity = () => {
    return this.request.post(this.action("record_study"));
  };
}

export const userSettingService = new UserSettingService();
