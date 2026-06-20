import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditNoteIcon from "@mui/icons-material/EditNote";
import HistoryIcon from "@mui/icons-material/History";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HighlightAltIcon from "@mui/icons-material/HighlightAlt";

import { writingService } from "@api-services/writingService";
import { termService } from "@api-services/termService";
import { renderMarkedText } from "./writingMarks";
import ChatPanel from "./chatPanel";
import FreeFormPanel from "./freeFormPanel";
import VocabModal from "./vocabModal";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const FALLBACK_TOPICS = [
  "A Memorable Holiday",
  "The Benefits of Regular Exercise",
  "The Pros and Cons of Remote Work",
];
const SESSIONS_PER_PAGE = 8;

function errorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.errors) return typeof err.errors === "string" ? err.errors : fallback;
  return fallback;
}

// Speak text with the browser's speech synthesis (no backend TTS for writing).
function browserSpeak(text) {
  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

export default function WritingCoach() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { pathname } = useLocation();

  // The active tab is derived from the URL so each view is deep-linkable:
  //   /writing-coach          → practice
  //   /writing-coach/history  → history
  //   /writing-coach/:id      → reopen a saved session
  const view = pathname === "/writing-coach/history" ? "history" : "practice";

  // Setup.
  const [mode, setMode] = useState("chat");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B1");
  const [suggestedTopics, setSuggestedTopics] = useState([]);

  // Session lifecycle: "setup" | "compose" (free-form writing) | "chat" | "result".
  const [stage, setStage] = useState("setup");
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [busy, setBusy] = useState(false);

  // Chat.
  const [chatInput, setChatInput] = useState("");
  const [activeMessageId, setActiveMessageId] = useState(null);

  // Free-form.
  const [draft, setDraft] = useState("");
  const [support, setSupport] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);

  // Vocabulary popup + highlights.
  const [selected, setSelected] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [termMatches, setTermMatches] = useState([]);

  // History.
  const [history, setHistory] = useState({ sessions: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(0);

  const loadedTopicRef = useRef(null);

  // ── Suggested topics (setup) ───────────────────────────────────────────
  useEffect(() => {
    if (stage !== "setup") return;
    let cancelled = false;
    writingService
      .suggestTopics([], level)
      .then((res) => {
        if (!cancelled && res.data?.topics?.length) setSuggestedTopics(res.data.topics);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [level, stage]);

  // Keep a fresh ref so the loader can compare against the current session
  // without depending on `session` — otherwise resetting it (e.g. on restart)
  // re-triggers the loader against the stale :id URL and the spinner gets stuck.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // ── Load a saved session from the URL ──────────────────────────────────
  useEffect(() => {
    if (view !== "practice" || !routeId || sessionRef.current?.id === routeId) return;
    let cancelled = false;
    setLoadingSession(true);
    writingService
      .getSession(routeId)
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data) {
          toast.error("Session not found.");
          navigate("/writing-coach");
          return;
        }
        const s = res.data;
        setSession(s);
        setMode(s.mode);
        if (s.topic) setTopic(s.topic);
        if (s.level) setLevel(s.level);
        setStage(s.mode === "freeform" ? "result" : "chat");
        setActiveMessageId(null);
        writingService.matchTerms(s.id).then((r) => {
          if (!cancelled && r.data?.matches) setTermMatches(r.data.matches);
        });
      })
      .finally(() => setLoadingSession(false));
    return () => {
      cancelled = true;
    };
  }, [routeId, view, navigate]);

  // Returning to the bare /writing-coach URL resets to setup.
  useEffect(() => {
    if (view === "practice" && !routeId && (stage === "chat" || stage === "result")) {
      setSession(null);
      setStage("setup");
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── History ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "history") return;
    setHistoryLoading(true);
    setSelectedIds([]);
    setPage(0);
    writingService
      .getHistory()
      .then((res) => setHistory({ sessions: res.data?.sessions || [] }))
      .finally(() => setHistoryLoading(false));
  }, [view]);

  // ── Vocabulary popup ─────────────────────────────────────────────────────
  const openVocab = useCallback(async (rawText, context) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    setNoteDraft("");
    setSelected({ text, context, loading: true });
    try {
      const [enrichRes, explainRes] = await Promise.all([
        termService.aiEnrich(text, ""),
        writingService.explainPhrase(text, context || ""),
      ]);
      setSelected((prev) =>
        prev && prev.text === text
          ? {
              ...prev,
              loading: false,
              fields: enrichRes.data || {},
              explain: explainRes.data || {},
            }
          : prev
      );
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Failed to load. Tap retry." } : prev
      );
    }
  }, []);

  const handleSelection = useCallback(
    (context) => {
      const text = window.getSelection?.()?.toString().trim();
      if (text) openVocab(text, context || "");
    },
    [openVocab]
  );

  // Open the vocabulary popup directly for a suggested word/phrase (no text
  // selection involved).
  const lookupWord = useCallback((text) => openVocab(text, ""), [openVocab]);

  const isHighlighted = useCallback(
    (text) =>
      (session?.highlights || []).some(
        (h) => (h.text || "").toLowerCase() === (text || "").toLowerCase()
      ),
    [session]
  );

  const toggleHighlight = async (remove = false) => {
    if (!session?.id || !selected?.text) return;
    const res = await writingService.setHighlight(session.id, {
      text: selected.text,
      note: noteDraft,
      remove,
    });
    if (res.error) {
      toast.error("Could not update highlight.");
      return;
    }
    const highlights = res.data?.highlights || [];
    setSession((prev) => (prev ? { ...prev, highlights } : prev));
    toast.success(remove ? "Highlight removed." : "Saved to this session.");
  };

  const saveSelectionAsTerm = async () => {
    if (!selected?.fields) return;
    const res = await termService.addToDefaultDeck({
      name: selected.text,
      meaning: selected.explain?.meaning || "",
      ...selected.fields,
      ai_filled: true,
    });
    if (res.error) {
      toast.error(errorMessage(res.error, "Could not save term."));
      return;
    }
    toast.success(`"${selected.text}" saved to your default deck.`);
    setSelected(null);
    if (session?.id) {
      writingService.matchTerms(session.id).then((r) => {
        if (r.data?.matches) setTermMatches(r.data.matches);
      });
    }
  };

  // Render text with saved-term underlines + user highlights (+ optional draft
  // corrections), wiring clicks back into the vocab/term flows.
  const renderText = useCallback(
    (text, extra = {}) =>
      renderMarkedText(text, {
        highlights: session?.highlights || [],
        termMatches,
        corrections: extra.corrections,
        onNoteClick: (segment, full) => openVocab(segment, full),
        onTermClick: (payload) => {
          const url = payload.deck_id
            ? `/deck/${payload.deck_id}/learn/${payload.term_id}`
            : `/learn/${payload.term_id}`;
          window.open(url, "_blank", "noopener");
        },
        onErrorClick: extra.onErrorClick,
      }),
    [session, termMatches, openVocab]
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  const startChat = async (chosenTopic) => {
    setBusy(true);
    try {
      const res = await writingService.startChat({ topic: chosenTopic ?? topic, level });
      if (res.error || !res.data) {
        toast.error(errorMessage(res.error, "Could not start the chat."));
        return;
      }
      const s = res.data;
      setSession(s);
      setMode("chat");
      setStage("chat");
      setActiveMessageId(null);
      setChatInput("");
      setTermMatches([]);
      navigate(`/writing-coach/${s.id}`);
      const opening = (s.messages || []).find((m) => m.role === "assistant");
      if (opening) browserSpeak(opening.text);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!session?.id || !chatInput.trim() || busy) return;
    setBusy(true);
    try {
      const res = await writingService.sendMessage(session.id, chatInput.trim());
      if (res.error || !res.data) {
        toast.error(errorMessage(res.error, "Could not send your message."));
        return;
      }
      const s = res.data;
      setSession(s);
      setChatInput("");
      const lastUser = [...(s.messages || [])].reverse().find((m) => m.role === "user");
      if (lastUser) setActiveMessageId(lastUser.id);
      const lastDragon = [...(s.messages || [])].reverse().find((m) => m.role === "assistant");
      if (lastDragon) browserSpeak(lastDragon.text);
      writingService.matchTerms(s.id).then((r) => {
        if (r.data?.matches) setTermMatches(r.data.matches);
      });
    } finally {
      setBusy(false);
    }
  };

  const loadSupport = useCallback((forTopic, forLevel) => {
    if (!forTopic) return;
    if (loadedTopicRef.current === `${forTopic}|${forLevel}`) return;
    loadedTopicRef.current = `${forTopic}|${forLevel}`;
    setSupportLoading(true);
    setSupport(null);
    writingService
      .writingSupport(forTopic, forLevel)
      .then((res) => setSupport(res.data || {}))
      .catch(() => setSupport({}))
      .finally(() => setSupportLoading(false));
  }, []);

  const beginCompose = (chosenTopic) => {
    const t = chosenTopic ?? topic;
    if (!t.trim()) {
      toast.info("Pick or type a topic first.");
      return;
    }
    setMode("freeform");
    setStage("compose");
    setDraft("");
    setSession(null);
    setTermMatches([]);
    loadSupport(t, level);
  };

  const submitDraft = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const res = await writingService.submitDraft({ topic, draft: draft.trim(), level });
      if (res.error || !res.data) {
        toast.error(errorMessage(res.error, "Could not assess your writing."));
        return;
      }
      const s = res.data;
      setSession(s);
      setStage("result");
      navigate(`/writing-coach/${s.id}`);
      writingService.matchTerms(s.id).then((r) => {
        if (r.data?.matches) setTermMatches(r.data.matches);
      });
    } finally {
      setBusy(false);
    }
  };

  const restartChat = () => startChat(session?.topic || topic);

  const restartFreeform = () => {
    const t = session?.topic || topic;
    setSession(null);
    setStage("compose");
    setDraft("");
    setTermMatches([]);
    navigate("/writing-coach");
    loadedTopicRef.current = null;
    loadSupport(t, level);
  };

  const goPractice = () => {
    setSession(null);
    setStage("setup");
    navigate("/writing-coach");
  };

  // ── History actions ──────────────────────────────────────────────────────
  const toggleStar = async (s) => {
    const res = await writingService.setStar(s.id, !s.starred);
    if (res.error) return;
    setHistory((prev) => ({
      sessions: prev.sessions
        .map((x) => (x.id === s.id ? { ...x, starred: res.data.starred } : x))
        .sort((a, b) => Number(b.starred) - Number(a.starred)),
    }));
  };

  const deleteOne = async (s) => {
    const res = await writingService.deleteSession(s.id);
    if (res.error) {
      toast.error("Could not delete session.");
      return;
    }
    setHistory((prev) => ({ sessions: prev.sessions.filter((x) => x.id !== s.id) }));
    setSelectedIds((prev) => prev.filter((id) => id !== s.id));
  };

  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    const res = await writingService.bulkDeleteSessions(selectedIds);
    if (res.error) {
      toast.error("Could not delete sessions.");
      return;
    }
    setHistory((prev) => ({ sessions: prev.sessions.filter((x) => !selectedIds.includes(x.id)) }));
    setSelectedIds([]);
  };

  const reopen = (s) => {
    setSession(s);
    setMode(s.mode);
    setStage(s.mode === "freeform" ? "result" : "chat");
    setActiveMessageId(null);
    navigate(`/writing-coach/${s.id}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const sortedSessions = [...(history.sessions || [])].sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) ||
      new Date(b.created_at) - new Date(a.created_at)
  );
  const pageCount = Math.max(1, Math.ceil(sortedSessions.length / SESSIONS_PER_PAGE));
  const pageSessions = sortedSessions.slice(page * SESSIONS_PER_PAGE, (page + 1) * SESSIONS_PER_PAGE);

  return (
    <div className="wc-page">
      <div className="wc-topbar">
        <button className="wc-icon-btn" onClick={() => navigate("/")} title="Back home">
          <ArrowBackIcon fontSize="small" />
        </button>
        <div className="wc-title">
          <EditNoteIcon />
          <h1>Writing Coach</h1>
        </div>
        <div className="wc-tabs" data-tour="wc-tabs">
          <button
            className={view === "practice" ? "active" : ""}
            onClick={goPractice}
          >
            <EditNoteIcon fontSize="small" /> Practice
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => navigate("/writing-coach/history")}
          >
            <HistoryIcon fontSize="small" /> History
          </button>
        </div>
      </div>

      {view === "history" ? (
        <div className="wc-history">
          {historyLoading ? (
            <div className="wc-center">
              <div className="wc-spinner" />
              <p>Loading your sessions…</p>
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="wc-center wc-empty">
              <HistoryIcon />
              <p>No saved sessions yet. Start practicing to build your history.</p>
              <button className="wc-btn wc-btn--primary" onClick={goPractice}>
                Start writing
              </button>
            </div>
          ) : (
            <>
              {selectedIds.length > 0 && (
                <div className="wc-history__bulk">
                  <span>{selectedIds.length} selected</span>
                  <button className="wc-btn wc-btn--danger wc-btn--sm" onClick={bulkDelete}>
                    <DeleteOutlineIcon fontSize="small" /> Delete
                  </button>
                </div>
              )}
              <ul className="wc-history__list">
                {pageSessions.map((s) => (
                  <li key={s.id} className="wc-history__row">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )
                      }
                    />
                    <span className={`wc-tag wc-tag--${s.mode}`}>
                      {s.mode === "chat" ? <ChatBubbleOutlineIcon fontSize="inherit" /> : <ArticleOutlinedIcon fontSize="inherit" />}
                      {s.mode === "chat" ? "Chat" : "Free-form"}
                    </span>
                    <span className="wc-history__topic">{s.topic || "Untitled"}</span>
                    {s.mode === "freeform" && s.feedback?.overallBand ? (
                      <span className="wc-history__band">Band {s.feedback.overallBand}</span>
                    ) : (
                      s.mode === "chat" && (
                        <span className="wc-history__meta">
                          {(s.messages || []).filter((m) => m.role === "user").length} replies
                        </span>
                      )
                    )}
                    {s.level && <span className="wc-history__level">{s.level}</span>}
                    <button className="wc-icon-btn wc-icon-btn--sm" onClick={() => toggleStar(s)} title="Star">
                      {s.starred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </button>
                    <button className="wc-btn wc-btn--ghost wc-btn--sm" onClick={() => reopen(s)}>
                      Reopen
                    </button>
                    <button className="wc-icon-btn wc-icon-btn--sm" onClick={() => deleteOne(s)} title="Delete">
                      <DeleteOutlineIcon fontSize="small" />
                    </button>
                  </li>
                ))}
              </ul>
              {pageCount > 1 && (
                <div className="wc-history__pager">
                  <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </button>
                  <span>
                    {page + 1} / {pageCount}
                  </span>
                  <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : loadingSession ? (
        <div className="wc-center">
          <div className="wc-spinner" />
          <p>Loading your session…</p>
        </div>
      ) : stage === "setup" ? (
        <div className="wc-setup">
          <div className="wc-setup__card" data-tour="wc-setup">
            <span className="wc-chat__eyebrow">What would you like to practice?</span>
            <h2>Choose a topic</h2>
            <input
              className="wc-setup__topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Type your own topic, or pick one below…"
            />
            <div className="wc-suggestions">
              {(suggestedTopics.length ? suggestedTopics : FALLBACK_TOPICS).map((t) => (
                <button
                  key={t}
                  className={topic === t ? "active" : ""}
                  onClick={() => setTopic(t)}
                >
                  <AutoAwesomeIcon fontSize="inherit" /> {t}
                </button>
              ))}
            </div>

            <div className="wc-setup__level">
              <span className="wc-section-label">Your level (CEFR)</span>
              <div className="wc-level-row">
                {LEVELS.map((l) => (
                  <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="wc-mode-toggle" data-tour="wc-mode">
              <button
                className={`wc-mode-card ${mode === "chat" ? "active" : ""}`}
                onClick={() => setMode("chat")}
              >
                <ChatBubbleOutlineIcon />
                <strong>Chat mode</strong>
                <span>Talk with Dragon and get feedback on every message.</span>
              </button>
              <button
                className={`wc-mode-card ${mode === "freeform" ? "active" : ""}`}
                onClick={() => setMode("freeform")}
              >
                <ArticleOutlinedIcon />
                <strong>Free-form mode</strong>
                <span>Write a full piece and get an IELTS-style band score.</span>
              </button>
            </div>

            <p className="wc-setup__hint" data-tour="wc-vocab">
              <HighlightAltIcon fontSize="small" /> Tip: select any word or phrase later to see its
              meaning and save it to a deck.
            </p>

            <button
              className="wc-btn wc-btn--primary wc-btn--lg"
              disabled={busy || !topic.trim()}
              onClick={() => (mode === "chat" ? startChat() : beginCompose())}
            >
              {busy
                ? "Starting…"
                : mode === "chat"
                ? "Start chatting"
                : "Start writing"}
            </button>
          </div>
        </div>
      ) : mode === "chat" ? (
        <ChatPanel
          session={session}
          activeMessageId={activeMessageId}
          onSelectMessage={setActiveMessageId}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={sendMessage}
          sending={busy}
          onRestart={restartChat}
          onSpeak={browserSpeak}
          renderText={renderText}
          onSelectText={handleSelection}
        />
      ) : (
        <FreeFormPanel
          stage={stage}
          topic={topic}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={submitDraft}
          submitting={busy}
          support={support}
          supportLoading={supportLoading}
          session={session}
          onRestart={restartFreeform}
          renderText={renderText}
          onSelectText={handleSelection}
          onLookup={lookupWord}
        />
      )}

      <VocabModal
        selected={selected}
        canHighlight={!!session?.id}
        isHighlighted={isHighlighted}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        onClose={() => setSelected(null)}
        onRetry={() => openVocab(selected?.text, selected?.context)}
        onListen={browserSpeak}
        onToggleHighlight={toggleHighlight}
        onSaveTerm={saveSelectionAsTerm}
      />
    </div>
  );
}
