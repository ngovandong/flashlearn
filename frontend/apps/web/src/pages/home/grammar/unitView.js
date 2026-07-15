import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HighlightAltIcon from "@mui/icons-material/HighlightAlt";
import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { grammarService } from "@api-services/grammarService";
import { termService } from "@api-services/termService";
import Exercise from "./exercise";
import VocabPopup from "./vocabPopup";
import { renderWithHighlights } from "./grammarMarks";

// Speak text with the browser's speech synthesis (no backend TTS needed here).
function browserSpeak(text) {
  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

// Small circular progress ring showing completed / total exercises for the unit.
function ProgressRing({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="gr-ring" aria-label={`${done} of ${total} exercises done`}>
      <svg viewBox="0 0 48 48" width="48" height="48">
        <circle className="gr-ring__track" cx="24" cy="24" r={r} fill="none" strokeWidth="5" />
        <circle
          className="gr-ring__fill"
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="gr-ring__label">
        {done}/{total}
      </span>
    </div>
  );
}

export default function UnitView({ unitKey }) {
  const navigate = useNavigate();
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  // Local per-exercise completion state so the ring updates immediately after a
  // pass without a full refetch.
  const [doneKeys, setDoneKeys] = useState(() => new Set());
  // Bumped when results are cleared so every Exercise remounts with fresh state.
  const [resetNonce, setResetNonce] = useState(0);
  const [clearing, setClearing] = useState(false);

  // Vocabulary popup + this unit's saved highlights.
  const [highlights, setHighlights] = useState([]);
  const [selected, setSelected] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUnit(null);
    window.scrollTo({ top: 0 });
    grammarService
      .getUnit(unitKey)
      .then((res) => {
        if (!active) return;
        setUnit(res.data);
        setHighlights(res.data.progress?.highlights || []);
        setSelected(null);
        const initial = new Set(
          (res.data.exercises || [])
            .filter((e) => e.progress?.status === "completed")
            .map((e) => e.key)
        );
        setDoneKeys(initial);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [unitKey]);

  // ── Vocabulary popup + highlights ──────────────────────────────────────
  const openVocab = useCallback(async (rawText) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    setNoteDraft("");
    setSelected({ text, loading: true });
    try {
      const res = await termService.aiEnrich(text, "");
      setSelected((prev) => (prev && prev.text === text ? { ...prev, loading: false, fields: res.data || {} } : prev));
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Couldn't load. Tap retry." } : prev
      );
    }
  }, []);

  const handleSelection = useCallback(() => {
    const text = window.getSelection?.()?.toString().trim();
    if (text) openVocab(text);
  }, [openVocab]);

  const isHighlighted = useCallback(
    (text) => highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase()),
    [highlights]
  );

  const toggleHighlight = async (remove = false) => {
    if (!unit?.key || !selected?.text) return;
    const res = await grammarService.setHighlight(unit.key, { text: selected.text, note: noteDraft, remove });
    if (res.error) {
      toast.error("Could not update highlight.");
      return;
    }
    setHighlights(res.data?.highlights || []);
    toast.success(remove ? "Highlight removed." : "Highlight saved.");
    if (remove) setSelected(null);
  };

  const saveTerm = async () => {
    if (!selected?.fields) return;
    setSaving(true);
    try {
      const res = await termService.addToDefaultDeck({
        name: selected.text,
        meaning: selected.fields?.definition || "",
        ...selected.fields,
        ai_filled: true,
      });
      if (res.error) {
        toast.error("Could not save term.");
        return;
      }
      toast.success(`"${selected.text}" saved to your default deck.`);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !unit) {
    return (
      <div className="sc-loading gr-loading">
        <div className="sc-spinner" />
        <h4>Loading unit…</h4>
      </div>
    );
  }

  if (!unit) {
    return <div className="gr-empty">This unit could not be found.</div>;
  }

  const total = unit.exercises?.length || 0;
  const done = unit.exercises?.filter((e) => doneKeys.has(e.key)).length || 0;

  const onGraded = (exerciseKey) => (res) => {
    setDoneKeys((prev) => {
      const next = new Set(prev);
      if (res.completed) next.add(exerciseKey);
      else next.delete(exerciseKey);
      return next;
    });
  };

  const hasResults = (unit.exercises || []).some(
    (e) =>
      e.progress?.status === "completed" ||
      (e.progress?.best_score || 0) > 0 ||
      (e.progress?.last_result?.results || []).length > 0
  );

  const handleClearResults = async () => {
    if (!unit?.key || clearing) return;
    setClearing(true);
    try {
      const res = await grammarService.clearUnitProgress(unit.key);
      if (res.error) {
        toast.error("Could not clear results.");
        return;
      }
      const fresh = await grammarService.getUnit(unit.key);
      if (!fresh.error) setUnit(fresh.data);
      setDoneKeys(new Set());
      setResetNonce((n) => n + 1);
      toast.success("Lesson results cleared.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="gr-unit" data-tour="grammar-unit">
      <div className="gr-unit__head">
        <div className="gr-unit__title">
          <span className="gr-unit__num">{unit.number > 0 ? `Unit ${unit.number}` : "Practice"}</span>
          <h2>{unit.title}</h2>
          <p className="gr-unit__crumb">
            {unit.book.title} · {unit.section.title}
          </p>
        </div>
        <ProgressRing done={done} total={total} />
      </div>

      {(unit.explanation?.length > 0 || highlights.length > 0) && (
      <section className="gr-explain-card" data-tour="grammar-explanation" onMouseUp={handleSelection}>
        <div className="gr-explain-card__head">
          <h3 className="gr-explain-card__title">Grammar</h3>
          <span className="gr-explain-card__hint">
            <HighlightAltIcon fontSize="inherit" /> Select any word or phrase to save or highlight it
          </span>
        </div>
        {(unit.explanation || []).map((block, i) => (
          <div key={i} className="gr-block">
            {block.label && <span className="gr-block__label">{block.label}</span>}
            <div className="gr-block__body">
              {block.html && (
                <div className="gr-block__text" dangerouslySetInnerHTML={{ __html: block.html }} />
              )}
              {block.examples?.length > 0 && (
                <ul className="gr-block__examples">
                  {block.examples.map((ex, k) => (
                    <li key={k}>{renderWithHighlights(ex, highlights, openVocab)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {highlights.length > 0 && (
          <div className="gr-highlights">
            <span className="gr-highlights__title">Your highlights</span>
            <ul className="gr-highlights__list">
              {highlights.map((h, i) => (
                <li key={i} className="gr-highlights__chip">
                  <button type="button" className="gr-highlights__text" onClick={() => openVocab(h.text)}>
                    {h.text}
                  </button>
                  <button
                    type="button"
                    className="gr-highlights__remove"
                    aria-label={`Remove highlight ${h.text}`}
                    onClick={() =>
                      grammarService
                        .setHighlight(unit.key, { text: h.text, remove: true })
                        .then((res) => !res.error && setHighlights(res.data?.highlights || []))
                    }
                  >
                    <CloseIcon fontSize="inherit" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      )}

      {total > 0 && (
        <div className="gr-ex-list__head">
          <h3 className="gr-ex-list__title">Practice</h3>
          {hasResults && (
            <button
              type="button"
              className="sc-btn sc-btn--ghost gr-clear-results"
              onClick={handleClearResults}
              disabled={clearing}
            >
              <RestartAltIcon fontSize="small" /> {clearing ? "Clearing…" : "Clear results"}
            </button>
          )}
        </div>
      )}

      <div className="gr-ex-list" data-tour="grammar-exercises">
        {(unit.exercises || []).map((exercise) => (
          <Exercise
            key={`${exercise.key}:${resetNonce}`}
            exercise={exercise}
            unitTitle={unit.title}
            onGraded={onGraded(exercise.key)}
          />
        ))}
        {total === 0 && <p className="gr-empty">No exercises in this unit yet.</p>}
      </div>

      <nav className="gr-unit__nav">
        <button
          type="button"
          className="sc-btn sc-btn--ghost"
          disabled={!unit.prev_key}
          onClick={() => unit.prev_key && navigate(`/grammar/${unit.prev_key}`)}
        >
          <ArrowBackIcon fontSize="small" /> Previous
        </button>
        {done >= total && total > 0 && (
          <span className="gr-unit__complete">
            <CheckCircleIcon fontSize="small" /> Unit complete
          </span>
        )}
        <button
          type="button"
          className="sc-btn sc-btn--primary"
          disabled={!unit.next_key}
          onClick={() => unit.next_key && navigate(`/grammar/${unit.next_key}`)}
        >
          Next <ArrowForwardIcon fontSize="small" />
        </button>
      </nav>

      <VocabPopup
        selected={selected}
        isHighlighted={isHighlighted}
        noteDraft={noteDraft}
        onNoteChange={setNoteDraft}
        onClose={() => setSelected(null)}
        onRetry={() => openVocab(selected?.text)}
        onListen={browserSpeak}
        onToggleHighlight={toggleHighlight}
        onSaveTerm={saveTerm}
        saving={saving}
      />
    </div>
  );
}
