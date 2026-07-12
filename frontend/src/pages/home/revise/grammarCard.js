import React from "react";

// Renders a prompt with "___" blanks. `choose` exercises with options show
// buttons (one blank); everything else shows one text input per blank.
function GrammarCard({ card, answered, result, values, chosen, onChangeBlank, onChoose }) {
  const payload = card.payload || {};
  const options = payload.options || [];
  const isChoose = payload.exercise_kind === "choose" && options.length > 0 && payload.blank_count === 1;
  const parts = String(card.prompt || "").split(/_{2,}|___/);
  const blankCount = payload.blank_count || 1;
  const correctText = Array.isArray(result?.answer)
    ? result.answer.map((a) => (Array.isArray(a) ? a[0] : a)).join(", ")
    : result?.answer;

  return (
    <div className="revise-card revise-card--grammar">
      <span className="revise-card__kind">Grammar</span>
      {payload.unit_title && <p className="revise-card__hint">{payload.unit_title}</p>}

      {isChoose ? (
        <>
          <p className="revise-card__sentence">{card.prompt}</p>
          <div className="revise-options">
            {options.map((opt, idx) => {
              let tone = "";
              if (answered) {
                const isRight = (result?.blanks || [])[0]
                  ? opt === chosen
                  : false;
                if (opt === chosen) tone = isRight ? "is-correct" : "is-wrong";
              }
              return (
                <button
                  key={idx}
                  type="button"
                  className={`revise-option ${tone}`}
                  disabled={answered}
                  onClick={() => onChoose(opt)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="revise-card__sentence revise-card__sentence--fill">
          {parts.map((part, idx) => (
            <React.Fragment key={idx}>
              <span>{part}</span>
              {idx < parts.length - 1 && idx < blankCount && (
                <input
                  className={`revise-blank ${
                    answered ? ((result?.blanks || [])[idx] ? "is-correct" : "is-wrong") : ""
                  }`}
                  value={values[idx] || ""}
                  disabled={answered}
                  onChange={(e) => onChangeBlank(idx, e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              )}
            </React.Fragment>
          ))}
          {/* Fallback when the prompt has no visible blank marker. */}
          {parts.length === 1 &&
            Array.from({ length: blankCount }).map((_, idx) => (
              <input
                key={idx}
                className={`revise-blank ${
                  answered ? ((result?.blanks || [])[idx] ? "is-correct" : "is-wrong") : ""
                }`}
                value={values[idx] || ""}
                disabled={answered}
                onChange={(e) => onChangeBlank(idx, e.target.value)}
                placeholder="your answer"
                autoComplete="off"
              />
            ))}
        </p>
      )}

      {answered && !result?.correct && (
        <p className="revise-card__reveal">
          Answer: <strong>{correctText}</strong>
        </p>
      )}
    </div>
  );
}

export default GrammarCard;
