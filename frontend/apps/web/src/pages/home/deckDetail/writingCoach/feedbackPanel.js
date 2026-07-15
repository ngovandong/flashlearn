import React from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircle";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

// Feedback for one learner chat message. The parent supplies `renderText` so any
// rendered fragment supports the select-to-learn vocabulary flow, and `onSelect`
// captures mouse-up text selections.
export default function FeedbackPanel({ message, renderText, onSelect }) {
  if (!message) {
    return (
      <div className="wc-feedback wc-feedback--empty" data-tour="wc-feedback">
        <LightbulbOutlinedIcon />
        <p>Send a message, then tap any of your messages to see Dragon's feedback here.</p>
      </div>
    );
  }

  const fb = message.feedback || {};
  const hasMistakes = (fb.mistakes || []).length > 0;

  return (
    <div className="wc-feedback" data-tour="wc-feedback">
      <div className="wc-feedback__head">
        <span className="wc-feedback__eyebrow">Feedback</span>
        <p className="wc-feedback__original" onMouseUp={() => onSelect?.(message.text)}>
          {renderText ? renderText(message.text) : message.text}
        </p>
      </div>

      {!fb.hasIssues && !hasMistakes ? (
        <div className="wc-feedback__perfect">
          <CheckCircleOutlineIcon />
          <span>Great job — this looks natural and correct!</span>
        </div>
      ) : (
        hasMistakes && (
          <div className="wc-feedback__block">
            <span className="wc-section-label">Mistakes</span>
            <ul className="wc-mistakes">
              {fb.mistakes.map((m, i) => (
                <li key={i} className="wc-mistake">
                  <div className="wc-mistake__row">
                    <span className="wc-mistake__wrong">{m.text}</span>
                    <span className="wc-mistake__arrow">→</span>
                    <span className="wc-mistake__right">{m.correction}</span>
                  </div>
                  {m.issue && <p className="wc-mistake__issue">{m.issue}</p>}
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {fb.correctedText && fb.correctedText !== message.text && (
        <div className="wc-feedback__block">
          <span className="wc-section-label">Corrected</span>
          <p className="wc-feedback__text" onMouseUp={() => onSelect?.(fb.correctedText)}>
            {renderText ? renderText(fb.correctedText) : fb.correctedText}
          </p>
        </div>
      )}

      {fb.betterVersion && (
        <div className="wc-feedback__block">
          <span className="wc-section-label">Say it even better</span>
          <p className="wc-feedback__text wc-feedback__text--better" onMouseUp={() => onSelect?.(fb.betterVersion)}>
            {renderText ? renderText(fb.betterVersion) : fb.betterVersion}
          </p>
        </div>
      )}

      {(fb.tips || []).length > 0 && (
        <div className="wc-feedback__block">
          <span className="wc-section-label">Tips</span>
          <ul className="wc-bullets">
            {fb.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {(fb.examples || []).length > 0 && (
        <div className="wc-feedback__block">
          <span className="wc-section-label">Examples</span>
          <ul className="wc-bullets">
            {fb.examples.map((ex, i) => (
              <li key={i} onMouseUp={() => onSelect?.(ex)}>
                {renderText ? renderText(ex) : ex}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
