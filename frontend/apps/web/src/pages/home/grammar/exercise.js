import React, { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ReplayIcon from "@mui/icons-material/Replay";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import { grammarService } from "@api-services/grammarService";

// Server pass threshold (kept in sync with the backend grader) — used to derive
// the completed flag when replaying a saved attempt that only stored the score.
const PASS_THRESHOLD = 80;

// Build the initial per-item answer state for the fill-in style kinds. Reorder
// is tracked separately (bank + line of tokens).
function initGiven(exercise) {
  return (exercise.items || []).map((item) => {
    if (exercise.kind === "fill_blank") return Array(item.blanks || 1).fill("");
    return [""];
  });
}

// Prefill the answer state from the user's last saved attempt so a revisited
// lesson shows what they typed (alongside the replayed right/wrong result).
function replayGiven(exercise) {
  const saved = exercise.progress?.last_result?.results;
  if (!Array.isArray(saved) || !saved.length) return initGiven(exercise);
  return (exercise.items || []).map((item, i) => {
    const prev = saved[i]?.given;
    if (exercise.kind === "fill_blank") {
      const n = item.blanks || 1;
      return Array.from({ length: n }, (_, k) => (Array.isArray(prev) ? prev[k] ?? "" : ""));
    }
    return [Array.isArray(prev) ? prev[0] ?? "" : ""];
  });
}

// Rebuild the graded result from the last saved attempt so the score and the
// per-blank right/wrong markings show up immediately on a revisit.
function replayResult(exercise) {
  const saved = exercise.progress?.last_result;
  if (!saved || !Array.isArray(saved.results) || !saved.results.length) return null;
  const score = saved.score || 0;
  return {
    score,
    results: saved.results,
    completed: exercise.progress?.status === "completed" || score >= PASS_THRESHOLD,
  };
}

function initOrder(exercise) {
  if (exercise.kind !== "reorder") return [];
  return (exercise.items || []).map((item) => ({
    bank: [...(item.tokens || [])],
    line: [],
  }));
}

// Match state: one option index (into `options`) placed per item, or null.
// The bank is every option not currently placed in a slot.
function initMatch(exercise) {
  if (exercise.kind !== "match") return [];
  return (exercise.items || []).map(() => null);
}

function scoreTone(score) {
  if (score >= 80) return "is-good";
  if (score >= 50) return "is-mid";
  return "is-low";
}

// One interactive, auto-graded exercise. Answers are graded server-side; the
// response reveals the correct answers so we can colour each blank and show what
// was right/wrong.
export default function Exercise({ exercise, unitTitle, onGraded }) {
  const { kind, items = [], options = [], prompt } = exercise;

  const [given, setGiven] = useState(() => replayGiven(exercise));
  const [order, setOrder] = useState(() => initOrder(exercise));
  const [slots, setSlots] = useState(() => initMatch(exercise));
  const [result, setResult] = useState(() => replayResult(exercise));
  const [loading, setLoading] = useState(false);
  const [explain, setExplain] = useState({});

  // Mouse + touch drag for the match exercise. A small distance/delay lets taps
  // and scrolls through so the page stays usable on phones.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const bank = useMemo(
    () => options.map((_, i) => i).filter((i) => !slots.includes(i)),
    [options, slots]
  );

  // Move a dragged option (by index) into a slot, or back to the bank.
  const handleDragEnd = ({ active, over }) => {
    if (!over || result) return;
    const optIndex = Number(String(active.id).replace("opt-", ""));
    if (Number.isNaN(optIndex)) return;
    setSlots((prev) => {
      const next = prev.map((s) => (s === optIndex ? null : s));
      if (String(over.id).startsWith("slot-")) {
        next[Number(String(over.id).replace("slot-", ""))] = optIndex;
      }
      return next;
    });
  };

  const bestScore = exercise.progress?.best_score || 0;
  const done = exercise.progress?.status === "completed";

  const setBlank = (itemIndex, blankIndex, value) => {
    setGiven((prev) => {
      const next = prev.map((row) => [...row]);
      next[itemIndex][blankIndex] = value;
      return next;
    });
  };

  const moveToLine = (itemIndex, tokenIndex) => {
    setOrder((prev) => {
      const next = prev.map((o) => ({ bank: [...o.bank], line: [...o.line] }));
      const [tok] = next[itemIndex].bank.splice(tokenIndex, 1);
      next[itemIndex].line.push(tok);
      return next;
    });
  };

  const moveToBank = (itemIndex, tokenIndex) => {
    setOrder((prev) => {
      const next = prev.map((o) => ({ bank: [...o.bank], line: [...o.line] }));
      const [tok] = next[itemIndex].line.splice(tokenIndex, 1);
      next[itemIndex].bank.push(tok);
      return next;
    });
  };

  const collectSubmissions = () =>
    items.map((_, i) => {
      if (kind === "reorder") return [order[i]?.line.join(" ") || ""];
      if (kind === "match") return [slots[i] != null ? options[slots[i]] : ""];
      return given[i];
    });

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await grammarService.submitExercise(exercise.key, collectSubmissions());
      setResult(res.data);
      if (onGraded) onGraded(res.data);
    } catch (e) {
      // Surfaced by the global error snackbar; keep the exercise interactive.
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setGiven(initGiven(exercise));
    setOrder(initOrder(exercise));
    setSlots(initMatch(exercise));
    setResult(null);
    setExplain({});
  };

  const askExplain = async (itemIndex) => {
    const item = items[itemIndex];
    const r = result?.results?.[itemIndex];
    const sentence = kind === "reorder" ? (r?.answers || []).join(" ") : item.text || "";
    setExplain((prev) => ({ ...prev, [itemIndex]: { loading: true } }));
    try {
      const res = await grammarService.explain({
        unit_title: unitTitle || "",
        sentence,
        given: (r?.given || []).join(" "),
        correct: (r?.answers || []).join(" "),
      });
      setExplain((prev) => ({ ...prev, [itemIndex]: { data: res.data } }));
    } catch (e) {
      setExplain((prev) => ({
        ...prev,
        [itemIndex]: { error: "Dragon couldn't explain right now. Try again in a moment." },
      }));
    }
  };

  const itemState = (i) => (result ? result.results?.[i] : null);
  const isMatch = kind === "match";

  const itemsList = (
    <ol className="gr-ex__items">
      {items.map((item, i) => (
        <li key={i} className="gr-item">
          {isMatch ? (
            <MatchSlotRow
              item={item}
              slotIndex={i}
              token={slots[i] != null ? options[slots[i]] : null}
              tokenIndex={slots[i]}
              result={itemState(i)}
              disabled={!!result}
            />
          ) : (
            <ExerciseItem
              kind={kind}
              item={item}
              options={options}
              given={given[i]}
              order={order[i]}
              result={itemState(i)}
              onBlank={(bi, v) => setBlank(i, bi, v)}
              onSelect={(v) => setBlank(i, 0, v)}
              onMoveToLine={(ti) => moveToLine(i, ti)}
              onMoveToBank={(ti) => moveToBank(i, ti)}
            />
          )}
          {itemState(i) && !itemState(i).correct && (
            <div className="gr-item__after">
              <button
                type="button"
                className="gr-explain-btn"
                onClick={() => askExplain(i)}
                disabled={explain[i]?.loading}
              >
                <AutoAwesomeIcon fontSize="inherit" />
                {explain[i]?.loading ? "Asking Dragon…" : "Why?"}
              </button>
              {explain[i]?.data && (
                <div className="gr-explain">
                  <p className="gr-explain__answer">{explain[i].data.answer}</p>
                  {explain[i].data.examples?.length > 0 && (
                    <ul className="gr-explain__examples">
                      {explain[i].data.examples.map((ex, k) => (
                        <li key={k}>{ex}</li>
                      ))}
                    </ul>
                  )}
                  {explain[i].data.tip && <p className="gr-explain__tip">💡 {explain[i].data.tip}</p>}
                </div>
              )}
              {explain[i]?.error && <p className="gr-explain__err">{explain[i].error}</p>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <div className={`gr-ex ${done ? "gr-ex--done" : ""}`}>
      <div className="gr-ex__head">
        <p className="gr-ex__prompt">{prompt}</p>
        {(done || bestScore > 0) && !result && (
          <span className="gr-ex__best">
            <EmojiEventsIcon fontSize="inherit" /> Best {bestScore}%
          </span>
        )}
      </div>

      {isMatch ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {itemsList}
          {!result && <MatchBank options={options} bankIndices={bank} />}
        </DndContext>
      ) : (
        itemsList
      )}

      <div className="gr-ex__foot">
        {result ? (
          <>
            <span className={`gr-score ${scoreTone(result.score)}`}>
              {result.completed ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}
              {result.score}%
            </span>
            <button type="button" className="sc-btn sc-btn--ghost gr-try-again" onClick={handleReset}>
              <ReplayIcon fontSize="small" /> Try again
            </button>
          </>
        ) : (
          <button type="button" className="sc-btn sc-btn--primary gr-check" onClick={handleCheck} disabled={loading}>
            {loading ? "Checking…" : "Check answers"}
          </button>
        )}
      </div>
    </div>
  );
}

// Renders a single item's interaction for its exercise kind.
function ExerciseItem({ kind, item, options, given, order, result, onBlank, onSelect, onMoveToLine, onMoveToBank }) {
  if (kind === "fill_blank") return <FillBlank item={item} given={given} result={result} onBlank={onBlank} />;
  if (kind === "choose")
    return <Choose item={item} options={options} value={given[0]} result={result} onSelect={onSelect} />;
  if (kind === "reorder")
    return <Reorder order={order} result={result} onMoveToLine={onMoveToLine} onMoveToBank={onMoveToBank} />;
  return <Rewrite item={item} value={given[0]} result={result} onSelect={onSelect} />;
}

function blankClass(result, bi) {
  if (!result) return "";
  return result.blanks?.[bi] ? "is-correct" : "is-wrong";
}

function FillBlank({ item, given, result, onBlank }) {
  const text = item.text || "";
  const hasInline = text.includes("___");
  const parts = useMemo(() => text.split("___"), [text]);

  // Some book items are "rewrite/transform" style (e.g. "she is" → "she's",
  // "make" → "made", or answer-the-question) and carry no inline "___". Render
  // the sentence as a prompt with a full-width answer box per expected blank so
  // the item is always answerable (and gradeable) instead of showing nothing.
  if (!hasInline) {
    const count = Math.max(item.blanks || 0, (given || []).length, 1);
    return (
      <div className="gr-open">
        {text && <p className="gr-open__q">{text}</p>}
        {Array.from({ length: count }).map((_, idx) => (
          <div className="gr-open__row" key={idx}>
            <input
              className={`gr-open__input ${blankClass(result, idx)}`}
              value={given[idx] || ""}
              onChange={(e) => onBlank(idx, e.target.value)}
              disabled={!!result}
              placeholder="Write your answer…"
              aria-label={`Answer ${idx + 1}`}
              autoComplete="off"
            />
            {result && !result.blanks?.[idx] && (
              <span className="gr-answer gr-answer--block">{result.answers?.[idx]}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="gr-sentence">
      {parts.map((part, idx) => (
        <React.Fragment key={idx}>
          <span>{part}</span>
          {idx < parts.length - 1 && (
            <span className="gr-blank-wrap">
              <input
                className={`gr-blank ${blankClass(result, idx)}`}
                value={given[idx] || ""}
                onChange={(e) => onBlank(idx, e.target.value)}
                disabled={!!result}
                aria-label={`Blank ${idx + 1}`}
                autoComplete="off"
                size={Math.max(8, (given[idx] || "").length + 2)}
              />
              {result && !result.blanks?.[idx] && (
                <span className="gr-answer">{result.answers?.[idx]}</span>
              )}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Choose({ item, options, value, result, onSelect }) {
  const opts = item.options && item.options.length ? item.options : options;
  return (
    <div className="gr-choose">
      {item.text && <p className="gr-q">{item.text}</p>}
      <div className="gr-options">
        {opts.map((opt) => {
          let state = value === opt ? "is-selected" : "";
          if (result) {
            if (opt === result.answers?.[0]) state = "is-correct";
            else if (opt === value) state = "is-wrong";
            else state = "";
          }
          return (
            <button
              key={opt}
              type="button"
              className={`gr-option ${state}`}
              onClick={() => !result && onSelect(opt)}
              disabled={!!result}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Rewrite({ item, value, result, onSelect }) {
  return (
    <div className="gr-rewrite">
      <p className="gr-q">{item.text}</p>
      <input
        className={`gr-rewrite__input ${result ? blankClass(result, 0) : ""}`}
        value={value || ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={!!result}
        placeholder="Write your answer…"
        autoComplete="off"
      />
      {result && !result.correct && <p className="gr-answer gr-answer--block">{result.answers?.[0]}</p>}
    </div>
  );
}

// A draggable option chip (used both in the bank and inside a slot). `optIndex`
// is its index into the exercise `options`, encoded into the drag id.
function MatchChip({ optIndex, label, disabled, state = "" }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `opt-${optIndex}`,
    disabled,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`gr-chip ${state} ${isDragging ? "is-dragging" : ""} ${disabled ? "is-locked" : ""}`}
      {...listeners}
      {...attributes}
    >
      {!disabled && <DragIndicatorIcon className="gr-chip__grip" fontSize="inherit" />}
      {label}
    </span>
  );
}

// One left-hand prompt with a droppable slot for its matching answer chip.
function MatchSlotRow({ item, slotIndex, token, tokenIndex, result, disabled }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIndex}`, disabled });
  const state = result ? (result.correct ? "is-correct" : "is-wrong") : "";
  return (
    <div className={`gr-match ${state}`}>
      <span className="gr-match__left">{item.text}</span>
      <span className="gr-match__arrow">→</span>
      <span ref={setNodeRef} className={`gr-match__slot ${isOver ? "is-over" : ""} ${token ? "is-filled" : ""}`}>
        {token != null ? (
          <MatchChip optIndex={tokenIndex} label={token} disabled={disabled} state={state} />
        ) : (
          <span className="gr-match__placeholder">Drop here</span>
        )}
      </span>
      {result && !result.correct && <span className="gr-answer">{result.answers?.[0]}</span>}
    </div>
  );
}

// The pool of unused answer chips to drag from. Droppable so a placed chip can
// be dragged back out of a slot.
function MatchBank({ options, bankIndices }) {
  const { setNodeRef, isOver } = useDroppable({ id: "bank" });
  return (
    <div ref={setNodeRef} className={`gr-match-bank ${isOver ? "is-over" : ""}`}>
      <span className="gr-match-bank__hint">Drag an answer to each question</span>
      <div className="gr-match-bank__chips">
        {bankIndices.length === 0 ? (
          <span className="gr-match-bank__empty">All placed — check your answers.</span>
        ) : (
          bankIndices.map((i) => <MatchChip key={i} optIndex={i} label={options[i]} />)
        )}
      </div>
    </div>
  );
}

function Reorder({ order, result, onMoveToLine, onMoveToBank }) {
  if (!order) return null;
  return (
    <div className="gr-reorder">
      <div className={`gr-reorder__line ${result ? (result.correct ? "is-correct" : "is-wrong") : ""}`}>
        {order.line.length === 0 && <span className="gr-reorder__hint">Tap the words in order…</span>}
        {order.line.map((tok, ti) => (
          <button
            key={ti}
            type="button"
            className="gr-token"
            onClick={() => !result && onMoveToBank(ti)}
            disabled={!!result}
          >
            {tok}
          </button>
        ))}
      </div>
      {!result && order.bank.length > 0 && (
        <div className="gr-reorder__bank">
          {order.bank.map((tok, ti) => (
            <button key={ti} type="button" className="gr-token gr-token--bank" onClick={() => onMoveToLine(ti)}>
              {tok}
            </button>
          ))}
        </div>
      )}
      {result && !result.correct && <p className="gr-answer gr-answer--block">{result.answers?.[0]}</p>}
    </div>
  );
}
