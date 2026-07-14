import React from "react";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { speak } from "@api-services/voiceService";

// Multiple-choice: show the word, pick its meaning. Once answered, the chosen
// wrong option turns red and the correct one turns green.
function VocabCard({ card, answered, result, chosen, onChoose }) {
  const options = card.payload?.options || [];
  const correct = result?.answer;
  const image = card.payload?.image;

  return (
    <div className="revise-card revise-card--vocab">
      <span className="revise-card__kind">Vocabulary</span>
      <div className="revise-card__prompt">
        {image ? (
          <div className="revise-card__visual">
            <img src={image} alt={card.prompt} />
          </div>
        ) : null}
        <div className="revise-card__word">
          <h2>{card.prompt}</h2>
          <button
            type="button"
            aria-label="Hear the word"
            className="revise-speak-btn"
            onClick={() => speak(card.prompt)}
          >
            <VolumeUpRoundedIcon />
          </button>
        </div>
      </div>
      {card.payload?.pronunciation && (
        <p className="revise-card__ipa">{card.payload.pronunciation}</p>
      )}
      <p className="revise-card__hint">What does it mean?</p>
      <div className="revise-options">
        {options.map((opt, idx) => {
          let tone = "";
          if (answered) {
            if (opt === correct) tone = "is-correct";
            else if (opt === chosen) tone = "is-wrong";
            else tone = "is-dim";
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
    </div>
  );
}

export default VocabCard;
