import { REMINDER_META } from "@flashlearn/core";
import { reminderIconName } from "@/theme/reminderIcons";

describe("reminderIconName", () => {
  it("maps every core reminder icon key to a concrete glyph", () => {
    for (const meta of Object.values(REMINDER_META)) {
      const name = reminderIconName(meta.icon);
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("falls back to a school icon for unknown keys", () => {
    expect(reminderIconName("totally-unknown")).toBe("school");
  });
});
