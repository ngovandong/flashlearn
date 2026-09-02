/**
 * Pure geometry for the guided-tour overlay. Kept free of React so placement
 * can be unit-tested: the tooltip must always sit fully inside the viewport
 * (an off-screen card still captures clicks and blocks the page).
 */

export const TOOLTIP_WIDTH = 312;
export const SPOT_PAD = 10;
export const GAP = 22;
export const VIEW_MARGIN = 12;
export const ARROW_INSET = 22;

function clamp(n, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Place the spotlight + tooltip relative to a target rect.
 *
 * @param {object} args
 * @param {{ top: number, left: number, width: number, height: number } | null} args.rect
 * @param {number} args.vw
 * @param {number} args.vh
 * @param {number} args.tooltipWidth
 * @param {number} args.tooltipHeight
 */
export function placeTooltip({
  rect,
  vw,
  vh,
  tooltipWidth = TOOLTIP_WIDTH,
  tooltipHeight = 280,
}) {
  const width = Math.min(tooltipWidth, Math.max(0, vw - VIEW_MARGIN * 2));
  const height = Math.min(tooltipHeight, Math.max(0, vh - VIEW_MARGIN * 2));
  const maxLeft = Math.max(VIEW_MARGIN, vw - width - VIEW_MARGIN);
  const maxTop = Math.max(VIEW_MARGIN, vh - height - VIEW_MARGIN);

  if (!rect) {
    return {
      spot: null,
      placeBelow: true,
      tooltipTop: maxTop,
      tooltipLeft: clamp((vw - width) / 2, VIEW_MARGIN, maxLeft),
      arrowLeft: width / 2,
      width,
      height,
    };
  }

  const spot = {
    top: rect.top - SPOT_PAD,
    left: rect.left - SPOT_PAD,
    width: rect.width + SPOT_PAD * 2,
    height: rect.height + SPOT_PAD * 2,
  };

  const bottom = rect.top + rect.height;
  const spaceBelow = vh - bottom - VIEW_MARGIN;
  const spaceAbove = rect.top - VIEW_MARGIN;
  const need = height + GAP;

  let placeBelow;
  if (spaceBelow >= need) placeBelow = true;
  else if (spaceAbove >= need) placeBelow = false;
  else placeBelow = spaceBelow >= spaceAbove;

  let tooltipTop = placeBelow ? bottom + GAP : rect.top - GAP - height;
  let tooltipLeft = rect.left + rect.width / 2 - width / 2;

  tooltipLeft = clamp(tooltipLeft, VIEW_MARGIN, maxLeft);
  tooltipTop = clamp(tooltipTop, VIEW_MARGIN, maxTop);

  const centerX = rect.left + rect.width / 2;
  const arrowLeft = clamp(centerX - tooltipLeft, ARROW_INSET, Math.max(ARROW_INSET, width - ARROW_INSET));

  return { spot, placeBelow, tooltipTop, tooltipLeft, arrowLeft, width, height };
}
