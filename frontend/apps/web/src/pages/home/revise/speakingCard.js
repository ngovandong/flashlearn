import React, { useRef, useState } from "react";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { CircularProgress } from "@mui/material";
import { speak } from "@api-services/voiceService";
import { blobToWav } from "@pages/home/deckDetail/speakingCoach/audioWav";

// Say the sentence out loud; we record, convert to 16 kHz WAV and let the
// pronunciation service score it.
function SpeakingCard({ card, answered, result, submitting, onSubmitAudio }) {
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const text = card.payload?.text || card.answer || card.prompt;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setPreparing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const { base64 } = await blobToWav(blob);
          await onSubmitAudio({ audio: base64, mimeType: "audio/wav" });
        } finally {
          setPreparing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      // Mic denied/unavailable — leave the card idle so the user can skip.
    }
  };

  const stop = () => {
    setRecording(false);
    recorderRef.current?.stop();
  };

  const score = result?.score;

  return (
    <div className="revise-card revise-card--speaking">
      <span className="revise-card__kind">Speaking</span>
      <p className="revise-card__hint">{card.prompt}</p>
      <div className="revise-card__say">
        <h3>{text}</h3>
        <button
          type="button"
          aria-label="Hear it"
          className="revise-speak-btn"
          onClick={() => speak(text)}
        >
          <VolumeUpRoundedIcon />
        </button>
      </div>

      {!answered && (
        <div className="revise-mic">
          {preparing || submitting ? (
            <div className="revise-mic__busy">
              <CircularProgress size={26} />
              <span>Scoring…</span>
            </div>
          ) : recording ? (
            <button type="button" className="revise-mic__btn is-recording" onClick={stop}>
              <span className="revise-mic__ring" aria-hidden="true" />
              <StopRoundedIcon />
              <span>Stop &amp; score</span>
            </button>
          ) : (
            <button type="button" className="revise-mic__btn" onClick={start}>
              <span className="revise-mic__ring" aria-hidden="true" />
              <MicRoundedIcon />
              <span>Tap to speak</span>
            </button>
          )}
        </div>
      )}

      {answered && typeof score === "number" && (
        <div className={`revise-score ${result?.correct ? "is-correct" : "is-wrong"}`}>
          <span className="revise-score__num">{score}</span>
          <span className="revise-score__label">pronunciation</span>
        </div>
      )}
    </div>
  );
}

export default SpeakingCard;
