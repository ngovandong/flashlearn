import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAnswer,
  buildMcqQuestions,
  comboMultiplier,
  initialComboState,
  shuffleArray,
} from "@flashlearn/core";

const LIVES = 3;
const WAVE_SIZE = 4; // eggs on screen per target (1 correct + distractors)

// Fall time shrinks as you progress so it ramps up like a real arcade game.
function fallDuration(round) {
  return Math.max(3200, 6400 - round * 260);
}

let eggSeq = 0;
let partSeq = 0;

// Meaning Blaster: word-eggs rain down; blast the one matching the meaning.
export default function Blaster({ pool, sound, onScoreChange, onGameOver }) {
  const deck = useMemo(() => buildMcqQuestions(pool.terms), [pool]);

  const [round, setRound] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [lives, setLives] = useState(LIVES);
  const [eggs, setEggs] = useState([]);
  const [particles, setParticles] = useState([]);
  const [now, setNow] = useState(0);
  const [shake, setShake] = useState(false);

  const rafRef = useRef(null);
  const resolvedRef = useRef(false);
  const livesRef = useRef(LIVES);
  const comboRef = useRef(initialComboState());

  const question = deck[round % (deck.length || 1)];

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);

  // Build a fresh wave whenever the round changes.
  useEffect(() => {
    if (!question) return;
    resolvedRef.current = false;
    const cols = shuffleArray([0, 1, 2, 3]).slice(0, WAVE_SIZE);
    const base = performance.now();
    const duration = fallDuration(round);
    const words = question.options.slice(0, WAVE_SIZE);
    const wave = words.map((word, i) => ({
      id: ++eggSeq,
      word,
      isTarget: word === question.answer,
      // 4 loose columns with a little jitter so it feels organic.
      x: 10 + cols[i] * 26 + (Math.random() * 8 - 4),
      bornAt: base + i * 360,
      duration: duration + (Math.random() * 700 - 350),
    }));
    setEggs(wave);
     
  }, [round, question]);

  // One rAF drives all egg positions + off-screen detection.
  useEffect(() => {
    const loop = () => {
      const t = performance.now();
      setNow(t);
      setEggs((current) => {
        const target = current.find((e) => e.isTarget);
        if (
          target &&
          !resolvedRef.current &&
          (t - target.bornAt) / target.duration >= 1
        ) {
          miss();
        }
        return current;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextRound = () => setTimeout(() => setRound((r) => r + 1), 480);

  const burst = (x, y) => {
    const id = ++partSeq;
    setParticles((list) => [...list, { id, x, y }]);
    setTimeout(() => setParticles((list) => list.filter((p) => p.id !== id)), 650);
  };

  const miss = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    comboRef.current = applyAnswer(comboRef.current, false);
    setCombo(comboRef.current);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    sound.playWrong();
    livesRef.current -= 1;
    setLives(livesRef.current);
    if (livesRef.current <= 0) onGameOver(comboRef.current.score);
    else nextRound();
  };

  const shoot = (egg) => {
    if (resolvedRef.current) return;
    const y = ((performance.now() - egg.bornAt) / egg.duration) * 78;
    if (egg.isTarget) {
      resolvedRef.current = true;
      comboRef.current = applyAnswer(comboRef.current, true);
      setCombo(comboRef.current);
      sound.playCorrect();
      sound.say(egg.word);
      burst(egg.x, y);
      setEggs((list) => list.filter((e) => e.id !== egg.id));
      nextRound();
    } else {
      // Popping a wrong egg just clears it — only a wrong tap on nothing hurts.
      burst(egg.x, y);
      setEggs((list) => list.filter((e) => e.id !== egg.id));
    }
  };

  const mult = comboMultiplier(combo.streak);

  return (
    <div className={`cmp-blaster${shake ? " shake" : ""}`}>
      <div className="cmp-blaster__hud">
        {combo.streak >= 3 && (
          <span className="cmp-blaster__combo">x{mult} combo</span>
        )}
        <span className="cmp-blaster__lives">
          {"❤️".repeat(lives)}
          {"🤍".repeat(Math.max(0, LIVES - lives))}
        </span>
      </div>

      <div className="cmp-blaster__sky">
        <div className="cmp-blaster__stars" />
        {eggs.map((egg) => {
          const p = (now - egg.bornAt) / egg.duration;
          if (p < 0 || p > 1.15) return null;
          return (
            <button
              type="button"
              key={egg.id}
              className="cmp-egg"
              style={{ left: `${egg.x}%`, top: `${p * 78}%` }}
              onClick={() => shoot(egg)}
            >
              <span className="cmp-egg__shell">🥚</span>
              <span className="cmp-egg__word">{egg.word}</span>
            </button>
          );
        })}

        {particles.map((part) => (
          <div
            key={part.id}
            className="cmp-boom"
            style={{ left: `${part.x}%`, top: `${part.y}%` }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className="cmp-boom__bit"
                style={{ "--a": `${i * 45}deg` }}
              />
            ))}
          </div>
        ))}

        <div className="cmp-blaster__ground" />
        <div className="cmp-blaster__cannon">🔭</div>
      </div>

      <div className="cmp-blaster__target">
        <span className="cmp-blaster__label">Blast the word that means</span>
        <strong>{question?.prompt}</strong>
      </div>
    </div>
  );
}
