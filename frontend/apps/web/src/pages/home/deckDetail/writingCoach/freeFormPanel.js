import React, { useState } from "react";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircle";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";

const BAND_LABELS = {
  taskResponse: "Task Response",
  coherence: "Coherence & Cohesion",
  lexical: "Lexical Resource",
  grammar: "Grammar",
};

const fmtBand = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
};

// Free-form mode: a compose stage (textarea + writing support) and a result
// stage (IELTS bands + inline-highlighted corrections). The parent owns the
// session + AI calls.
export default function FreeFormPanel({
  stage,
  topic,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  support,
  supportLoading,
  session,
  onRestart,
  renderText,
  onSelectText,
  onLookup,
}) {
  const [activeCorrection, setActiveCorrection] = useState(null);

  if (stage === "result" && session) {
    const fb = session.feedback || {};
    const bands = fb.bands || {};
    const corrections = fb.corrections || [];
    return (
      <div className="wc-free wc-free--result">
        <div className="wc-free__head">
          <div>
            <span className="wc-chat__eyebrow">Your writing on</span>
            <h2>{session.topic || "Free writing"}</h2>
          </div>
          <button className="wc-btn wc-btn--primary wc-btn--sm" onClick={onRestart}>
            <RestartAltIcon fontSize="small" /> Write a better version
          </button>
        </div>

        <div className="wc-free__result-grid">
          <div className="wc-free__draft-col">
            <span className="wc-section-label">Your draft</span>
            <div className="wc-free__draft" onMouseUp={() => onSelectText?.()}>
              {renderText
                ? renderText(session.draft || "", {
                    corrections,
                    onErrorClick: (c) => setActiveCorrection(c),
                  })
                : session.draft}
            </div>
            {activeCorrection && (
              <div className="wc-free__correction">
                <div className="wc-free__correction-row">
                  <span className="wc-mistake__wrong">{activeCorrection.text}</span>
                  <span className="wc-mistake__arrow">→</span>
                  <span className="wc-mistake__right">{activeCorrection.suggestion}</span>
                </div>
                {activeCorrection.issue && <p>{activeCorrection.issue}</p>}
              </div>
            )}
          </div>

          <div className="wc-free__scores-col">
            <div className="wc-band-overall">
              <span className="wc-section-label">Overall band</span>
              <span className="wc-band-overall__value">{fmtBand(fb.overallBand)}</span>
              <span className="wc-band-overall__scale">/ 9.0</span>
            </div>
            <div className="wc-band-grid">
              {Object.keys(BAND_LABELS).map((key) => (
                <div key={key} className="wc-band-card">
                  <span className="wc-band-card__value">{fmtBand(bands[key])}</span>
                  <span className="wc-band-card__label">{BAND_LABELS[key]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {fb.summary && (
          <div className="wc-free__block">
            <span className="wc-section-label">Examiner summary</span>
            <p onMouseUp={() => onSelectText?.()}>{fb.summary}</p>
          </div>
        )}

        <div className="wc-free__two-col">
          {(fb.strengths || []).length > 0 && (
            <div className="wc-free__block">
              <span className="wc-section-label">Strengths</span>
              <ul className="wc-bullets wc-bullets--good">
                {fb.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {(fb.improvements || []).length > 0 && (
            <div className="wc-free__block">
              <span className="wc-section-label">To improve</span>
              <ul className="wc-bullets wc-bullets--warn">
                {fb.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {corrections.length > 0 && (
          <div className="wc-free__block">
            <span className="wc-section-label">All corrections</span>
            <ul className="wc-mistakes">
              {corrections.map((c, i) => (
                <li key={i} className="wc-mistake">
                  <div className="wc-mistake__row">
                    <span className={`wc-mistake__tag wc-mistake__tag--${c.type || "style"}`}>
                      {c.type || "style"}
                    </span>
                    <span className="wc-mistake__wrong">{c.text}</span>
                    <span className="wc-mistake__arrow">→</span>
                    <span className="wc-mistake__right">{c.suggestion}</span>
                  </div>
                  {c.issue && <p className="wc-mistake__issue">{c.issue}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {fb.improvedVersion && (
          <div className="wc-free__block">
            <span className="wc-section-label">Model rewrite (higher band)</span>
            <p className="wc-feedback__text wc-feedback__text--better" onMouseUp={() => onSelectText?.()}>
              {renderText ? renderText(fb.improvedVersion) : fb.improvedVersion}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Compose stage.
  const words = support?.words || [];
  const phrases = support?.phrases || [];
  const grammar = support?.grammar || [];
  const structure = support?.structure || [];
  return (
    <div className="wc-free">
      <div className="wc-free__head">
        <div>
          <span className="wc-chat__eyebrow">Write about</span>
          <h2>{topic || "Your topic"}</h2>
        </div>
      </div>
      <div className="wc-free__compose-grid">
        <div className="wc-free__editor">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Write anything about the topic… Aim for a few well-structured sentences or a short paragraph."
          />
          <div className="wc-free__editor-foot">
            <span className="wc-free__count">
              {(draft.trim().split(/\s+/).filter(Boolean) || []).length} words
            </span>
            <button
              className="wc-btn wc-btn--primary"
              onClick={onSubmit}
              disabled={submitting || !draft.trim()}
            >
              <SendIcon fontSize="small" /> {submitting ? "Assessing…" : "Submit for review"}
            </button>
          </div>
        </div>

        <aside className="wc-free__support" data-tour="wc-suggestions">
          <div className="wc-free__support-head">
            <TipsAndUpdatesOutlinedIcon fontSize="small" />
            <span>Writing support</span>
          </div>
          {supportLoading ? (
            <div className="wc-free__support-loading">
              <div className="wc-spinner" />
              <p>Gathering ideas…</p>
            </div>
          ) : (
            <>
              {words.length > 0 && (
                <div className="wc-free__support-block">
                  <span className="wc-section-label">Useful words</span>
                  <ul className="wc-chips-list">
                    {words.map((w, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="wc-chip"
                          title={w.note ? `${w.note} — tap to learn` : "Tap to learn"}
                          onClick={() => onLookup?.(w.text)}
                        >
                          {w.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {phrases.length > 0 && (
                <div className="wc-free__support-block">
                  <span className="wc-section-label">Useful phrases</span>
                  <ul className="wc-bullets wc-bullets--clickable">
                    {phrases.map((p, i) => (
                      <li key={i} onClick={() => onLookup?.(p.text)} title="Tap to learn">
                        <strong>{p.text}</strong>
                        {p.note ? ` — ${p.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {grammar.length > 0 && (
                <div className="wc-free__support-block">
                  <span className="wc-section-label">Grammar to try</span>
                  <ul className="wc-bullets">
                    {grammar.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {structure.length > 0 && (
                <div className="wc-free__support-block">
                  <span className="wc-section-label">Structure</span>
                  <ol className="wc-bullets wc-bullets--num">
                    {structure.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {!words.length && !phrases.length && !grammar.length && !structure.length && (
                <p className="wc-free__support-empty">
                  <CheckCircleOutlineIcon fontSize="small" /> Just start writing — Dragon will review it.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
