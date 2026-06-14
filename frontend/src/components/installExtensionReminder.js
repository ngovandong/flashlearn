import React, { useState } from "react";
import { Box, Button, IconButton, Slide } from "@mui/material";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useExtensionInstalled } from "@hooks/useExtensionInstalled";
import { EXTENSION_STORE_URL } from "@constants/extension";

const DISMISS_KEY = "flashlearn_ext_reminder_dismissed_at";
// Re-surface the reminder a week after the user dismisses it.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function InstallExtensionReminder() {
  const installed = useExtensionInstalled();
  const [dismissed, setDismissed] = useState(isDismissed);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage failures (private mode etc.)
    }
    setDismissed(true);
  };

  const handleInstall = () => {
    // Browsers no longer allow forced/inline installs, so we open the Chrome
    // Web Store listing where the user clicks "Add to Chrome".
    window.open(EXTENSION_STORE_URL, "_blank", "noopener,noreferrer");
  };

  const show = installed === false && !dismissed;

  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: "relative",
          width: { xs: "100%", sm: 320 },
          pointerEvents: "auto",
          p: 2,
          borderRadius: "0.75rem",
          backgroundColor: "var(--fl-surface)",
          border: "1px solid rgba(var(--fl-primary-rgb), 0.16)",
          boxShadow: "0 0.75rem 2rem rgba(40, 46, 62, 0.16)",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            background: "var(--fl-gradient)",
          },
        }}
      >
        <IconButton
          size="small"
          onClick={handleDismiss}
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
            <ExtensionOutlinedIcon fontSize="small" />
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
              Install the FlashLearn extension
            </Box>
            <Box
              sx={{
                mt: 0.5,
                fontSize: "0.8rem",
                color: "var(--fl-text-minor)",
                lineHeight: 1.4,
              }}
            >
              Translate and save words from any webpage while you browse.
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
          <Button
            size="small"
            onClick={handleDismiss}
            sx={{ color: "var(--fl-text-minor)", textTransform: "none", fontWeight: 600 }}
          >
            Not now
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleInstall}
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
            Install
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}

export default InstallExtensionReminder;
