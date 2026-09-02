import { placeTooltip, VIEW_MARGIN, GAP, TOOLTIP_WIDTH } from "./guideTourLayout";

const TIP = { tooltipWidth: TOOLTIP_WIDTH, tooltipHeight: 280 };

function onScreen(layout, vw, vh) {
  expect(layout.tooltipTop).toBeGreaterThanOrEqual(VIEW_MARGIN);
  expect(layout.tooltipLeft).toBeGreaterThanOrEqual(VIEW_MARGIN);
  expect(layout.tooltipTop + layout.height).toBeLessThanOrEqual(vh - VIEW_MARGIN + 0.5);
  expect(layout.tooltipLeft + layout.width).toBeLessThanOrEqual(vw - VIEW_MARGIN + 0.5);
}

describe("placeTooltip", () => {
  test("puts the tooltip below a target in the top half", () => {
    const vw = 1200;
    const vh = 800;
    const layout = placeTooltip({
      rect: { top: 80, left: 400, width: 200, height: 40 },
      vw,
      vh,
      ...TIP,
    });
    expect(layout.placeBelow).toBe(true);
    expect(layout.tooltipTop).toBe(80 + 40 + GAP);
    onScreen(layout, vw, vh);
  });

  test("puts the tooltip above a target in the bottom half", () => {
    const vw = 1200;
    const vh = 800;
    const layout = placeTooltip({
      rect: { top: 640, left: 400, width: 200, height: 40 },
      vw,
      vh,
      ...TIP,
    });
    expect(layout.placeBelow).toBe(false);
    expect(layout.tooltipTop).toBe(640 - GAP - 280);
    onScreen(layout, vw, vh);
  });

  test("keeps the tooltip fully on screen for a near-full-viewport revise card", () => {
    const vw = 1280;
    const vh = 800;
    // Mirrors /deck/:id/revise: .learn-container fills the body under a 64px header.
    const layout = placeTooltip({
      rect: { top: 64, left: 40, width: 1200, height: 736 },
      vw,
      vh,
      ...TIP,
    });
    onScreen(layout, vw, vh);
    expect(layout.tooltipTop).toBeGreaterThanOrEqual(0);
  });

  test("clamps horizontally when the target sits on the left edge", () => {
    const vw = 900;
    const vh = 700;
    const layout = placeTooltip({
      rect: { top: 80, left: 0, width: 40, height: 40 },
      vw,
      vh,
      ...TIP,
    });
    expect(layout.tooltipLeft).toBe(VIEW_MARGIN);
    onScreen(layout, vw, vh);
  });

  test("clamps horizontally when the target sits on the right edge", () => {
    const vw = 900;
    const vh = 700;
    const layout = placeTooltip({
      rect: { top: 80, left: 860, width: 40, height: 40 },
      vw,
      vh,
      ...TIP,
    });
    expect(layout.tooltipLeft + layout.width).toBeLessThanOrEqual(vw - VIEW_MARGIN);
    onScreen(layout, vw, vh);
  });

  test("pins a missing target to the bottom of the viewport", () => {
    const vw = 1000;
    const vh = 700;
    const layout = placeTooltip({ rect: null, vw, vh, ...TIP });
    expect(layout.spot).toBeNull();
    expect(layout.tooltipTop).toBe(vh - 280 - VIEW_MARGIN);
    onScreen(layout, vw, vh);
  });

  test("never goes negative on a viewport shorter than the tooltip", () => {
    const vw = 360;
    const vh = 200;
    const layout = placeTooltip({
      rect: { top: 10, left: 10, width: 340, height: 180 },
      vw,
      vh,
      tooltipWidth: TOOLTIP_WIDTH,
      tooltipHeight: 280,
    });
    expect(layout.tooltipTop).toBeGreaterThanOrEqual(0);
    expect(layout.tooltipLeft).toBeGreaterThanOrEqual(0);
    expect(layout.height).toBeLessThanOrEqual(vh - VIEW_MARGIN * 2);
    onScreen(layout, vw, vh);
  });
});
