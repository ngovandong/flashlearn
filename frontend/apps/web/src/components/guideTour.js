import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Button } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import DragonAvatar from "./dragonAvatar";
import {
  TOOLTIP_WIDTH,
  placeTooltip,
} from "./guideTourLayout";

const MIN_ONSCREEN = 8;

function isRendered(el) {
  if (!el || typeof window === "undefined") return false;
  if (!el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    Number(style.opacity) === 0
  ) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

function intersectsViewport(el) {
  const r = el.getBoundingClientRect();
  const overlapW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const overlapH = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  return overlapW >= MIN_ONSCREEN && overlapH >= MIN_ONSCREEN;
}

/**
 * Whether an element is actually rendered — present in the DOM AND not hidden
 * via display/visibility/opacity or collapsed to zero size. Used to pick the
 * first matching target when the same selector exists twice (e.g. desktop +
 * mobile nav).
 */
export function isElementVisible(el) {
  return isRendered(el);
}

/** First matching element that is actually rendered (skips display:none copies). */
export function queryVisibleElement(selector) {
  if (typeof document === "undefined" || !selector) return null;
  const nodes = document.querySelectorAll(selector);
  for (const el of nodes) {
    if (isRendered(el)) return el;
  }
  return null;
}

function measureRect(selector) {
  const el = queryVisibleElement(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

/** Whether a tour step's target currently exists and is visible on screen. */
export function isStepVisible(step) {
  if (!step || typeof document === "undefined") return false;
  return queryVisibleElement(step.selector) != null;
}

function GuideTour({ open, onClose, onStepDone, onSkipAll, steps = [] }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [tipSize, setTipSize] = useState({ w: TOOLTIP_WIDTH, h: 280 });
  const tooltipRef = useRef(null);

  const step = steps[index];

  const sync = useCallback(() => {
    if (!step) return;
    const el = queryVisibleElement(step.selector);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    setRect(measureRect(step.selector));
  }, [step]);

  // Re-measure when the step opens/changes.
  useLayoutEffect(() => {
    if (!open) return undefined;
    sync();
    // A second pass after smooth-scroll/layout settles.
    const t = setTimeout(sync, 360);
    // If the target doesn't exist OR isn't on screen after scrolling, skip
    // rather than leaving a tooltip that has nothing to point at.
    const skip = setTimeout(() => {
      const el = step && queryVisibleElement(step.selector);
      if (step && (!el || !intersectsViewport(el))) {
        if (index >= steps.length - 1) finish();
        else setIndex((i) => i + 1);
      }
    }, 900);
    return () => {
      clearTimeout(t);
      clearTimeout(skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, sync]);

  // Keep the spotlight glued to the element while scrolling/resizing.
  useEffect(() => {
    if (!open || !step) return undefined;
    const onMove = () => setRect(measureRect(step.selector));
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const id = setInterval(onMove, 250);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      clearInterval(id);
    };
  }, [open, step]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !tooltipRef.current) return;
    const r = tooltipRef.current.getBoundingClientRect();
    if (Math.abs(r.width - tipSize.w) > 1 || Math.abs(r.height - tipSize.h) > 1) {
      setTipSize({ w: r.width, h: r.height });
    }
  }, [open, index, step, rect, tipSize.w, tipSize.h]);

  const finish = () => {
    onClose?.();
    setTimeout(() => setIndex(0), 250);
  };

  const next = () => {
    // Mark the current step complete the moment the user moves past it.
    if (step) onStepDone?.(step.id);
    if (index >= steps.length - 1) finish();
    else setIndex((i) => i + 1);
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const skipAll = () => {
    onSkipAll?.();
    finish();
  };

  if (!open || typeof document === "undefined" || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  const layout = placeTooltip({
    rect,
    vw,
    vh,
    tooltipWidth: tipSize.w || TOOLTIP_WIDTH,
    tooltipHeight: tipSize.h || 280,
  });
  const { spot, placeBelow, tooltipTop, tooltipLeft, arrowLeft } = layout;

  const overlay = (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 13000,
        // Let the page stay interactive during the tour — only the tooltip
        // captures clicks. The dim/spotlight below is purely visual.
        pointerEvents: "none",
        "@keyframes tour-arrow-down": {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
          "50%": { transform: "translateX(-50%) translateY(8px)" },
        },
        "@keyframes tour-arrow-up": {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
          "50%": { transform: "translateX(-50%) translateY(-8px)" },
        },
        "@keyframes tour-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(var(--fl-primary-rgb), 0.55)" },
          "70%": { boxShadow: "0 0 0 14px rgba(var(--fl-primary-rgb), 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(var(--fl-primary-rgb), 0)" },
        },
        "@keyframes tour-pop": {
          "0%": { opacity: 0, transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
        },
      }}
    >
      {/* Visual-only dim while we wait for a target to resolve (no spotlight
          yet). Never blocks clicks — pointer events stay off. */}
      {!spot && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(15, 17, 23, 0.55)",
            pointerEvents: "none",
            transition: "background-color 0.3s ease",
          }}
        />
      )}

      {/* Spotlight cutout (dim everything except the target). */}
      {spot && (
        <Box
          sx={{
            position: "absolute",
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            borderRadius: "0.85rem",
            boxShadow: "0 0 0 9999px rgba(15, 17, 23, 0.6)",
            pointerEvents: "none",
            transition:
              "top 0.42s cubic-bezier(0.4,0,0.2,1), left 0.42s cubic-bezier(0.4,0,0.2,1), width 0.42s cubic-bezier(0.4,0,0.2,1), height 0.42s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* Pulsing accent ring hugging the element. */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              borderRadius: "0.85rem",
              border: "2px solid var(--fl-primary)",
              animation: "tour-ring 1.8s ease-out infinite",
            }}
          />
        </Box>
      )}

      {/* Bouncing arrow pointing at the element. */}
      {spot && (
        <Box
          sx={{
            position: "absolute",
            left: spot.left + spot.width / 2,
            top: placeBelow
              ? Math.min(vh - 44, spot.top + spot.height + 2)
              : Math.max(0, spot.top - 40),
            color: "var(--fl-primary)",
            pointerEvents: "none",
            filter: "drop-shadow(0 4px 8px rgba(var(--fl-primary-rgb), 0.45))",
            animation: `${placeBelow ? "tour-arrow-up" : "tour-arrow-down"} 1.1s ease-in-out infinite`,
            transition: "left 0.42s ease, top 0.42s ease",
          }}
        >
          {placeBelow ? (
            <KeyboardArrowUpRoundedIcon sx={{ fontSize: 40 }} />
          ) : (
            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 40 }} />
          )}
        </Box>
      )}

      {/* Tooltip card — always fully inside the viewport so its buttons stay clickable. */}
      <Box
        key={index}
        ref={tooltipRef}
        sx={{
          position: "absolute",
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "calc(100dvh - 24px)",
          overflowY: "auto",
          pointerEvents: "auto",
          backgroundColor: "var(--fl-surface)",
          border: "1px solid var(--fl-border)",
          borderRadius: "1rem",
          boxShadow: "0 1.2rem 2.8rem rgba(15, 17, 23, 0.32)",
          p: 2,
          animation: "tour-pop 0.32s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Pointer nub toward the element */}
        {spot && (
          <Box
            sx={{
              position: "absolute",
              left: arrowLeft,
              [placeBelow ? "top" : "bottom"]: -7,
              width: 14,
              height: 14,
              backgroundColor: "var(--fl-surface)",
              borderLeft: "1px solid var(--fl-border)",
              borderTop: "1px solid var(--fl-border)",
              transform: `translateX(-50%) rotate(${placeBelow ? 45 : 225}deg)`,
            }}
          />
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
          <DragonAvatar size={34} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fl-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Step {index + 1} of {steps.length}
            </Box>
            <Box sx={{ fontSize: "1rem", fontWeight: 800, color: "var(--fl-text)", lineHeight: 1.25 }}>
              {step.title}
            </Box>
          </Box>
          <Box
            role="button"
            aria-label="Close tour"
            onClick={finish}
            sx={{
              display: "flex",
              cursor: "pointer",
              color: "var(--fl-text-muted)",
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "flex-end",
              "&:hover": { color: "var(--fl-text-minor)" },
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </Box>
        </Box>

        <Box sx={{ fontSize: "0.86rem", color: "var(--fl-text-minor)", lineHeight: 1.55 }}>
          {step.body}
        </Box>

        {/* Progress dots */}
        <Box sx={{ display: "flex", gap: 0.75, mt: 1.75, mb: 1.5 }}>
          {steps.map((s, i) => (
            <Box
              key={s.id}
              onClick={() => setIndex(i)}
              sx={{
                height: 6,
                flexGrow: i === index ? 1 : 0,
                width: i === index ? "auto" : 6,
                minWidth: 6,
                borderRadius: 99,
                cursor: "pointer",
                backgroundColor: i === index ? "var(--fl-primary)" : "var(--fl-border-strong)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Button
            size="small"
            onClick={finish}
            sx={{ textTransform: "none", fontWeight: 600, color: "var(--fl-text-muted)", minHeight: 44 }}
          >
            Skip
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            {!isFirst && (
              <Button
                size="small"
                onClick={back}
                sx={{ textTransform: "none", fontWeight: 600, color: "var(--fl-text-minor)", minHeight: 44 }}
              >
                Back
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              disableElevation
              onClick={next}
              sx={{
                backgroundColor: "var(--fl-primary)",
                color: "var(--fl-on-primary)",
                textTransform: "none",
                fontWeight: 700,
                borderRadius: "0.55rem",
                px: 2,
                minHeight: 44,
                "&:hover": { backgroundColor: "var(--fl-primary-dark)" },
              }}
            >
              {isLast ? "Got it!" : "Next"}
            </Button>
          </Box>
        </Box>

        {/* Opt out of every guide — for returning users who don't want tips. */}
        <Box sx={{ textAlign: "center", mt: 0.5 }}>
          <Button
            size="small"
            onClick={skipAll}
            sx={{
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.72rem",
              color: "var(--fl-text-muted)",
              "&:hover": { color: "var(--fl-text-minor)", backgroundColor: "transparent" },
            }}
          >
            Don't show me guides again
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return createPortal(overlay, document.body);
}

export default GuideTour;
