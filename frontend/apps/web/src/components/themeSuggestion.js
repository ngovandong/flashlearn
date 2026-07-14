import React, { useEffect, useState } from "react";
import { Box, Button, IconButton, Slide, Tooltip } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import { useNavigate } from "react-router-dom";
import { useAppTheme } from "@app/themeContext";
import { DEFAULT_MODE, DEFAULT_PALETTE, PALETTE_MAP } from "@constants/themes";

const DISMISS_KEY = "flashlearn_theme_suggestion_dismissed_at";
// Don't nag: stay hidden for ~2 months after the user dismisses it.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REVEAL_DELAY_MS = 1800;

// A small, harmonious spread of palettes to preview in the popup.
const SHOWCASE = ["indigo", "emerald", "ocean", "aurora", "rose", "tangerine"];

function isDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function ThemeSuggestion() {
  const { mode, palette, setPalette } = useAppTheme();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);

  // No need to suggest if they've already personalized their theme.
  const alreadyCustomized = palette !== DEFAULT_PALETTE || mode !== DEFAULT_MODE;

  useEffect(() => {
    if (isDismissed() || alreadyCustomized) return undefined;
    const timer = setTimeout(() => setShow(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage failures (private mode etc.)
    }
    setClosed(true);
  };

  const handleCustomize = () => {
    dismiss();
    navigate("/settings");
  };

  const open = show && !closed;

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: "relative",
          width: { xs: "100%", sm: 340 },
          pointerEvents: "auto",
          p: 2,
          borderRadius: "0.9rem",
          backgroundColor: "var(--fl-surface)",
          border: "1px solid var(--fl-border)",
          boxShadow: "0 0.75rem 2rem rgba(40, 46, 62, 0.18)",
          overflow: "hidden",
        }}
      >
        <IconButton
          size="small"
          onClick={dismiss}
          aria-label="Dismiss"
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            color: "var(--fl-text-muted)",
            "&:hover": { color: "var(--fl-text-minor)" },
          }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", pr: 2 }}>
          <Box
            sx={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--fl-gradient)",
              color: "var(--fl-on-primary)",
            }}
          >
            <PaletteOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Box
              sx={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--fl-text)",
                lineHeight: 1.3,
              }}
            >
              Make FlashLearn yours
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: "0.8rem",
                color: "var(--fl-text-minor)",
                lineHeight: 1.4,
              }}
            >
              Pick a color theme or switch to dark mode — try one below.
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          {SHOWCASE.map((id) => {
            const p = PALETTE_MAP[id];
            if (!p) return null;
            const selected = palette === id;
            return (
              <Tooltip key={id} title={p.name}>
                <Box
                  role="button"
                  aria-label={`Use ${p.name} theme`}
                  onClick={() => setPalette(id)}
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    cursor: "pointer",
                    backgroundImage: `linear-gradient(135deg, ${p.gradient[0]} 0%, ${p.gradient[1]} 100%)`,
                    boxShadow: selected
                      ? "0 0 0 2px var(--fl-surface), 0 0 0 4px var(--fl-primary)"
                      : "inset 0 0 0 1px rgba(0,0,0,0.08)",
                    transition: "transform 0.15s ease",
                    "&:hover": { transform: "scale(1.12)" },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.75 }}>
          <Button
            size="small"
            onClick={dismiss}
            sx={{ color: "var(--fl-text-minor)", textTransform: "none", fontWeight: 600 }}
          >
            Maybe later
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleCustomize}
            disableElevation
            sx={{
              backgroundColor: "var(--fl-primary)",
              color: "var(--fl-on-primary)",
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "0.5rem",
              "&:hover": { backgroundColor: "var(--fl-primary-dark)" },
            }}
          >
            Customize
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}

export default ThemeSuggestion;
