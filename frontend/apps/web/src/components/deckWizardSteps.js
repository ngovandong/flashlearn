import React from "react";
import { Box } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

const STEPS = [
  { label: "Deck details", hint: "Name, description & cover" },
  { label: "Add terms", hint: "Build your flashcards" },
];

/**
 * Progress header for the new-deck flow.
 *
 * Creating terms needs a deck id (created in step 1), so the flow is inherently
 * two steps — this stepper makes that feel like one seamless journey. Pass the
 * active step index; earlier steps render as completed.
 */
function DeckWizardSteps({ active = 0 }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 2 },
        my: 2.5,
        userSelect: "none",
      }}
    >
      {STEPS.map((step, i) => {
        const state = i < active ? "done" : i === active ? "active" : "todo";
        return (
          <React.Fragment key={step.label}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                opacity: state === "todo" ? 0.65 : 1,
                transition: "opacity 0.2s ease",
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  transition: "all 0.25s ease",
                  color:
                    state === "todo" ? "var(--fl-text-muted)" : "var(--fl-on-primary)",
                  background:
                    state === "todo" ? "var(--fl-surface-2)" : "var(--fl-gradient)",
                  border:
                    state === "todo"
                      ? "1px solid var(--fl-border-strong)"
                      : "1px solid transparent",
                  boxShadow:
                    state === "active"
                      ? "0 0 0 4px rgba(var(--fl-primary-rgb), 0.16)"
                      : "none",
                }}
              >
                {state === "done" ? <CheckRoundedIcon fontSize="small" /> : i + 1}
              </Box>
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Box
                  sx={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: state === "active" ? "var(--fl-text)" : "var(--fl-text-minor)",
                  }}
                >
                  {step.label}
                </Box>
                <Box sx={{ fontSize: "0.74rem", color: "var(--fl-text-muted)" }}>
                  {step.hint}
                </Box>
              </Box>
            </Box>

            {i < STEPS.length - 1 && (
              <Box
                sx={{
                  flexGrow: 1,
                  height: 2,
                  borderRadius: 2,
                  minWidth: 24,
                  background:
                    i < active ? "var(--fl-primary)" : "var(--fl-border-strong)",
                  transition: "background 0.25s ease",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

export default DeckWizardSteps;
