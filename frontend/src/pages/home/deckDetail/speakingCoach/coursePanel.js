import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import { Pagination } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import MicIcon from "@mui/icons-material/Mic";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import SchoolIcon from "@mui/icons-material/School";
import TheaterComedyIcon from "@mui/icons-material/TheaterComedy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { selectUser } from "@app/store/authSlice";
import { COURSE_PAGE_SIZE } from "@constants/pageSize";
import { courseService } from "@api-services/courseService";
import { speakingService } from "@api-services/speakingService";
import { termService } from "@api-services/termService";
import SessionAnalysis from "./sessionAnalysis";
import VocabModal from "./vocabModal";
import { renderMarkedText } from "./vocabMarks";
import { blobToWav } from "./audioWav";

// A role-play passes when the averaged score clears this (mirrors the backend's
// COURSE_PASS_THRESHOLD); used only to label a replayed result on revisit.
const PASS_THRESHOLD = 80;

function errorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.errors) return typeof err.errors === "string" ? err.errors : fallback;
  return fallback;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// A line's audio is cached per voice + text, so two characters speaking the same
// sentence (different voices) get their own clip.
function lineKey(line) {
  return `${line?.voice || ""}|${line?.text || ""}`;
}

// Deterministic avatar tint from a character name (uses the brand hue range so
// it always reads on-theme in light and dark mode).
function avatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return { background: `hsl(${hash}, 55%, 55%)` };
}

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

// Character art + backgrounds are mirrored to our own Cloudinary at crawl time
// and stored as URLs on the lesson. The "video" is reconstructed from these
// layered PNGs + the scene timing, not a real video file. For lessons crawled
// before mirroring we fall back to freeCodeCamp's CDN.
const FCC_IMG_BASE = "https://cdn.freecodecamp.org/curriculum/english/animation-assets/images";
const FIGURE_LAYERS = ["base", "brows-normal", "eyes-open", "mouth-smile", "glasses"];

