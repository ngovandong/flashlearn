import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import ReplayIcon from "@mui/icons-material/Replay";
import SlowMotionVideoIcon from "@mui/icons-material/SlowMotionVideo";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import TranslateIcon from "@mui/icons-material/Translate";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";

import { listeningService } from "@api-services/listeningService";
import { speakingService } from "@api-services/speakingService";
import { termService } from "@api-services/termService";
import VocabModal from "@pages/home/deckDetail/speakingCoach/vocabModal";
import PronunciationText from "./pronunciation";
import { evaluateDictation, normalizeWord, overallScore, tokenDisplay } from "./evaluate";

// Native-language options for the per-sentence translation helper.
const TRANSLATE_LANGS = [
  { code: "vi", label: "Vietnamese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-CN", label: "Chinese" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "hi", label: "Hindi" },
];
const TRANSLATE_LANG_KEY = "lt-translate-lang";

function errorMessage(err, fallback) {
  const data = err?.response?.data;
  return data?.errors || data?.detail || fallback;
}

function browserSpeak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    synth.speak(utter);
  } catch {
    /* no speech synthesis available */
  }
}

export default function ListenAndType() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState(null);
  const [idx, setIdx] = useState(0);
  const [inputs, setInputs] = useState([]); // typed string per sentence
  const [results, setResults] = useState([]); // { tokensCorrect, correct, total, score } | null
  const [revealed, setRevealed] = useState([]); // bool per sentence
  const [bestScore, setBestScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Vocab / highlight state (mirrors the Speaking Coach).
  const [selected, setSelected] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [termMatches, setTermMatches] = useState([]);

  // Per-sentence translation & note helpers (keyed by sentence position).
  const [meta, setMeta] = useState({});
  const [targetLang, setTargetLang] = useState(
    () => localStorage.getItem(TRANSLATE_LANG_KEY) || "vi"
  );
  const [translating, setTranslating] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState(false);
  const [translationDraft, setTranslationDraft] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [sentenceNoteDraft, setSentenceNoteDraft] = useState("");

  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const currentTextRef = useRef("");

  const sentences = exercise?.sentences || [];
  const current = sentences[idx];

  // ── Load exercise (+ replay any previous attempt so mistakes re-highlight) ──
  useEffect(() => {
    let active = true;
    setLoading(true);
    listeningService
      .getExercise(exerciseId)
      .then((res) => {
        if (!active) return;
        const data = res.data;
        setExercise(data);
        const list = data.sentences || [];
        setHighlights(data.progress?.highlights || []);
        setMeta(data.progress?.sentence_meta || {});
        setBestScore(data.progress?.best_score || 0);

        const prior = data.progress?.last_result?.lines;
        if (Array.isArray(prior) && prior.length) {
          const byPos = new Map(prior.map((l) => [l.position, l]));
          setInputs(list.map((s) => byPos.get(s.position)?.typed || ""));
          setResults(
            list.map((s) => {
              const l = byPos.get(s.position);
              if (!l) return null;
              return {
                tokensCorrect: l.tokens_correct || [],
                correct: l.correct || 0,
                total: l.total || (s.tokens?.length || 0),
                score: l.total ? Math.round(((l.correct || 0) / l.total) * 100) : 0,
              };
            })
          );
          setRevealed(list.map((s) => byPos.has(s.position)));
        } else {
          setInputs(list.map(() => ""));
          setResults(list.map(() => null));
          setRevealed(list.map(() => false));
        }
      })
      .catch(() => active && toast.error("Could not load this exercise."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [exerciseId]);

  // Match the user's saved terms against the transcript for underline + deep-links.
  const refreshTermMatches = useCallback(() => {
    const texts = (exercise?.sentences || []).map((s) => s.text);
    if (!texts.length) return;
    speakingService
      .matchTerms({ texts })
      .then((res) => setTermMatches(res.data?.matches || []))
      .catch(() => {});
  }, [exercise]);

  useEffect(() => {
    refreshTermMatches();
  }, [refreshTermMatches]);

  // ── Audio ──────────────────────────────────────────────────────────────
  const playSentence = useCallback(
    (i = idx, { slow = false } = {}) => {
      const s = sentences[i];
      if (!s) return;
      currentTextRef.current = s.text;
      if (!s.audio_url) {
        browserSpeak(s.text);
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = s.audio_url;
      audio.playbackRate = slow ? 0.6 : 1;
      audio.currentTime = 0;
      audio.play().catch(() => browserSpeak(s.text));
    },
    [idx, sentences]
  );

  const playFull = useCallback(() => {
    const url = exercise?.full_audio_url;
    const audio = audioRef.current;
    if (!url || !audio) return;
    audio.pause();
    audio.src = url;
    audio.playbackRate = 1;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [exercise]);

  // Auto-play + focus when entering a fresh (not-yet-revealed) sentence.
  useEffect(() => {
    if (loading || !current) return;
    if (!revealed[idx]) {
      playSentence(idx);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading]);

  // ── Evaluation ─────────────────────────────────────────────────────────
  const setInputAt = (i, value) =>
    setInputs((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  // Auto-save the sentences answered so far (revealed only) so a long exercise
  // can be resumed later. Fire-and-forget — never blocks the UI.
  const persistProgress = useCallback(
    (resultsArr, revealedArr, inputsArr) => {
      const partial = sentences
        .map((s, i) => ({ s, i }))
        .filter(({ i }) => revealedArr[i])
        .map(({ s, i }) => {
          const r = resultsArr[i];
          return {
            position: s.position,
            target: s.text,
            typed: inputsArr[i] || "",
            correct: r?.correct || 0,
            total: r?.total ?? (s.tokens?.length || 0),
            tokens_correct: r?.tokensCorrect || [],
          };
        });
      listeningService.saveProgress({ exerciseId, lines: partial }).catch(() => {});
    },
    [sentences, exerciseId]
  );

  const checkSentence = () => {
    if (!current) return;
    const result = evaluateDictation(current.tokens, inputs[idx] || "");
    const nextResults = [...results];
    nextResults[idx] = result;
    const nextRevealed = [...revealed];
    nextRevealed[idx] = true;
    setResults(nextResults);
    setRevealed(nextRevealed);
    persistProgress(nextResults, nextRevealed, inputs);
  };

  const revealSentence = () => {
    const nextResults = [...results];
    if (!nextResults[idx]) {
      nextResults[idx] = evaluateDictation(current.tokens, inputs[idx] || "");
    }
    const nextRevealed = [...revealed];
    nextRevealed[idx] = true;
    setResults(nextResults);
    setRevealed(nextRevealed);
    persistProgress(nextResults, nextRevealed, inputs);
  };

  // Restart just the current sentence: clear the answer and replay the audio.
  const restartSentence = () => {
    const nextInputs = [...inputs];
    nextInputs[idx] = "";
    const nextResults = [...results];
    nextResults[idx] = null;
    const nextRevealed = [...revealed];
    nextRevealed[idx] = false;
    setInputs(nextInputs);
    setResults(nextResults);
    setRevealed(nextRevealed);
    persistProgress(nextResults, nextRevealed, nextInputs);
    playSentence(idx);
    inputRef.current?.focus();
  };

  const goTo = (i) => {
    if (i < 0 || i >= sentences.length) return;
    setIdx(i);
  };

  const onInputKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!revealed[idx]) checkSentence();
    else if (idx < sentences.length - 1) goTo(idx + 1);
    else finishExercise();
  };

  const lines = useMemo(
    () =>
      sentences.map((s, i) => {
        const r = results[i];
        return {
          position: s.position,
          target: s.text,
          typed: inputs[i] || "",
          correct: r?.correct || 0,
          total: r?.total ?? (s.tokens?.length || 0),
          tokens_correct: r?.tokensCorrect || [],
        };
      }),
    [sentences, results, inputs]
  );

  const finishExercise = async () => {
    // Evaluate every sentence now (including any not yet checked) so the score
    // and the persisted breakdown cover the whole exercise. Computed locally
    // because the `lines` memo won't reflect the state updates until re-render.
    const finalResults = sentences.map((s, i) => results[i] || evaluateDictation(s.tokens, inputs[i] || ""));
    const finalLines = sentences.map((s, i) => ({
      position: s.position,
      target: s.text,
      typed: inputs[i] || "",
      correct: finalResults[i].correct,
      total: finalResults[i].total,
      tokens_correct: finalResults[i].tokensCorrect,
    }));
    setResults(finalResults);
    setRevealed(sentences.map(() => true));
    setFinished(true);
    const score = overallScore(finalLines);
    try {
      const res = await listeningService.submit({ exerciseId, score, lines: finalLines });
      setBestScore((b) => Math.max(b, res.data?.progress?.best_score || score));
    } catch (err) {
      toast.error(errorMessage(err, "Could not save your result."));
    }
  };

  // Restart the whole exercise: wipe every sentence's answer locally and clear
  // the saved progress on the server so nothing replays on revisit.
  const restartAll = async () => {
    setInputs(sentences.map(() => ""));
    setResults(sentences.map(() => null));
    setRevealed(sentences.map(() => false));
    setFinished(false);
    setIdx(0);
    try {
      await listeningService.resetProgress(exerciseId);
    } catch (err) {
      toast.error(errorMessage(err, "Could not restart this exercise."));
    }
  };

  // ── Vocab / highlight (mirrors Speaking Coach) ──────────────────────────
  const openVocab = useCallback(async (rawText, lineText) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    setSelected({ text, context: lineText, loading: true });
    try {
      const res = await speakingService.explainPhrase(text, lineText);
      setSelected((prev) => (prev && prev.text === text ? { ...prev, loading: false, explain: res.data || {} } : prev));
    } catch {
      setSelected((prev) =>
        prev && prev.text === text ? { ...prev, loading: false, error: "Failed to load. Tap retry." } : prev
      );
    }
  }, []);

  const handleSelection = (lineText) => {
    const text = window.getSelection?.()?.toString().trim();
    if (text) openVocab(text, lineText);
  };

  const isHighlighted = (text) =>
    (highlights || []).some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase());

  const findTermMatch = (text) =>
    (termMatches || []).find((m) => (m.name || "").toLowerCase() === (text || "").toLowerCase()) || null;

  const toggleHighlight = async (remove) => {
    if (!selected?.text) return;
    try {
      const res = await listeningService.setHighlight(exerciseId, {
        text: selected.text,
        note: noteDraft,
        remove,
      });
      setHighlights(res.data?.highlights || []);
      setNoteDraft("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update highlight."));
    }
  };

  const saveSelectionAsTerm = async (image = "") => {
    if (!selected?.text) return false;
    const res = await termService.addToDefaultDeck({
      name: selected.text,
      meaning: selected.explain?.meaning || "",
      image: image || "",
      ai_filled: false,
    });
    if (res.error) {
      toast.error(errorMessage(res.error, "Could not save term."));
      return false;
    }
    toast.success(`"${selected.text}" saved to your default deck.`);
    refreshTermMatches();
    return true;
  };

  const openTermPage = (match) => {
    if (match?.deck_id && match?.term_id) navigate(`/deck/${match.deck_id}/learn/${match.term_id}`);
  };

  const removeTermFromDeck = async (match) => {
    if (!match?.term_id) return;
    try {
      await termService.delete(match.term_id);
      toast.success("Removed from your deck.");
      refreshTermMatches();
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove term."));
    }
  };

  // ── Per-sentence translation & note ─────────────────────────────────────
  const curPos = current?.position;
  const curMeta = (curPos != null && meta[String(curPos)]) || {};

  // Reset the inline editors whenever the sentence changes.
  useEffect(() => {
    setEditingTranslation(false);
    setEditingNote(false);
  }, [idx]);

  const onLangChange = (code) => {
    setTargetLang(code);
    localStorage.setItem(TRANSLATE_LANG_KEY, code);
  };

  const persistMeta = async (fields) => {
    if (curPos == null) return;
    try {
      const res = await listeningService.saveSentenceMeta(exerciseId, { position: curPos, ...fields });
      setMeta(res.data?.sentence_meta || {});
    } catch (err) {
      toast.error(errorMessage(err, "Could not save."));
    }
  };

  const handleTranslate = async () => {
    if (!current || translating) return;
    setTranslating(true);
    try {
      const res = await listeningService.translate({ text: current.text, targetLanguage: targetLang });
      const translation = (res.data?.translation || "").trim();
      if (!translation) {
        toast.info("Couldn't translate this one — you can type it in with Edit.");
        setTranslationDraft("");
        setEditingTranslation(true);
      } else {
        await persistMeta({ translation });
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not translate."));
    } finally {
      setTranslating(false);
    }
  };

  const saveTranslation = async () => {
    await persistMeta({ translation: translationDraft.trim() });
    setEditingTranslation(false);
  };

  const saveNote = async () => {
    await persistMeta({ note: sentenceNoteDraft.trim() });
    setEditingNote(false);
  };

  const highlightSet = useMemo(
    () => new Set((highlights || []).map((h) => normalizeWord(h.text))),
    [highlights]
  );
  const termSet = useMemo(() => new Set((termMatches || []).map((m) => normalizeWord(m.name))), [termMatches]);

  if (loading) {
    return (
      <div className="lt-wrapper">
        <div className="listening-loading">
          <div className="sc-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="lt-wrapper">
        <button className="sc-back" onClick={() => navigate("/listening")}>
          <ArrowBackIcon fontSize="small" /> Back
        </button>
        <p className="listening-empty">This exercise could not be loaded.</p>
      </div>
    );
  }

  const result = results[idx];
  const isRevealed = revealed[idx];
  const answeredCount = revealed.filter(Boolean).length;

  return (
    <div className="lt-wrapper">
      <audio ref={audioRef} preload="none" onError={() => browserSpeak(currentTextRef.current)} />

      {/* Header */}
      <div className="lt-header">
        <button className="sc-back" onClick={() => navigate(`/listening/topics/${exercise.topic?.slug}`)}>
          <ArrowBackIcon fontSize="small" /> {exercise.topic?.title || "Back"}
        </button>
        <div className="lt-header__title">
          <h2>{exercise.title}</h2>
          {exercise.level && <span className="listening-chip">{exercise.level}</span>}
        </div>
        {bestScore > 0 && (
          <span className="lt-best" title="Your best score">
            <EmojiEventsIcon fontSize="small" /> {bestScore}%
          </span>
        )}
        <button
          className="sc-btn sc-btn--ghost lt-restart-all"
          onClick={restartAll}
          title="Restart the whole exercise"
        >
          <RestartAltIcon fontSize="small" /> Restart all
        </button>
      </div>

      {/* Progress dots */}
      <div className="lt-dots" data-tour="lt-progress">
        {sentences.map((s, i) => {
          const done = revealed[i];
          const score = results[i]?.score ?? null;
          const state = done ? (score === 100 ? "good" : score >= 50 ? "mid" : "low") : "";
          return (
            <button
              key={s.position ?? i}
              className={`lt-dot ${i === idx ? "is-current" : ""} ${state}`}
              onClick={() => goTo(i)}
              title={`Sentence ${i + 1}`}
            />
          );
        })}
      </div>

      {/* Practice card */}
      <div className="lt-card">
        <div className="lt-card__top">
          <span className="lt-counter">
            Sentence {idx + 1} / {sentences.length}
          </span>
          <div className="lt-audio-controls" data-tour="lt-audio">
            <button className="sc-btn sc-btn--primary" onClick={() => playSentence(idx)} title="Play">
              <VolumeUpIcon fontSize="small" /> Play
            </button>
            <button className="sc-btn sc-btn--ghost" onClick={() => playSentence(idx, { slow: true })} title="Play slowly">
              <SlowMotionVideoIcon fontSize="small" /> Slow
            </button>
            <button className="sc-btn sc-btn--ghost" onClick={() => playSentence(idx)} title="Replay">
              <ReplayIcon fontSize="small" />
            </button>
            {exercise.full_audio_url && (
              <button className="sc-btn sc-btn--ghost" onClick={playFull} title="Play full audio">
                <QueueMusicIcon fontSize="small" />
              </button>
            )}
            <button
              className="sc-btn sc-btn--ghost"
              onClick={restartSentence}
              title="Restart this sentence"
            >
              <RestartAltIcon fontSize="small" /> Restart sentence
            </button>
          </div>
        </div>

        <textarea
          ref={inputRef}
          className="lt-input"
          data-tour="lt-input"
          rows={2}
          placeholder="Type what you hear…"
          value={inputs[idx] || ""}
          onChange={(e) => setInputAt(idx, e.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={isRevealed}
        />

        {current && (
          <div className="lt-helpers" data-tour="lt-helpers">
            {/* Translation */}
            <div className="lt-helper">
              <div className="lt-helper__head">
                <span className="sc-section-label sc-section-label--row">
                  <TranslateIcon fontSize="inherit" /> Translation
                </span>
                <select
                  className="lt-lang"
                  value={targetLang}
                  onChange={(e) => onLangChange(e.target.value)}
                  title="Translate to"
                >
                  {TRANSLATE_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              {editingTranslation ? (
                <div className="lt-helper__edit">
                  <textarea
                    rows={2}
                    value={translationDraft}
                    onChange={(e) => setTranslationDraft(e.target.value)}
                    placeholder="Type the translation…"
                  />
                  <div className="lt-helper__actions">
                    <button className="sc-btn sc-btn--primary sc-btn--sm" onClick={saveTranslation}>
                      Save
                    </button>
                    <button
                      className="sc-btn sc-btn--ghost sc-btn--sm"
                      onClick={() => setEditingTranslation(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : curMeta.translation ? (
                <div className="lt-helper__body">
                  <p className="lt-helper__text">{curMeta.translation}</p>
                  <div className="lt-helper__actions">
                    <button
                      className="sc-btn sc-btn--ghost sc-btn--sm"
                      onClick={() => {
                        setTranslationDraft(curMeta.translation || "");
                        setEditingTranslation(true);
                      }}
                    >
                      <BorderColorIcon fontSize="small" /> Edit
                    </button>
                    <button
                      className="sc-btn sc-btn--ghost sc-btn--sm"
                      onClick={handleTranslate}
                      disabled={translating}
                    >
                      <TranslateIcon fontSize="small" /> {translating ? "…" : "Retranslate"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="sc-btn sc-btn--ghost sc-btn--sm"
                  onClick={handleTranslate}
                  disabled={translating}
                >
                  <TranslateIcon fontSize="small" /> {translating ? "Translating…" : "Translate"}
                </button>
              )}
            </div>

            {/* Note */}
            <div className="lt-helper">
              <div className="lt-helper__head">
                <span className="sc-section-label sc-section-label--row">
                  <StickyNote2Icon fontSize="inherit" /> Note
                </span>
              </div>
              {editingNote ? (
                <div className="lt-helper__edit">
                  <textarea
                    rows={2}
                    value={sentenceNoteDraft}
                    onChange={(e) => setSentenceNoteDraft(e.target.value)}
                    placeholder="Add a note for this sentence…"
                  />
                  <div className="lt-helper__actions">
                    <button className="sc-btn sc-btn--primary sc-btn--sm" onClick={saveNote}>
                      Save
                    </button>
                    <button
                      className="sc-btn sc-btn--ghost sc-btn--sm"
                      onClick={() => setEditingNote(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : curMeta.note ? (
                <div className="lt-helper__body">
                  <p className="lt-helper__text">{curMeta.note}</p>
                  <button
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    onClick={() => {
                      setSentenceNoteDraft(curMeta.note || "");
                      setEditingNote(true);
                    }}
                  >
                    <BorderColorIcon fontSize="small" /> Edit note
                  </button>
                </div>
              ) : (
                <button
                  className="sc-btn sc-btn--ghost sc-btn--sm"
                  onClick={() => {
                    setSentenceNoteDraft("");
                    setEditingNote(true);
                  }}
                >
                  <StickyNote2Icon fontSize="small" /> + Note
                </button>
              )}
            </div>
          </div>
        )}

        {isRevealed && current && (
          <div className="lt-reveal" data-tour="lt-reveal">
            <div className="lt-reveal__score">
              {result?.score === 100 ? (
                <span className="lt-reveal__badge is-good">
                  <CheckCircleIcon fontSize="small" /> Perfect
                </span>
              ) : (
                <span className={`lt-reveal__badge ${result?.score >= 50 ? "is-mid" : "is-low"}`}>
                  {result?.correct}/{result?.total} words • {result?.score}%
                </span>
              )}
            </div>
            <span className="sc-section-label">Correct answer — select a word to look it up</span>
            <p className="lt-reveal__text" onMouseUp={() => handleSelection(current.text)}>
              {(current.tokens || []).map((tok, i) => {
                const disp = tokenDisplay(tok);
                const norm = normalizeWord(disp);
                const ok = result?.tokensCorrect ? result.tokensCorrect[i] : true;
                const cls = [
                  "lt-token",
                  ok ? "is-correct" : "is-wrong",
                  highlightSet.has(norm) ? "lt-token--note" : "",
                  termSet.has(norm) ? "lt-token--term" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <React.Fragment key={i}>
                    <span
                      className={cls}
                      onClick={(e) => {
                        e.stopPropagation();
                        openVocab(disp, current.text);
                      }}
                    >
                      {disp}
                    </span>
                    {i < (current.tokens || []).length - 1 ? " " : ""}
                  </React.Fragment>
                );
              })}
            </p>
            {(inputs[idx] || "").trim() && (
              <p className="lt-reveal__typed">
                <span className="sc-section-label">You typed</span>
                {inputs[idx]}
              </p>
            )}
            <div className="lt-reveal__pron">
              <span className="sc-section-label sc-section-label--row">
                <RecordVoiceOverIcon fontSize="inherit" /> Pronunciation — tap a word for IPA &amp; audio
              </span>
              <PronunciationText text={current.text} />
            </div>
            {current.explanation && <p className="lt-reveal__note">{current.explanation}</p>}
          </div>
        )}

        {/* Actions */}
        <div className="lt-actions">
          <button className="sc-btn sc-btn--ghost" onClick={() => goTo(idx - 1)} disabled={idx === 0}>
            <NavigateBeforeIcon fontSize="small" /> Prev
          </button>
          {!isRevealed ? (
            <>
              <button className="sc-btn sc-btn--ghost" onClick={revealSentence}>
                <VisibilityIcon fontSize="small" /> Reveal
              </button>
              <button className="sc-btn sc-btn--primary lt-check" onClick={checkSentence}>
                <CheckCircleIcon fontSize="small" /> Check
              </button>
            </>
          ) : idx < sentences.length - 1 ? (
            <button className="sc-btn sc-btn--primary lt-check" onClick={() => goTo(idx + 1)}>
              Next <NavigateNextIcon fontSize="small" />
            </button>
          ) : (
            <button className="sc-btn sc-btn--primary lt-check" onClick={finishExercise}>
              <EmojiEventsIcon fontSize="small" /> Finish
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      {finished && (
        <div className="lt-summary" data-tour="lt-summary">
          <div className="lt-summary__score">
            <EmojiEventsIcon />
            <div>
              <strong>{overallScore(lines)}%</strong>
              <span>{answeredCount} / {sentences.length} sentences</span>
            </div>
          </div>
          <div className="lt-summary__actions">
            <button className="sc-btn sc-btn--ghost" onClick={restartAll}>
              <RestartAltIcon fontSize="small" /> Practice again
            </button>
            {exercise.next_id && (
              <button
                className="sc-btn sc-btn--primary"
                onClick={() => navigate(`/listening/exercise/${exercise.next_id}/listen-and-type`)}
              >
                Next exercise <NavigateNextIcon fontSize="small" />
              </button>
            )}
          </div>
        </div>
      )}

      <VocabModal
        selected={selected}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        highlighted={selected ? isHighlighted(selected.text) : false}
        termMatch={selected ? findTermMatch(selected.text) : null}
        showHighlightControls
        onClose={() => setSelected(null)}
        onRetry={() => openVocab(selected?.text, selected?.context)}
        onSpeak={(text) => browserSpeak(text)}
        onSaveTerm={saveSelectionAsTerm}
        onToggleHighlight={toggleHighlight}
        onOpenTerm={openTermPage}
        onRemoveTerm={removeTermFromDeck}
      />
    </div>
  );
}
