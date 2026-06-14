import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Button } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import DragonAvatar from "./dragonAvatar";

const TOOLTIP_WIDTH = 312;
const SPOT_PAD = 10; // breathing room around the highlighted element
const GAP = 22; // distance between the element and the tooltip card

function measureRect(selector) {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return r;
}

function GuideTour({ open, onClose, onStepDone, onSkipAll, steps = [] }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = steps[index];

  const sync = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
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
    // If the target genuinely doesn't exist on this page/role, skip the step
    // rather than showing a confusing centered tooltip.
    const skip = setTimeout(() => {
      if (step && !document.querySelector(step.selector)) {
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

  // ---- geometry --------------------------------------------------------------
  let spot = null;
  let placeBelow = true;
  let tooltipTop = vh / 2 - 90;
  let tooltipLeft = vw / 2 - TOOLTIP_WIDTH / 2;
  let arrowLeft = TOOLTIP_WIDTH / 2;

  if (rect) {
    spot = {
      top: rect.top - SPOT_PAD,
      left: rect.left - SPOT_PAD,
      width: rect.width + SPOT_PAD * 2,
      height: rect.height + SPOT_PAD * 2,
    };
    const centerX = rect.left + rect.width / 2;
    placeBelow = rect.top + rect.height / 2 < vh / 2;
    tooltipLeft = Math.min(
      Math.max(12, centerX - TOOLTIP_WIDTH / 2),
      vw - TOOLTIP_WIDTH - 12
    );
    tooltipTop = placeBelow
      ? rect.bottom + GAP + 14
      : rect.top - GAP - 14; // bottom-anchored; translateY(-100%) applied below
    arrowLeft = Math.min(
      Math.max(22, centerX - tooltipLeft),
      TOOLTIP_WIDTH - 22
    );
  }

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
            top: placeBelow ? spot.top + spot.height + 2 : spot.top - 40,
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

      {/* Tooltip card */}
      <Box
        key={index}
        sx={{
          position: "absolute",
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
          maxWidth: "calc(100vw - 24px)",
          transform: rect && !placeBelow ? "translateY(-100%)" : "none",
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
        {rect && (
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
            sx={{ textTransform: "none", fontWeight: 600, color: "var(--fl-text-muted)" }}
          >
            Skip
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            {!isFirst && (
              <Button
                size="small"
                onClick={back}
                sx={{ textTransform: "none", fontWeight: 600, color: "var(--fl-text-minor)" }}
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
