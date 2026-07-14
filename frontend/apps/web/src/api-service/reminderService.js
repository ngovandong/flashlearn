import BaseService from "./baseService";

class ReminderService extends BaseService {
  constructor() {
    super("reminders");
  }

  // [{ type, route, label }] — a random, availability-checked set of home prompts.
  getReminders() {
    return this.request.get(this.base);
  }
}

export const reminderService = new ReminderService();
