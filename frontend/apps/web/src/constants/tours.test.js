import { TOURS } from "./tours";

describe("TOURS registry", () => {
  test("every step uses a data-tour selector so hidden class matches are not targeted", () => {
    const missing = [];
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        if (!/^\[data-tour="[^"]+"\]$/.test(step.selector)) {
          missing.push(`${tour.id}/${step.id}: ${step.selector}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("step ids are unique", () => {
    const ids = TOURS.flatMap((t) => t.steps.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