function characterFolder(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function backgroundUrl(background) {
  if (!background) return null;
  if (/^https?:\/\//.test(background)) return background; // mirrored URL
  return `${FCC_IMG_BASE}/backgrounds/${background}`; // legacy filename fallback
}

// One illustrated character: stacked image layers, dimmed when another speaker
// is active, emphasized when it's their turn. Falls back to an initial avatar.
function StageFigure({ name, images, side, active, dim }) {
  const [baseFailed, setBaseFailed] = useState(false);
  const stored = images && Object.keys(images).length > 0;
  const layers = stored
    ? FIGURE_LAYERS.filter((layer) => images[layer]).map((layer) => ({ layer, src: images[layer] }))
    : FIGURE_LAYERS.map((layer) => ({
        layer,
        src: `${FCC_IMG_BASE}/characters/${characterFolder(name)}/${layer}.png`,
      }));
  const hasArt = layers.some((l) => l.layer === "base") && !baseFailed;
  return (
    <div className={`sc-course-figure side-${side} ${active ? "is-active" : ""} ${dim ? "is-dim" : ""}`}>
      <div className="sc-course-figure__layers">
        {hasArt ? (
          layers.map(({ layer, src }) => (
            <img
              key={layer}
              src={src}
              alt=""
              loading="lazy"
              onError={
                layer === "base"
                  ? () => setBaseFailed(true)
                  : (e) => {
                      e.currentTarget.style.display = "none";
                    }
              }
            />
          ))
        ) : (
          <span className="sc-course-figure__fallback" style={avatarStyle(name)}>
            {initials(name)}
          </span>
        )}
      </div>
      <span className="sc-course-figure__name">{name}</span>
    </div>
  );
}

function ProgressBar({ passed, total }) {
  const pct = total ? Math.round((passed / total) * 100) : 0;
  return (
    <div className="sc-course-progress" aria-label={`${passed} of ${total} lessons passed`}>
      <div className="sc-course-progress__track">
        <div className="sc-course-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {passed}/{total} passed
      </span>
    </div>
  );
}

export default function CoursePanel({ basePath = "/speaking-coach/course" }) {
  const navigate = useNavigate();
  const { courseId: routeCourseId, lessonId: routeLessonId } = useParams();

  // Stage is derived from the URL so courses and lessons are deep-linkable
  // (relative to `basePath`, which lets this panel be mounted both inside the
  // Speaking Coach tabs and as the standalone /course page):
  //   {basePath}                       → catalog
  //   {basePath}/:courseId             → course
  //   {basePath}/:courseId/:lessonId   → lesson
  const stage = routeLessonId ? "lesson" : routeCourseId ? "course" : "catalog";

  const [catalog, setCatalog] = useState([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogCount, setCatalogCount] = useState(0);
  const [levels, setLevels] = useState([]);
  const [levelFilter, setLevelFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);

  const currentUser = useSelector(selectUser);
  const isAdmin = !!currentUser?.is_superuser;

  // ── Audio (one decoded buffer per dialogue line, keyed by voice|text) ──
  const audioCtxRef = useRef(null);
  const buffersRef = useRef(new Map());
  const sourceRef = useRef(null);
  const [playingLine, setPlayingLine] = useState(null);

  // ── Role-play ─────────────────────────────────────────────────────────
  const [rpActive, setRpActive] = useState(false);
  const [rpCharacter, setRpCharacter] = useState(null);
  const [rpIndex, setRpIndex] = useState(null);
  const [rpRecording, setRpRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null);
  // Per-sentence breakdown of the latest role-play (same UI as the Speaking
  // Coach). Each: { id, text, result: { ...analysis, userAudioUrl? } }.
  const [sessions, setSessions] = useState([]);
  const recorderRef = useRef(null);
  const recChunksRef = useRef([]);
  // One { line, blob } per spoken turn so each can be scored + replayed on its own.
  const sessionTurnsRef = useRef([]);
  const rpIndexRef = useRef(null);

  // ── Vocabulary coach + highlighting (inherited from the Speaking Coach) ──
  const [selected, setSelected] = useState(null); // vocab popup
  const [noteDraft, setNoteDraft] = useState("");
  const [highlights, setHighlights] = useState([]); // user notes for this lesson
  const [termMatches, setTermMatches] = useState([]); // user's saved terms in this lesson
  const [savedWords, setSavedWords] = useState({});

  // ── Scene playback (the illustrated "video") ──────────────────────────
  const [scenePlaying, setScenePlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(null);
  const scenePlayingRef = useRef(false);

  const ensureCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  const stopSource = useCallback(() => {
    const src = sourceRef.current;
    sourceRef.current = null;
    if (src) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    setPlayingLine(null);
  }, []);

  // Fetch the available level filters once.
  useEffect(() => {
    courseService.getLevels().then((res) => {
      if (Array.isArray(res.data?.levels)) setLevels(res.data.levels);
    });
  }, []);

  // Fetch one page of the catalog (10 courses) whenever the page or level changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    courseService
      .getCatalog(catalogPage, levelFilter)
      .then((res) => {
        if (!active) return;
        const data = res.data;
        if (Array.isArray(data)) {
          setCatalog(data);
          setCatalogCount(data.length);
        } else {
          setCatalog(Array.isArray(data?.results) ? data.results : []);
          setCatalogCount(Number.isFinite(data?.count) ? data.count : 0);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogPage, levelFilter]);

  // Changing the level filter resets to the first page.
  const selectLevel = (level) => {
    setLevelFilter(level);
    setCatalogPage(1);
  };

  // Tear down audio on unmount.
  useEffect(
    () => () => {
      stopSource();
      audioCtxRef.current?.close?.();
    },
    [stopSource]
  );

  const openCourse = (slug) => navigate(`${basePath}/${slug}`);
  const openLesson = (lsn) => navigate(`${basePath}/${routeCourseId}/${lsn.id}`);

  // Admin-only: delete a course from the catalog, then refresh the current page
  // (stepping back a page if we just removed its last item).
  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? This removes all its lessons.`)) return;
    const res = await courseService.deleteCourse(course.slug);
    if (res.error) {
      toast.error("Could not delete this course.");
      return;
    }
    toast.success(`"${course.title}" deleted.`);
    if (catalog.length === 1 && catalogPage > 1) {
      // Removed the last item on a trailing page — step back (effect refetches).
      setCatalogPage((p) => p - 1);
      return;
    }
    const r = await courseService.getCatalog(catalogPage, levelFilter);
    const data = r.data;
    setCatalog(Array.isArray(data) ? data : data?.results || []);
    setCatalogCount(Array.isArray(data) ? data.length : data?.count || 0);
  };

  // Fetch the course detail whenever the :courseId in the URL changes.
  useEffect(() => {
    if (!routeCourseId) {
      setCourse(null);
      return;
    }
    if (course?.slug === routeCourseId) return;
    let active = true;
    setLoading(true);
    courseService
      .getCourse(routeCourseId)
      .then((res) => {
        if (!active) return;
        setLoading(false);
        if (res.data?.id) {
          setCourse(res.data);
        } else {
          toast.error("Could not open this course.");
          navigate(basePath, { replace: true });
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCourseId]);

  // Open the lesson named by the :lessonId in the URL (once its course loaded).
  useEffect(() => {
    if (!routeLessonId) {
      setLesson(null);
      setResult(null);
      setSessions([]);
      setSelected(null);
      setHighlights([]);
      setTermMatches([]);
      setRpActive(false);
      scenePlayingRef.current = false;
      setScenePlaying(false);
      setSceneIndex(null);
      stopSource();
      buffersRef.current.clear();
      return;
    }
    if (!course) return; // wait for the course detail to arrive
    const found = (course.sections || [])
      .flatMap((s) => s.lessons)
      .find((l) => String(l.id) === String(routeLessonId));
    if (!found) {
      toast.error("Lesson not found.");
      navigate(`${basePath}/${routeCourseId}`, { replace: true });
      return;
    }
    if (lesson?.id === found.id) return; // already open (e.g. progress refresh)
    stopSource();
    scenePlayingRef.current = false;
    setScenePlaying(false);
    setSceneIndex(null);
    buffersRef.current.clear();
    setSelected(null);
    setRpActive(false);
    setLesson(found);

    // Replay the last saved role-play breakdown + re-highlight noted words, so
    // revisiting a lesson restores the user's previous analysis.
    const saved = found.progress?.last_result;
    if (saved?.sessions?.length) {
      setSessions(saved.sessions);
      setResult({ score: saved.score, passed: saved.passed, threshold: PASS_THRESHOLD });
    } else {
      setSessions([]);
      setResult(null);
    }
    setHighlights(found.progress?.highlights || []);

    // Underline the user's own saved terms that appear in this lesson's lines.
    const texts = (found.lines || []).map((l) => l.text || "");
    speakingService.matchTerms({ texts }).then((r) => {
      if (r.data?.matches) setTermMatches(r.data.matches);
    });

    if (!found.has_audio) return undefined;
    let active = true;
    courseService
      .getLessonAudio(found.id)
      .then(async (res) => {
        const ctx = ensureCtx();
        for (const item of res.data?.lines || []) {
          if (!active || !item.audio) continue;
          try {
            const bytes = base64ToBytes(item.audio);
            const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
            buffersRef.current.set(lineKey(item), buffer);
          } catch {
            /* skip a clip that fails to decode */
          }
        }
      })
      .catch(() => {
        /* audio optional — transcript still works */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLessonId, course]);

  // Play one dialogue line's generated character clip in full.
  const playLine = useCallback(
    (line, onEnd) => {
      const buffer = buffersRef.current.get(lineKey(line));
      const ctx = audioCtxRef.current;
      if (!buffer || !ctx) {
        onEnd?.();
        return;
      }
      stopSource();
      ctx.resume?.();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => {
        if (sourceRef.current === src) sourceRef.current = null;
        setPlayingLine(null);
        onEnd?.();
      };
      sourceRef.current = src;
      setPlayingLine(line.text);
      src.start(0);
    },
    [stopSource]
  );

  // Speak arbitrary text (a selected word, or an analysis word) via the tutor
  // TTS. Used by the vocabulary popup and the per-sentence analysis cards.
  const speakText = useCallback(
    async (text) => {
      const clean = (text || "").trim();
      if (!clean) return;
      try {
        const res = await speakingService.generateSpeech(clean);
        if (res.error || !res.data?.audio) return;
        const ctx = ensureCtx();
        await ctx.resume?.();
        const bytes = base64ToBytes(res.data.audio);
        const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        stopSource();
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.onended = () => {
          if (sourceRef.current === src) sourceRef.current = null;
        };
        sourceRef.current = src;
        src.start(0);
      } catch {
        /* playback is best-effort */
      }
    },
    [ensureCtx, stopSource]
  );

  // Play the reference (character) clip for a transcript line by its text.
  const playReferenceForText = useCallback(
    (text) => {
      const line = (lesson?.lines || []).find((l) => l.text === text);
      if (line) playLine(line);
      else speakText(text);
    },
    [lesson, playLine, speakText]
  );

  // ── Vocabulary coach + highlighting ───────────────────────────────────
  // Open the popup for an explicit word/phrase. Backend caches enrich +
  // explain_phrase, so re-opening a noted highlight costs no extra AI call.
  const openVocab = useCallback(async (rawText, lineText) => {
    const text = (rawText || "").trim();
    if (!text || text.length < 2 || text.length > 80) return;
    setSelected({ text, context: lineText, loading: true });
    try {
      const [enrichRes, explainRes] = await Promise.all([
        termService.aiEnrich(text, ""),
        speakingService.explainPhrase(text, lineText),
      ]);
      setSelected((prev) =>
        prev && prev.text === text
          ? { ...prev, loading: false, fields: enrichRes.data || {}, explain: explainRes.data || {} }
          : prev
      );
    } catch {
      setSelected((prev) =>
        prev && prev.text === text
          ? { ...prev, loading: false, error: "Failed to load. Tap retry." }
          : prev
      );
    }
  }, []);

  const handleSelection = (lineText) => {
    const text = window.getSelection?.()?.toString().trim();
    if (text) openVocab(text, lineText);
  };

  const isHighlighted = useCallback(
    (text) => highlights.some((h) => (h.text || "").toLowerCase() === (text || "").toLowerCase()),
    [highlights]
  );

  const toggleHighlight = async (remove = false) => {
    if (!lesson?.id || !selected?.text) return;
    const res = await courseService.setHighlight(lesson.id, {
      text: selected.text,
      note: noteDraft,
      remove,
    });
    if (res.error) {
      toast.error("Could not update highlight.");
      return;
    }
    setHighlights(res.data?.highlights || []);
    toast.success(remove ? "Highlight removed." : "Saved to this lesson.");
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
    // Re-highlight: the phrase is now one of the user's terms.
    const texts = (lesson?.lines || []).map((l) => l.text || "");
    speakingService.matchTerms({ texts }).then((r) => {
      if (r.data?.matches) setTermMatches(r.data.matches);
    });
  };

  const saveWordAsTerm = async (word) => {
    const res = await termService.addToDefaultDeck({
      name: word.word,
      meaning: word.feedback || "",
      pronunciation: word.ipaTarget || "",
      ai_filled: false,
    });
    if (res.error) {
      toast.error(errorMessage(res.error, "Could not save term."));
      return;
    }
    setSavedWords((prev) => ({ ...prev, [word.word]: true }));
    toast.success(`"${word.word}" saved to your default deck.`);
  };

  const saveSentence = async (text) => {
    const name = (text || "").trim();
    if (!name) return;
    const res = await termService.addToDefaultDeck({ name, ai_filled: false });
    if (res.error) {
      toast.error(errorMessage(res.error, "Could not save sentence."));
      return;
    }
    toast.success("Sentence saved to your default deck.");
  };

  // Seed the note input with any existing note whenever a new word is opened.
  useEffect(() => {
    if (!selected?.text) return;
    const existing = highlights.find(
      (h) => (h.text || "").toLowerCase() === selected.text.toLowerCase()
    );
    setNoteDraft(existing?.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.text]);

  // ── Role-play flow ────────────────────────────────────────────────────
  const beginRolePlay = (characterName) => {
    if (!lesson?.lines?.length) return;
    setResult(null);
    setSessions([]);
    setRpCharacter(characterName);
    setRpActive(true);
    sessionTurnsRef.current = [];
    stepRolePlay(0, characterName);
  };

  const cancelRolePlay = () => {
    stopSource();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      rec.stream?.getTracks().forEach((t) => t.stop());
    }
    recorderRef.current = null;
    rpIndexRef.current = null;
    setRpActive(false);
    setRpIndex(null);
    setRpRecording(false);
  };

  const stepRolePlay = (index, characterName = rpCharacter) => {
    const lines = lesson.lines;
    if (index >= lines.length) {
      finishRolePlay();
      return;
    }
    rpIndexRef.current = index;
    setRpIndex(index);
    const line = lines[index];
    if (line.speaker === characterName) {
      // The learner speaks this line — wait for them to record.
      return;
    }
    playLine(line, () => stepRolePlay(index + 1, characterName));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recChunksRef.current = [];
      recorder.ondataavailable = (e) => recChunksRef.current.push(e.data);
      recorder.start();
      setRpRecording(true);
    } catch {
      toast.error("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      const blob = new Blob(recChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      recorder.stream?.getTracks().forEach((t) => t.stop());
      const line = lesson?.lines?.[rpIndexRef.current];
      if (line) sessionTurnsRef.current.push({ line, blob });
      setRpRecording(false);
      stepRolePlay(rpIndexRef.current + 1);
    };
    recorder.stop();
  };

  const finishRolePlay = async () => {
    setRpActive(false);
    setRpIndex(null);
    rpIndexRef.current = null;
    const turns = sessionTurnsRef.current;
    if (!turns.length) return;
    setScoring(true);
    try {
      // Score each spoken line on its own (mirrors the Speaking Coach), so the
      // result is one reliable section per sentence instead of a merged score.
      const segments = [];
      for (const { line, blob } of turns) {
        // eslint-disable-next-line no-await-in-loop
        const { base64: audio } = await blobToWav(blob);
        segments.push({ target_text: line.text, audio, mime_type: "audio/wav" });
      }
      const res = await courseService.submitRolePlay({ lessonId: lesson.id, segments });
      if (res.data?.progress) {
        // Pair each returned per-sentence result with its local recording for replay.
        const built = (res.data.sessions || []).map((s, i) => ({
          ...s,
          result: {
            ...s.result,
            userAudioUrl: turns[i] ? URL.createObjectURL(turns[i].blob) : undefined,
          },
        }));
        setSessions(built);
        setResult({
          score: res.data.score,
          passed: res.data.passed,
          threshold: res.data.threshold,
        });
        setLesson((prev) => ({ ...prev, progress: res.data.progress }));
        if (res.data.passed) toast.success("Lesson passed! 🎉");
        else toast.info(`Score ${res.data.score}. Reach ${res.data.threshold} to pass.`);
        // Reflect new pass state in the course tree on the way back.
        if (course) refreshCourseProgress(lesson.id, res.data.progress);
      } else {
        toast.error("Could not score your role-play.");
      }
    } catch {
      toast.error("Could not score your role-play.");
    } finally {
      setScoring(false);
    }
  };

  const refreshCourseProgress = (lessonId, progress) => {
    setCourse((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) => (l.id === lessonId ? { ...l, progress } : l)),
      }));
      return { ...prev, sections };
    });
  };

  // ── Scene playback: step through lines in sync with the dialogue audio ──
  const stopScene = useCallback(() => {
    scenePlayingRef.current = false;
    setScenePlaying(false);
    setSceneIndex(null);
    stopSource();
  }, [stopSource]);

  const stepScene = (index) => {
    if (!scenePlayingRef.current) return;
    const lines = lesson.lines;
    if (index >= lines.length) {
      stopScene();
      return;
    }
    setSceneIndex(index);
    playLine(lines[index], () => {
      if (scenePlayingRef.current) stepScene(index + 1);
    });
  };

  const playScene = () => {
    if (scenePlaying) {
      stopScene();
      return;
    }
    if (!lesson?.lines?.length || !lesson.has_audio) return;
    setResult(null);
    scenePlayingRef.current = true;
    setScenePlaying(true);
    stepScene(0);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  // Full-page spinner only on the very first catalog load (or while a course is
  // still loading); filter/page switches keep the previous results on screen.
  if (loading && ((stage === "catalog" && catalog.length === 0) || (stage !== "catalog" && !course))) {
    return (
      <div className="sc-loading">
        <div className="sc-spinner" />
        <h4>Loading courses…</h4>
      </div>
    );
  }

  if (stage === "catalog") {
    return (
      <div className="sc-course" data-tour="sc-course-catalog">
        <div className="sc-course__intro">
          <h3>
            <SchoolIcon fontSize="small" /> Guided courses
          </h3>
          <p>Work through structured dialogues. Pass each lesson with a Live Role-play.</p>
        </div>
        {levels.length > 0 && (
          <div className="sc-course__filters" role="group" aria-label="Filter courses by level">
            <button
              type="button"
              className={`sc-course__filter ${levelFilter === "" ? "is-active" : ""}`}
              onClick={() => selectLevel("")}
            >
              All levels
            </button>
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`sc-course__filter ${levelFilter === lvl ? "is-active" : ""}`}
                onClick={() => selectLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        )}
        {catalog.length === 0 ? (
          <div className="sc-course__empty">
            {levelFilter
              ? `No ${levelFilter} courses found. Try a different level.`
              : "No courses imported yet. Run the course importer to populate them."}
          </div>
        ) : (
          <>
            <div className="sc-course__grid">
              {catalog.map((c) => {
                const pct = c.total_lessons
                  ? Math.round((c.passed_lessons / c.total_lessons) * 100)
                  : 0;
                return (
                  <div key={c.id} className="sc-course-card-wrap">
                    <button className="sc-course-card" onClick={() => openCourse(c.slug)}>
                      <div
                        className="sc-course-card__cover"
                        style={c.background ? { backgroundImage: `url(${c.background})` } : undefined}
                      >
                        {!c.background && (
                          <span className="sc-course-card__cover-icon">
                            <SchoolIcon />
                          </span>
                        )}
                        <span className="sc-course-card__level">{c.level || "Course"}</span>
                        {pct === 100 && c.total_lessons > 0 && (
                          <span className="sc-course-card__done">
                            <CheckCircleIcon fontSize="small" /> Done
                          </span>
                        )}
                      </div>
                      <div className="sc-course-card__body">
                        <h4>{c.title}</h4>
                        <p>{c.description}</p>
                        <ProgressBar passed={c.passed_lessons} total={c.total_lessons} />
                      </div>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="sc-course-card__delete"
                        title="Delete course"
                        aria-label={`Delete ${c.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(c);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {catalogCount > COURSE_PAGE_SIZE && (
              <div className="sc-course__pagination">
                <Pagination
                  count={Math.ceil(catalogCount / COURSE_PAGE_SIZE)}
                  page={catalogPage}
                  onChange={(_, value) => setCatalogPage(value)}
                  color="primary"
                  shape="rounded"
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (stage === "course" && course) {
    return (
      <div className="sc-course">
        <button className="sc-course__back" onClick={() => navigate(basePath)}>
          <ArrowBackIcon fontSize="small" /> All courses
        </button>
        <div className="sc-course__intro">
          <span className="sc-course-card__level">{course.level}</span>
          <h3>{course.title}</h3>
          <p>{course.description}</p>
        </div>
        {course.sections.map((section) => (
          <section key={section.id} className="sc-course-section">
            <h4>{section.title}</h4>
            <div className="sc-course-lessons">
              {section.lessons.map((l) => {
                const passed = l.progress?.status === "passed";
                return (
                  <button key={l.id} className="sc-course-lesson-row" onClick={() => openLesson(l)}>
                    <span className={`sc-course-lesson-row__icon ${passed ? "is-passed" : ""}`}>
                      {passed ? (
                        <CheckCircleIcon fontSize="small" />
                      ) : (
                        <RadioButtonUncheckedIcon fontSize="small" />
                      )}
                    </span>
                    <span className="sc-course-lesson-row__title">{l.title}</span>
                    {l.progress?.best_score > 0 && (
                      <span className="sc-course-lesson-row__score">Best {l.progress.best_score}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (stage === "lesson" && lesson) {
    const passed = lesson.progress?.status === "passed";

    // Each character is placed on the side their lines are aligned to (Maria
    // left, Tom right, …) — derived from the scene's per-line `align`.
    const sideByName = {};
    for (const line of lesson.lines || []) {
      if (line.speaker && !(line.speaker in sideByName)) {
        sideByName[line.speaker] = line.align === "right" ? "right" : "left";
      }
    }
    // Whoever is "on stage" right now: the scene step, or the role-play turn.
    const activeIndex = scenePlaying ? sceneIndex : rpActive ? rpIndex : null;
    const activeLine = activeIndex != null ? lesson.lines[activeIndex] : null;
    const activeSpeaker = activeLine?.speaker || null;

    return (
      <div className="sc-course sc-course-lesson">
        <button
          className="sc-course__back"
          onClick={() => navigate(`${basePath}/${course?.slug || routeCourseId}`)}
        >
          <ArrowBackIcon fontSize="small" /> Back to lessons
        </button>

        <div className="sc-course-lesson__head">
          <h3>{lesson.title}</h3>
          {passed && (
            <span className="sc-course-badge is-passed">
              <CheckCircleIcon fontSize="small" /> Passed
            </span>
          )}
        </div>

        {lesson.characters?.length > 0 && (
          <div
            className="sc-course-stage"
            style={
              backgroundUrl(lesson.background)
                ? { backgroundImage: `url(${backgroundUrl(lesson.background)})` }
                : undefined
            }
          >
            <div className="sc-course-stage__cast">
              {lesson.characters.map((c) => (
                <StageFigure
                  key={c.name}
                  name={c.name}
                  images={c.images}
                  side={sideByName[c.name] || "left"}
                  active={activeSpeaker === c.name}
                  dim={!!activeSpeaker && activeSpeaker !== c.name}
                />
              ))}
            </div>

            {activeLine && (
              <div className={`sc-course-stage__caption ${activeLine.align === "right" ? "is-right" : ""}`}>
                <strong>{activeLine.speaker}</strong>
                <span>{activeLine.text}</span>
              </div>
            )}

            {lesson.has_audio && !rpActive && (
              <button
                className={`sc-course-stage__play ${scenePlaying ? "is-playing" : ""}`}
                onClick={playScene}
              >
                {scenePlaying ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                {scenePlaying ? "Stop" : "Play scene"}
              </button>
            )}
          </div>
        )}

        {/* Live Role-play */}
        {!rpActive && (
          <div className="sc-course-roleplay-setup" data-tour="sc-course-roleplay">
            <div className="sc-course-roleplay-setup__text">
              <strong>
                <TheaterComedyIcon fontSize="small" /> Live Role-play
              </strong>
              <small>Pick a character and speak their lines. Score {lesson.progress?.best_score ? `your best is ${lesson.progress.best_score}` : "to pass"}.</small>
            </div>
            <div className="sc-course-roleplay-setup__pick">
              {(lesson.characters || []).map((c) => (
                <button key={c.name} disabled={scoring} onClick={() => beginRolePlay(c.name)}>
                  Play {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {scoring && (
          <div className="sc-course-scoring">
            <div className="sc-spinner" /> Scoring your role-play…
          </div>
        )}

        {result && !rpActive && (
          <div className={`sc-course-result ${result.passed ? "is-pass" : "is-fail"}`}>
            <span className="sc-course-result__score">{result.score}</span>
            <div>
              <strong>{result.passed ? "Passed!" : "Keep practicing"}</strong>
              <small>Pass mark: {result.threshold || PASS_THRESHOLD}</small>
            </div>
          </div>
        )}

        {/* Transcript */}
        {!rpActive && (
          <div className="sc-tip" data-tour="sc-course-vocab">
            <InfoOutlinedIcon fontSize="small" />
            <span>
              <strong>Tip:</strong> select any word or phrase to get its meaning, IPA and a
              speaking tip — then save it as a term or highlight it to revisit later. Words you
              already saved appear <mark className="sc-hl sc-hl--term">underlined</mark>; click them
              to study.
            </span>
          </div>
        )}
        <div className="sc-course-transcript">
          {lesson.lines.map((line, i) => {
            const isMine = rpActive && line.speaker === rpCharacter;
            const isCurrent = rpActive && rpIndex === i;
            return (
              <div
                key={i}
                className={`sc-course-line ${line.align === "right" ? "is-right" : ""} ${
                  isCurrent ? "is-current" : ""
                }`}
              >
                <span className="sc-course-line__avatar" style={avatarStyle(line.speaker)}>
                  {initials(line.speaker)}
                </span>
                <div className="sc-course-line__bubble">
                  <span className="sc-course-line__speaker">{line.speaker}</span>
                  <p
                    className="sc-course-line__text"
                    onMouseUp={!rpActive ? () => handleSelection(line.text) : undefined}
                  >
                    {rpActive
                      ? line.text
                      : renderMarkedText(line.text, {
                          highlights,
                          termMatches,
                          onNoteClick: (segment, full) => openVocab(segment, full),
                          onTermClick: (payload) => {
                            const url = payload.deck_id
                              ? `/deck/${payload.deck_id}/learn/${payload.term_id}`
                              : `/learn/${payload.term_id}`;
                            window.open(url, "_blank", "noopener");
                          },
                        })}
                  </p>
                  {!rpActive && (
                    <button
                      className="sc-course-line__play"
                      onClick={() => (playingLine === line.text ? stopSource() : playLine(line))}
                      disabled={!lesson.has_audio}
                    >
                      {playingLine === line.text ? (
                        <StopIcon fontSize="small" />
                      ) : (
                        <PlayArrowIcon fontSize="small" />
                      )}
                    </button>
                  )}
                  {isCurrent && isMine && (
                    <button
                      className={`sc-course-line__rec ${rpRecording ? "is-rec" : ""}`}
                      onClick={() => (rpRecording ? stopRecording() : startRecording())}
                    >
                      <MicIcon fontSize="small" /> {rpRecording ? "Stop & next" : "Record your line"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {rpActive && (
          <div className="sc-course-roleplay-bar">
            <span>Role-play as {rpCharacter}</span>
            <button onClick={cancelRolePlay}>Cancel</button>
          </div>
        )}

        {/* Study exercises (read-only) */}
        {lesson.exercises?.length > 0 && !rpActive && (
          <details className="sc-course-exercises">
            <summary>Study notes &amp; exercises ({lesson.exercises.length})</summary>
            {lesson.exercises.map((ex, i) => (
              <div className="sc-course-exercise" key={i}>
                {ex.prompt && <p className="sc-course-exercise__prompt">{ex.prompt}</p>}
                {ex.kind === "fill_blank" && ex.sentence && (
                  <p className="sc-course-exercise__sentence">
                    {ex.sentence}
                    {ex.blanks?.length > 0 && (
                      <em> → {ex.blanks.map((b) => b.answer).join(", ")}</em>
                    )}
                  </p>
                )}
                {ex.kind === "choice" &&
                  (ex.questions || []).map((q, qi) => (
                    <div key={qi} className="sc-course-exercise__q">
                      <p>{q.text}</p>
                      <ul>
                        {q.answers.map((a, ai) => (
                          <li key={ai}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ))}
          </details>
        )}

        {/* Per-sentence pronunciation breakdown (replayed on revisit) */}
        {sessions.length > 0 && !rpActive && (
          <div className="sc-result">
            <SessionAnalysis
              sessions={sessions}
              savedWords={savedWords}
              onSaveWord={saveWordAsTerm}
              onSaveSentence={saveSentence}
              onPlayWord={(text) => speakText(text)}
              onPlayReference={(text) => playReferenceForText(text)}
            />
          </div>
        )}

        <VocabModal
          selected={selected}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          isHighlighted={isHighlighted}
          showHighlightControls={!!lesson?.id}
          onClose={() => setSelected(null)}
          onRetry={() => openVocab(selected?.text, selected?.context)}
          onSpeak={(text) => speakText(text)}
          onSaveTerm={saveSelectionAsTerm}
          onToggleHighlight={toggleHighlight}
        />
      </div>
    );
  }

  return null;
}
