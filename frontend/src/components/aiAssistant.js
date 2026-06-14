import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@app/store/authSlice";
import {
  Box,
  Divider,
  Fab,
  Grow,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import DragonAvatar from "./dragonAvatar";
import { useTour } from "./tourProvider";

const ASSISTANT_NAME = "Dragon";

const FAB_SIZE = 64;
const EDGE_MARGIN = 16;
const PANEL_W = 360;
const PANEL_H = 480;
const PANEL_GAP = 16;

const POS_KEY = "flashlearn_dragon_pos_v1";
const HIDE_KEY = "flashlearn_dragon_hidden_until_v1";

const HIDE_OPTIONS = [
  { label: "15 minutes", ms: 15 * 60 * 1000 },
  { label: "30 minutes", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function readPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function writePos(p) {
  try {
    if (p) localStorage.setItem(POS_KEY, JSON.stringify(p));
    else localStorage.removeItem(POS_KEY);
  } catch {
    /* ignore */
  }
}

function readHiddenUntil() {
  try {
    return Number(localStorage.getItem(HIDE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeHiddenUntil(ts) {
  try {
    if (ts) localStorage.setItem(HIDE_KEY, String(ts));
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    /* ignore */
  }
}

const WELCOME_TEXT =
  `Hi, I'm ${ASSISTANT_NAME} — your Flashlearn study buddy! 🐉 ` +
  `I can help you create decks, learn, revise, and more. ` +
  `Want a quick tour of what you can do here?`;

let messageId = 0;
const nextId = () => {
  messageId += 1;
  return messageId;
};

/**
 * Placeholder reply generator.
 *
 * TODO(ai-infra): wire this to the real AI backend. The assistant should be able
 * to call Flashlearn webpage functions (create/clone deck, start learn/revise/
 * quick-revise, number listening, open settings) on the user's behalf.
 */
async function requestAiReply() {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return (
    "I'm still learning to chat! 🐲 My smart replies are coming soon. " +
    "Meanwhile, tap “Show me the guide” and I'll walk you through everything Flashlearn can do."
  );
}

function MessageBubble({ role, children }) {
  const isUser = role === "user";
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        gap: 0.75,
        alignItems: "flex-end",
      }}
    >
      {!isUser && (
        <Box sx={{ flexShrink: 0 }}>
          <DragonAvatar size={26} />
        </Box>
      )}
      <Box
        sx={{
          maxWidth: "78%",
          px: 1.5,
          py: 1,
          borderRadius: isUser ? "0.9rem 0.9rem 0.2rem 0.9rem" : "0.9rem 0.9rem 0.9rem 0.2rem",
          fontSize: "0.84rem",
          lineHeight: 1.45,
          color: isUser ? "var(--fl-on-primary)" : "var(--fl-text)",
          background: isUser ? "var(--fl-primary)" : "var(--fl-surface-2)",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function TypingDots() {
  return (
    <Box sx={{ display: "flex", gap: 0.5, py: 0.5 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "var(--fl-text-muted)",
            animation: "dragon-typing 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </Box>
  );
}

function AiAssistant() {
  const user = useSelector(selectUser);
  const { startTour } = useTour();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: nextId(), role: "assistant", text: WELCOME_TEXT, showGuideButton: true },
  ]);
  const scrollRef = useRef(null);

  const [pos, setPos] = useState(() => readPos());
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState(null);
  const [hiddenUntil, setHiddenUntil] = useState(() => readHiddenUntil());
  const dragRef = useRef(null);
  const justDraggedRef = useRef(false);
  const fabRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, open]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const hidden = hiddenUntil > Date.now();
  useEffect(() => {
    if (!hidden) return undefined;
    const t = setTimeout(() => {
      writeHiddenUntil(0);
      setHiddenUntil(0);
    }, Math.max(0, hiddenUntil - Date.now()));
    return () => clearTimeout(t);
  }, [hidden, hiddenUntil]);

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    const nx = clamp(d.origX + dx, EDGE_MARGIN, window.innerWidth - FAB_SIZE - EDGE_MARGIN);
    const ny = clamp(d.origY + dy, EDGE_MARGIN, window.innerHeight - FAB_SIZE - EDGE_MARGIN);
    d.last = { x: nx, y: ny };
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (d && d.moved) {
      justDraggedRef.current = true;
      if (d.last) writePos(d.last);
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 50);
    }
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || !fabRef.current) return;
    const rect = fabRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      moved: false,
    };
    setDragging(true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const handleFabClick = () => {
    if (justDraggedRef.current) return;
    setOpen(true);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6 });
  };

  const hideFor = (ms) => {
    const until = Date.now() + ms;
    writeHiddenUntil(until);
    setHiddenUntil(until);
    setMenu(null);
    setOpen(false);
  };

  const resetPosition = () => {
    setPos(null);
    writePos(null);
    setMenu(null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setInput("");
    setTyping(true);
    const reply = await requestAiReply(text);
    setTyping(false);
    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: reply }]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Dragon is for signed-in users only — hide on public/auth pages.
  if (!user) return null;
  // Temporarily hidden via the right-click menu.
  if (hidden) return null;

  const fabLeft = pos
    ? clamp(pos.x, EDGE_MARGIN, vp.w - FAB_SIZE - EDGE_MARGIN)
    : vp.w - EDGE_MARGIN - FAB_SIZE;
  const fabTop = pos
    ? clamp(pos.y, EDGE_MARGIN, vp.h - FAB_SIZE - EDGE_MARGIN)
    : vp.h - EDGE_MARGIN - FAB_SIZE;

  const panelW = Math.min(PANEL_W, vp.w - 24);
  const panelH = Math.min(PANEL_H, vp.h - 120);
  const fabCenterX = fabLeft + FAB_SIZE / 2;
  const fabCenterY = fabTop + FAB_SIZE / 2;
  const anchorRight = fabCenterX > vp.w / 2;
  const openAbove = fabCenterY > vp.h / 2;
  const panelLeft = clamp(
    anchorRight ? fabLeft + FAB_SIZE - panelW : fabLeft,
    12,
    vp.w - panelW - 12
  );
  const panelTop = clamp(
    openAbove ? fabTop - PANEL_GAP - panelH : fabTop + FAB_SIZE + PANEL_GAP,
    12,
    vp.h - panelH - 12
  );
  const panelOrigin = `${anchorRight ? "right" : "left"} ${openAbove ? "bottom" : "top"}`;

  return (
    <>
      {/* Chat panel — fixed near the (possibly dragged) launcher */}
      <Grow in={open} unmountOnExit style={{ transformOrigin: panelOrigin }}>
        <Box
          sx={{
            position: "fixed",
            left: panelLeft,
            top: panelTop,
            width: panelW,
            height: panelH,
            zIndex: (theme) => theme.zIndex.snackbar + 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: "1.1rem",
            overflow: "hidden",
            backgroundColor: "var(--fl-surface)",
            border: "1px solid var(--fl-border)",
            boxShadow: "0 1rem 2.5rem rgba(40, 46, 62, 0.22)",
            "@keyframes dragon-typing": {
              "0%, 60%, 100%": { opacity: 0.3, transform: "translateY(0)" },
              "30%": { opacity: 1, transform: "translateY(-3px)" },
            },
          }}
        >
            {/* Header */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 2,
                py: 1.5,
                background:
                  "linear-gradient(135deg, rgba(var(--fl-primary-rgb), 0.16), rgba(var(--fl-accent-rgb), 0.12))",
                borderBottom: "1px solid var(--fl-border)",
              }}
            >
              <DragonAvatar size={40} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box sx={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--fl-text)" }}>
                  {ASSISTANT_NAME}
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontSize: "0.74rem",
                    color: "var(--fl-text-minor)",
                  }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: "#2fbf71",
                    }}
                  />
                  AI study buddy
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                sx={{ color: "var(--fl-text-muted)", "&:hover": { color: "var(--fl-text-minor)" } }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Messages */}
            <Box
              ref={scrollRef}
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                px: 2,
                py: 1.75,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                backgroundColor: "var(--fl-bg)",
              }}
            >
              {messages.map((m) => (
                <Box key={m.id} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <MessageBubble role={m.role}>{m.text}</MessageBubble>
                  {m.showGuideButton && (
                    <Box sx={{ pl: 4.25 }}>
                      <Box
                        role="button"
                        onClick={() => {
                          setOpen(false);
                          startTour("home", { all: true });
                        }}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          px: 1.5,
                          py: 0.85,
                          cursor: "pointer",
                          borderRadius: "0.7rem",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "var(--fl-on-primary)",
                          background: "var(--fl-gradient)",
                          transition: "transform 0.15s ease, filter 0.15s ease",
                          "&:hover": { filter: "brightness(1.05)", transform: "translateY(-1px)" },
                        }}
                      >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: "1rem" }} />
                        Show me the guide
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
              {typing && (
                <MessageBubble role="assistant">
                  <TypingDots />
                </MessageBubble>
              )}
            </Box>

            {/* Composer */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1.25,
                borderTop: "1px solid var(--fl-border)",
                backgroundColor: "var(--fl-surface)",
              }}
            >
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={3}
                placeholder={`Message ${ASSISTANT_NAME}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "1.1rem",
                    fontSize: "0.85rem",
                    backgroundColor: "var(--fl-surface-2)",
                    "& fieldset": { borderColor: "var(--fl-border)" },
                    "&:hover fieldset": { borderColor: "var(--fl-border-strong)" },
                    "&.Mui-focused fieldset": { borderColor: "var(--fl-primary)" },
                  },
                  "& .MuiInputBase-input": { color: "var(--fl-text)" },
                }}
              />
              <IconButton
                onClick={send}
                disabled={!input.trim() || typing}
                aria-label="Send message"
                sx={{
                  flexShrink: 0,
                  color: "var(--fl-on-primary)",
                  backgroundColor: "var(--fl-primary)",
                  "&:hover": { backgroundColor: "var(--fl-primary-dark)" },
                  "&.Mui-disabled": {
                    backgroundColor: "var(--fl-surface-2)",
                    color: "var(--fl-text-muted)",
                  },
                }}
              >
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
      </Grow>

      {/* Floating launcher — draggable + right-click menu */}
      {!open && (
        <Box
          sx={{
            position: "fixed",
            left: fabLeft,
            top: fabTop,
            zIndex: (theme) => theme.zIndex.snackbar + 1,
            "@keyframes dragon-bob": {
              "0%, 100%": { transform: "translateY(0)" },
              "50%": { transform: "translateY(-4px)" },
            },
          }}
        >
          <Tooltip
            title={dragging ? "" : `Chat with ${ASSISTANT_NAME} · drag to move · right-click for options`}
            placement={anchorRight ? "left" : "right"}
          >
            <Fab
              ref={fabRef}
              onClick={handleFabClick}
              onPointerDown={onPointerDown}
              onContextMenu={handleContextMenu}
              data-tour="assistant"
              aria-label={`Open ${ASSISTANT_NAME} chat`}
              sx={{
                width: FAB_SIZE,
                height: FAB_SIZE,
                p: 0,
                overflow: "hidden",
                touchAction: "none",
                cursor: dragging ? "grabbing" : "grab",
                backgroundColor: "var(--fl-surface)",
                border: "2px solid rgba(var(--fl-primary-rgb), 0.25)",
                boxShadow: "0 0.6rem 1.6rem rgba(224, 33, 138, 0.28)",
                "&:hover": { backgroundColor: "var(--fl-surface)" },
              }}
            >
              <DragonAvatar size={60} idleAnimation={!dragging} />
            </Fab>
          </Tooltip>
        </Box>
      )}

      {/* Right-click menu: temporarily hide / reset position */}
      <Menu
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.mouseY, left: menu.mouseX } : undefined}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "var(--fl-surface)",
              border: "1px solid var(--fl-border)",
              minWidth: 200,
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            pt: 1,
            pb: 0.5,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "var(--fl-text-muted)",
          }}
        >
          Hide {ASSISTANT_NAME} for…
        </Box>
        {HIDE_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.ms}
            onClick={() => hideFor(opt.ms)}
            sx={{ color: "var(--fl-text)" }}
          >
            <ListItemIcon sx={{ color: "var(--fl-text-muted)" }}>
              <VisibilityOffRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={opt.label} />
          </MenuItem>
        ))}
        {pos && <Divider sx={{ borderColor: "var(--fl-border)" }} />}
        {pos && (
          <MenuItem onClick={resetPosition} sx={{ color: "var(--fl-text)" }}>
            <ListItemIcon sx={{ color: "var(--fl-text-muted)" }}>
              <MyLocationRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Reset position" />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export default AiAssistant;
