import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import HistoryIcon from "@mui/icons-material/History";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import MicIcon from "@mui/icons-material/Mic";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BorderColorIcon from "@mui/icons-material/BorderColor";

import { speakingService } from "@api-services/speakingService";
import { termService } from "@api-services/termService";
import { userSettingService } from "@api-services/userSettingService";
import LineAnalysis from "./lineAnalysis";
import { markSpeakingCoachPracticed } from "@utils/practiceBanner";

const ACCENTS = [
  { id: "US", label: "American (US)", lang: "en-US" },
  { id: "UK", label: "British (UK)", lang: "en-GB" },
  { id: "AU", label: "Australian (AU)", lang: "en-AU" },
];
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TONES = [
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "professional", label: "Professional" },
  { id: "humorous", label: "Humorous" },
  { id: "academic", label: "Academic" },
];
const FALLBACK_TOPICS = ["Ordering Coffee", "Job Interview", "Airport Check-in"];

// Tutor voices are loaded from the backend (ElevenLabs is the active provider;
// Gemini voices are legacy and only shown when an old conversation used one).
// This is just a safe fallback used before the API responds.
const FALLBACK_VOICES = [{ id: "Kore", label: "Kore — Warm & clear" }];
const DEFAULT_VOICE = "Kore";
// Short sample played when previewing a voice from the dropdown.
const VOICE_DEMO_TEXT = "Hi! This is how I sound. Let's practice speaking together.";

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function sampleRateFromMime(mime) {
  const match = /rate=(\d+)/.exec(mime || "");
  return match ? parseInt(match[1], 10) : 24000;
}

// Gemini (legacy) TTS returns raw 16-bit PCM; detect it so we decode correctly.
function isPcmMime(mime) {
  const m = (mime || "").toLowerCase();
  return m.includes("l16") || m.includes("pcm") || m.includes("rate=");
}

// Gemini TTS returns raw signed 16-bit little-endian PCM (mono).
function pcm16ToAudioBuffer(bytes, ctx, sampleRate) {
  const usable = bytes.byteLength - (bytes.byteLength % 2);
  const int16 = new Int16Array(bytes.buffer, 0, usable / 2);
  const buffer = ctx.createBuffer(1, int16.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;
  return buffer;
}

// Decode a cached clip to an AudioBuffer. Gemini → raw PCM; ElevenLabs → MP3
// (decoded via the Web Audio API).
async function decodeClip(entry, ctx) {
  const bytes = base64ToBytes(entry.audio);
  if (isPcmMime(entry.mimeType)) {
    return pcm16ToAudioBuffer(bytes, ctx, sampleRateFromMime(entry.mimeType));
  }
  // decodeAudioData detaches the buffer, so hand it a fresh copy.
  return ctx.decodeAudioData(bytes.buffer.slice(0));
}

function errorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.errors) return typeof err.errors === "string" ? err.errors : fallback;
  return fallback;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function SpeakingCoach() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();

  const [view, setView] = useState("practice"); // practice | history
  const [mode, setMode] = useState("topic"); // topic | custom
  const [vocabMode, setVocabMode] = useState(false); // build dialogue from saved words
  const [topic, setTopic] = useState("");
  const [customText, setCustomText] = useState("");
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [topicHistory, setTopicHistory] = useState([]);

  const [accent, setAccent] = useState("US");
  const [level, setLevel] = useState("B1");
  const [tone, setTone] = useState("casual");
  const [turns, setTurns] = useState(6);
  const [speed, setSpeed] = useState(1.0);
  const [userName, setUserName] = useState("Me");
  const [partnerName, setPartnerName] = useState("Coach");
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [demoVoice, setDemoVoice] = useState(null); // voice id currently previewing

  // Active tutor voices (from the backend) shown in the picker for new
  // conversations, plus a label map for legacy voices used by old conversations.
  const [ttsVoices, setTtsVoices] = useState(FALLBACK_VOICES);
  const [legacyVoiceMap, setLegacyVoiceMap] = useState({});
  // accent id -> default voice id, so switching accent switches the voice.
  const [accentDefaults, setAccentDefaults] = useState({});

  const [voices, setVoices] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);

  const [activeLineId, setActiveLineId] = useState(null);
  const [speakingLineId, setSpeakingLineId] = useState(null);
  const [fullPlayState, setFullPlayState] = useState("stopped"); // stopped | playing
  const [rolePlayIndex, setRolePlayIndex] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [savedWords, setSavedWords] = useState({});

  const [selected, setSelected] = useState(null); // vocab popup
  const [noteDraft, setNoteDraft] = useState("");
  const [termMatches, setTermMatches] = useState([]); // user's own terms in this convo
  const [history, setHistory] = useState({ conversations: [], analyses: [] });
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionChunksRef = useRef([]);
  const cancelFullRef = useRef(false);
  const rolePlayRef = useRef(null);
  const audioContextRef = useRef(null);
  const activeSourceRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const speedRef = useRef(1.0);
  const inflightRef = useRef(new Map());
  const conversationRef = useRef(null);

  // ---- Tutor voices (active + legacy) loaded from the backend ----
  useEffect(() => {
    let active = true;
    speakingService.getVoices().then((res) => {
      if (!active || !res.data) return;
      const list = res.data.voices?.length ? res.data.voices : FALLBACK_VOICES;
      setTtsVoices(list);
      const legacy = {};
      (res.data.legacy_voices || []).forEach((v) => {
        legacy[v.id] = v.label;
      });
      setLegacyVoiceMap(legacy);
      setAccentDefaults(res.data.accent_defaults || {});
      // Default to the active provider's voice for new conversations only; a
      // conversation opened by URL keeps the voice it was generated with.
      if (!routeId) {
        const initial = res.data.accent_defaults?.[accent] || res.data.default;
        if (initial) setSelectedVoice(initial);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Browser voices: only used as a fallback if Gemini TTS is unavailable ----
  useEffect(() => {
    const load = () => {
      if (!("speechSynthesis" in window)) return;
      const eng = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(eng);
    };
    load();
    if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = load;
    return () => window.speechSynthesis?.cancel();
  }, []);

  // Keep playback speed in sync, applying live to any line currently playing.
  useEffect(() => {
    speedRef.current = speed;
    if (activeSourceRef.current) activeSourceRef.current.playbackRate.value = speed;
  }, [speed]);

  // Tear down the shared AudioContext when leaving the page.
  useEffect(
    () => () => {
      try {
        audioContextRef.current?.close();
      } catch {
        /* ignore */
      }
    },
    []
  );

  // Refresh suggested topics whenever the chosen proficiency level changes;
  // topics are drawn from a curated table filtered by CEFR level.
  useEffect(() => {
    speakingService.suggestTopics([], level).then((res) => {
      setSuggestedTopics(res.data?.topics?.length ? res.data.topics : FALLBACK_TOPICS);
    });
  }, [level]);

  const pickVoice = useCallback(() => {
    const lang = ACCENTS.find((a) => a.id === accent)?.lang || "en-US";
    return (
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
      voices[0]
    );
  }, [accent, voices]);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new Ctx();
    }
    return audioContextRef.current;
  }, []);

  const stopCurrentSource = useCallback(() => {
    const src = activeSourceRef.current;
    activeSourceRef.current = null;
    if (src) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  // Last-resort fallback (e.g. no API key / quota) so playback never dead-ends.
  const browserSpeak = useCallback(
    (text, onEnd) =>
      new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
          onEnd?.();
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = speedRef.current;
        const v = pickVoice();
        if (v) u.voice = v;
        const done = () => {
          onEnd?.();
          resolve();
        };
        u.onend = done;
        u.onerror = done;
        window.speechSynthesis.speak(u);
      }),
    [pickVoice]
  );

  // Fetch one line's audio (cache-first). A single in-flight request per
  // (voice, text) is kept so look-ahead prefetch and actual playback never fire
  // two calls — TTS stays strictly one request at a time to avoid rate limits.
  const fetchAudio = useCallback(
    (text, voice = selectedVoice) => {
      const clean = (text || "").trim();
      const key = `${voice}:${clean}`;
      const cache = audioCacheRef.current;
      if (cache.has(key)) return Promise.resolve(cache.get(key));
      const inflight = inflightRef.current;
      if (inflight.has(key)) return inflight.get(key);

      const promise = speakingService
        .generateSpeech(clean, voice)
        .then((res) => {
          if (res.error || !res.data?.audio) throw new Error("tts-failed");
          const entry = {
            audio: res.data.audio,
            mimeType: res.data.mime_type || "audio/mpeg",
          };
          cache.set(key, entry);
          return entry;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
    [selectedVoice]
  );

  // Warm a line's audio in the background (used to fetch the next line a little
  // before the current one finishes, hiding the ~3-4s synthesis latency).
  const prefetchLine = useCallback(
    (text) => {
      if (text) fetchAudio(text).catch(() => {});
    },
    [fetchAudio]
  );

  const speak = useCallback(
    async (text, onEnd, onStart, voice) => {
      const clean = (text || "").trim();
      if (!clean) {
        onEnd?.();
        return;
      }
      stopCurrentSource();
      window.speechSynthesis?.cancel();
      let entry;
      try {
        entry = await fetchAudio(clean, voice);
      } catch {
        onStart?.();
        await browserSpeak(clean, onEnd);
        return;
      }
      try {
        const ctx = ensureAudioContext();
        if (ctx.state === "suspended") await ctx.resume();
        const buffer = await decodeClip(entry, ctx);
        onStart?.();
        await new Promise((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = speedRef.current;
          source.connect(ctx.destination);
          activeSourceRef.current = source;
          source.onended = () => {
            if (activeSourceRef.current === source) activeSourceRef.current = null;
            resolve();
          };
          source.start(0);
        });
        onEnd?.();
      } catch {
        await browserSpeak(clean, onEnd);
      }
    },
    [fetchAudio, ensureAudioContext, stopCurrentSource, browserSpeak]
  );

  const stopSpeaking = useCallback(() => {
    stopCurrentSource();
    window.speechSynthesis?.cancel();
    setSpeakingLineId(null);
  }, [stopCurrentSource]);

  // Play a short sample of a voice so the learner can compare voices before
  // committing. Uses an explicit voice (state updates are async) and reuses the
  // normal cache-first synth path.
  const previewVoice = useCallback(
    (voice) => {
      setDemoVoice(voice);
      speak(VOICE_DEMO_TEXT, () => setDemoVoice(null), undefined, voice).catch(() => setDemoVoice(null));
    },
    [speak]
  );

  // Switch accent and move to that accent's default voice (each ElevenLabs voice
  // has a fixed accent, so the voice follows the accent). Previews the new voice.
  const selectAccent = useCallback(
    (accentId) => {
      setAccent(accentId);
      const next = accentDefaults[accentId];
      if (next && next !== selectedVoice) {
        setSelectedVoice(next);
        previewVoice(next);
      }
    },
    [accentDefaults, selectedVoice, previewVoice]
  );

  // ---- Generate conversation ----
  const handleGenerate = async () => {
    setLoading(true);
    resetPracticeState();
    setConversation(null);
    try {
      const useVocab = mode === "topic" && vocabMode;
      const res = await speakingService.generateConversation({
        topic: useVocab ? "" : topic,
        accent,
        user_name: userName,
        partner_name: partnerName,
        custom_text: mode === "custom" ? customText : undefined,
        level,
        tone,
        turns,
        voice: selectedVoice,
        use_vocabulary: useVocab,
      });
      if (res.error || !res.data?.lines?.length) {
        toast.error("Could not generate a conversation. Please try again.");
        return;
      }
      setConversation(res.data);
      markSpeakingCoachPracticed();
      if (res.data.id) navigate(`/speaking-coach/${res.data.id}`);
      if (!useVocab && topic && !topicHistory.includes(topic)) {
        const next = [...topicHistory, topic];
        setTopicHistory(next);
        speakingService.suggestTopics(next, level).then((r) => {
          if (r.data?.topics?.length) setSuggestedTopics(r.data.topics);
        });
      }
    } catch {
      toast.error("Could not generate a conversation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  function resetPracticeState() {
    stopSpeaking();
    cancelFullRef.current = true;
    setFullPlayState("stopped");
    setRolePlayIndex(null);
    rolePlayRef.current = null;
    sessionChunksRef.current = [];
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setIsRecording(false);
    setAnalysisResult(null);
    setActiveLineId(null);
    setAnalyzing(false);
  }

  // ---- Line playback ----
  // onStart fires the moment audio begins, so callers can warm the next line.
  const playLine = async (line, onEnd, onStart) => {
    setActiveLineId(line.id);
    setSpeakingLineId(line.id);
    await speak(line.text, () => setSpeakingLineId(null), onStart);
    onEnd?.();
  };

  // ---- Full conversation playback ----
  const playFull = async () => {
    if (!conversation) return;
    cancelFullRef.current = false;
    setFullPlayState("playing");
    const lines = conversation.lines;
    for (let i = 0; i < lines.length; i++) {
      if (cancelFullRef.current) break;
      const next = lines[i + 1];
      // eslint-disable-next-line no-await-in-loop
      await playLine(lines[i], undefined, () => prefetchLine(next?.text));
    }
    if (!cancelFullRef.current) {
      setFullPlayState("stopped");
      setActiveLineId(null);
    }
  };

  const stopFull = () => {
    cancelFullRef.current = true;
    stopSpeaking();
    setFullPlayState("stopped");
    setActiveLineId(null);
  };

  // ---- Role play ----
  const startRolePlay = () => {
    if (!conversation) return;
    sessionChunksRef.current = [];
    setAnalysisResult(null);
    stepRolePlay(0);
  };

  const stepRolePlay = (index) => {
    if (!conversation || index >= conversation.lines.length) {
      finishRolePlay();
      return;
    }
    rolePlayRef.current = index;
    setRolePlayIndex(index);
    const line = conversation.lines[index];
    setActiveLineId(line.id);
    if (line.speaker === userName) {
      // wait for the user to record their line
      return;
    }
    // Warm the next coach-spoken line while this one plays (user lines are
    // recorded, not synthesized, so skip them).
    const nextSpoken = conversation.lines
      .slice(index + 1)
      .find((l) => l.speaker !== userName);
    playLine(line, () => stepRolePlay(index + 1), () => prefetchLine(nextSpoken?.text));
  };

  const finishRolePlay = async () => {
    setRolePlayIndex(null);
    rolePlayRef.current = null;
    setActiveLineId(null);
    if (!sessionChunksRef.current.length || !conversation) return;
    setAnalyzing(true);
    try {
      const blob = new Blob(sessionChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      });
      const audio = await blobToBase64(blob);
      const target = conversation.lines.map((l) => l.text).join(" ");
      const res = await speakingService.analyze({
        targetText: target,
        audio,
        mimeType: blob.type,
        kind: "full",
        conversationId: conversation.id,
      });
      if (res.data?.result) {
        setAnalysisResult({ ...res.data.result, userAudioUrl: URL.createObjectURL(blob) });
      } else {
        toast.error("Session evaluation failed.");
      }
    } catch {
      toast.error("Session evaluation failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ---- Recording ----
  const startRecording = async (lineId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.start();
      setIsRecording(true);
      setActiveLineId(lineId);
    } catch {
      toast.error("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = (lineText) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      recorder.stream?.getTracks().forEach((t) => t.stop());
      if (rolePlayRef.current !== null) {
        sessionChunksRef.current.push(blob);
        stepRolePlay(rolePlayRef.current + 1);
        return;
      }
      setAnalyzing(true);
      try {
        const audio = await blobToBase64(blob);
        const res = await speakingService.analyze({
          targetText: lineText,
          audio,
          mimeType: blob.type,
          kind: "single",
          conversationId: conversation?.id,
        });
        if (res.data?.result) {
          setAnalysisResult({ ...res.data.result, userAudioUrl: URL.createObjectURL(blob) });
        } else {
          toast.error("Pronunciation analysis failed. Please try again.");
        }
      } catch {
        toast.error("Pronunciation analysis failed. Please try again.");
      } finally {
        setAnalyzing(false);
      }
    };
    recorder.stop();
    setIsRecording(false);
  };

  // ---- Vocabulary popup (reuses term enrichment) ----
  // Open the coach for an explicit word/phrase. Backend caches enrich +
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
          ? {
              ...prev,
              loading: false,
              fields: enrichRes.data || {},
              explain: explainRes.data || {},
            }
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
    (text) =>
      (conversation?.highlights || []).some(
        (h) => (h.text || "").toLowerCase() === (text || "").toLowerCase()
      ),
    [conversation]
  );

  // Persist (or remove) a noted word/phrase on the current conversation so it
  // re-highlights on revisit.
  const toggleHighlight = async (remove = false) => {
    if (!conversation?.id || !selected?.text) return;
    const res = await speakingService.setHighlight(conversation.id, {
      text: selected.text,
      note: noteDraft,
      remove,
    });
    if (res.error) {
      toast.error("Could not update highlight.");
      return;
    }
    const highlights = res.data?.highlights || [];
    setConversation((prev) => (prev ? { ...prev, highlights } : prev));
    toast.success(remove ? "Highlight removed." : "Saved to this conversation.");
  };

  // Compute non-overlapping highlight ranges for a line: user notes win over
  // saved-term matches when they overlap.
  const buildMarks = useCallback(
    (text) => {
      const lower = text.toLowerCase();
      const isWordChar = (ch) => /[a-z0-9']/i.test(ch || "");
      const marks = [];
      const addOccurrences = (phrase, type, payload) => {
        const needle = (phrase || "").toLowerCase().trim();
        if (!needle) return;
        let from = 0;
        for (;;) {
          const idx = lower.indexOf(needle, from);
          if (idx === -1) break;
          const end = idx + needle.length;
          if (!isWordChar(lower[idx - 1]) && !isWordChar(lower[end])) {
            marks.push({ start: idx, end, type, payload });
          }
          from = end;
        }
      };
      (conversation?.highlights || []).forEach((h) => addOccurrences(h.text, "note", h));
      termMatches.forEach((m) => addOccurrences(m.name, "term", m));
      // Earliest first; on ties prefer notes, then the longest span.
      marks.sort(
        (a, b) =>
          a.start - b.start ||
          (a.type === b.type ? 0 : a.type === "note" ? -1 : 1) ||
          b.end - b.start - (a.end - a.start)
      );
      const out = [];
      let lastEnd = 0;
      for (const m of marks) {
        if (m.start >= lastEnd) {
          out.push(m);
          lastEnd = m.end;
        }
      }
      return out;
    },
    [conversation, termMatches]
  );

  const renderLineContent = (text) => {
    const marks = buildMarks(text);
    if (!marks.length) return text;
    const nodes = [];
    let cursor = 0;
    marks.forEach((m, i) => {
      if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
      const segment = text.slice(m.start, m.end);
      if (m.type === "note") {
        nodes.push(
          <mark
            key={`n${i}`}
            className="sc-hl sc-hl--note"
            title={m.payload.note ? `Note: ${m.payload.note}` : "Your highlight — click to view"}
            onClick={(e) => {
              e.stopPropagation();
              openVocab(segment, text);
            }}
          >
            {segment}
          </mark>
        );
      } else {
        nodes.push(
          <mark
            key={`t${i}`}
            className="sc-hl sc-hl--term"
            title="Saved term — open to study"
            onClick={(e) => {
              e.stopPropagation();
              const url = m.payload.deck_id
                ? `/deck/${m.payload.deck_id}/learn/${m.payload.term_id}`
                : `/learn/${m.payload.term_id}`;
              window.open(url, "_blank", "noopener");
            }}
          >
            {segment}
          </mark>
        );
      }
      cursor = m.end;
    });
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
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
    if (conversation?.id) {
      speakingService.matchTerms(conversation.id).then((r) => {
        if (r.data?.matches) setTermMatches(r.data.matches);
      });
    }
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

  const saveActiveSentence = async () => {
    const line = conversation?.lines.find((l) => l.id === activeLineId);
    if (!line) return;
    const res = await termService.addToDefaultDeck({ name: line.text, ai_filled: false });
    if (res.error) {
      toast.error(errorMessage(res.error, "Could not save sentence."));
      return;
    }
    toast.success("Sentence saved to your default deck.");
  };

  const swapRoles = () => {
    setUserName(partnerName);
    setPartnerName(userName);
  };

  const openHistory = async () => {
    setView("history");
    setSelectedIds(new Set());
    const res = await speakingService.getHistory();
    if (res.data) setHistory(res.data);
  };

  // Starred first, then most recent.
  const sortedConversations = useMemo(
    () =>
      [...history.conversations].sort((a, b) => {
        if (!!b.starred !== !!a.starred) return b.starred ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      }),
    [history.conversations]
  );

  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleStar = async (conv) => {
    const res = await speakingService.setStar(conv.id, !conv.starred);
    if (res.error) {
      toast.error("Could not update star.");
      return;
    }
    setHistory((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conv.id ? { ...c, starred: res.data.starred } : c
      ),
    }));
  };

  const removeFromHistory = (ids) => {
    const idSet = new Set(ids);
    setHistory((prev) => ({
      ...prev,
      conversations: prev.conversations.filter((c) => !idSet.has(c.id)),
    }));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    if (conversationRef.current && idSet.has(conversationRef.current.id)) {
      setConversation(null);
      navigate("/speaking-coach", { replace: true });
    }
  };

  const deleteConversation = async (id) => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    const res = await speakingService.deleteConversation(id);
    if (res.error) {
      toast.error("Could not delete conversation.");
      return;
    }
    removeFromHistory([id]);
    toast.success("Conversation deleted.");
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} conversation(s)? This cannot be undone.`)) return;
    const res = await speakingService.bulkDeleteConversations(ids);
    if (res.error) {
      toast.error("Could not delete conversations.");
      return;
    }
    removeFromHistory(ids);
    toast.success(`${ids.length} conversation(s) deleted.`);
  };

  // Record a study streak the first time a conversation is generated in a visit.
  useEffect(() => {
    if (conversation) userSettingService.recordStudyActivity();
  }, [conversation]);

  // Keep a ref of the loaded conversation so the URL-load effect can compare
  // without re-running every time the conversation object changes.
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // Warm just the first line so the very first Listen/Role Play isn't a cold
  // wait; every later line is fetched look-ahead during playback.
  useEffect(() => {
    if (conversation?.lines?.length) prefetchLine(conversation.lines[0].text);
  }, [conversation, prefetchLine]);

  // Find which of the user's own terms appear in this conversation so they can
  // be highlighted and deep-linked to /deck/:deckId/learn/:termId. Keyed on id
  // so highlight edits don't refetch.
  useEffect(() => {
    if (!conversation?.id) {
      setTermMatches([]);
      return undefined;
    }
    let active = true;
    speakingService.matchTerms(conversation.id).then((res) => {
      if (active && res.data?.matches) setTermMatches(res.data.matches);
    });
    return () => {
      active = false;
    };
  }, [conversation?.id]);

  // Seed the note input with any existing note whenever a new word is opened.
  useEffect(() => {
    if (!selected?.text) return;
    const existing = (conversation?.highlights || []).find(
      (h) => (h.text || "").toLowerCase() === selected.text.toLowerCase()
    );
    setNoteDraft(existing?.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.text]);

  // Load a conversation straight from the URL (/speaking-coach/:id) — on direct
  // open, refresh, or when reopening a past conversation.
  useEffect(() => {
    if (!routeId) return;
    if (conversationRef.current?.id === routeId) return;
    let active = true;
    speakingService.getConversation(routeId).then((res) => {
      if (!active) return;
      if (res.data?.id) {
        resetPracticeState();
        setConversation(res.data);
        if (res.data.voice) setSelectedVoice(res.data.voice);
        setView("practice");
      } else {
        toast.error("Conversation not found.");
        navigate("/speaking-coach", { replace: true });
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Picker options: active voices for the selected accent (voices without an
  // accent — e.g. legacy Gemini fallback — are always shown). If the selected
  // voice isn't in that list (a loaded conversation's voice from another accent,
  // or a legacy voice), surface it as an extra option so the UI reflects it.
  const voiceOptions = useMemo(() => {
    const opts = ttsVoices.filter((v) => !v.accent || v.accent === accent);
    if (selectedVoice && !opts.some((v) => v.id === selectedVoice)) {
      const known = ttsVoices.find((v) => v.id === selectedVoice);
      opts.unshift(
        known || {
          id: selectedVoice,
          label: `${legacyVoiceMap[selectedVoice] || selectedVoice} (legacy)`,
        }
      );
    }
    return opts;
  }, [ttsVoices, selectedVoice, legacyVoiceMap, accent]);

  const busy = rolePlayIndex !== null || fullPlayState !== "stopped";

  return (
    <div className="sc-wrapper">
      <header className="sc-topbar">
        <button className="sc-back" onClick={() => navigate("/")}>
          <ArrowBackIcon fontSize="small" />
          <span>Back</span>
        </button>
        <div className="sc-brand">
          <span className="sc-brand__icon">
            <RecordVoiceOverIcon fontSize="small" />
          </span>
          <div>
            <h2>Speaking Coach</h2>
            <p>AI conversation & pronunciation practice</p>
          </div>
        </div>
        <div className="sc-tabs" data-tour="sc-tabs">
          <button
            className={view === "practice" ? "active" : ""}
            onClick={() => setView("practice")}
          >
            <MicIcon fontSize="small" /> Practice
          </button>
          <button className={view === "history" ? "active" : ""} onClick={openHistory}>
            <HistoryIcon fontSize="small" /> History
          </button>
        </div>
      </header>

      <div className="sc-body">
        {view === "practice" && (
          <div className="sc-practice">
            <section className="sc-setup" data-tour="sc-setup">
              <div className="sc-mode-toggle">
                <button
                  className={mode === "topic" ? "active" : ""}
                  onClick={() => setMode("topic")}
                >
                  <AutoAwesomeIcon fontSize="small" /> AI topic
                </button>
                <button
                  className={mode === "custom" ? "active" : ""}
                  onClick={() => setMode("custom")}
                >
                  <MenuBookIcon fontSize="small" /> Custom text
                </button>
              </div>

              {mode === "topic" ? (
                <div className="sc-field">
                  <button
                    type="button"
                    className={`sc-vocab-pick ${vocabMode ? "active" : ""}`}
                    onClick={() => setVocabMode((v) => !v)}
                    data-tour="sc-vocab-pick"
                  >
                    <span className="sc-vocab-pick__icon">
                      <AutoStoriesIcon fontSize="small" />
                    </span>
                    <span className="sc-vocab-pick__text">
                      <strong>Practice my vocabulary</strong>
                      <small>Build a natural dialogue around words you've saved</small>
                    </span>
                    <span className="sc-vocab-pick__state">{vocabMode ? "On" : "Off"}</span>
                  </button>

                  <label>Conversation topic</label>
                  <input
                    type="text"
                    value={topic}
                    disabled={vocabMode}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Asking for directions, Checking in at the airport"
                  />
                  {vocabMode ? (
                    <span className="sc-field__hint">
                      A topic and title will be chosen for you from your saved words.
                    </span>
                  ) : (
                    <div className="sc-suggestions">
                      {(suggestedTopics.length ? suggestedTopics : FALLBACK_TOPICS).map((t) => (
                        <button
                          key={t}
                          className={topic === t ? "active" : ""}
                          onClick={() => setTopic(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sc-field">
                  <label>Your dialogue text</label>
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Paste sentences here — the AI turns them into structured practice lines."
                  />
                </div>
              )}

              <div className="sc-grid-2">
                <div className="sc-field">
                  <label>Accent</label>
                  <div className="sc-segmented">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.id}
                        className={accent === a.id ? "active" : ""}
                        onClick={() => selectAccent(a.id)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sc-field">
                  <label>Conversation tone</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)}>
                    {TONES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sc-grid-2">
                <div className="sc-field">
                  <label>
                    Proficiency level <span className="sc-badge">{level}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={LEVELS.indexOf(level)}
                    onChange={(e) => setLevel(LEVELS[parseInt(e.target.value, 10)])}
                  />
                </div>
                <div className="sc-field">
                  <label>
                    Conversation length <span className="sc-badge">{turns} turns</span>
                  </label>
                  <input
                    type="range"
                    min="4"
                    max="12"
                    step="2"
                    value={turns}
                    onChange={(e) => setTurns(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              <div className="sc-grid-2">
                <div className="sc-field">
                  <label>Your name</label>
                  <div className="sc-input-icon">
                    <PersonOutlineIcon fontSize="small" />
                    <input value={userName} onChange={(e) => setUserName(e.target.value)} />
                  </div>
                </div>
                <div className="sc-field">
                  <label>Coach / partner name</label>
                  <div className="sc-input-icon">
                    <PersonOutlineIcon fontSize="small" />
                    <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="sc-field" data-tour="sc-voice">
                <label>
                  <RecordVoiceOverIcon fontSize="small" /> Reference tutor voice
                </label>
                <div className="sc-voice-row">
                  <select
                    value={selectedVoice}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedVoice(v);
                      previewVoice(v);
                    }}
                  >
                    {voiceOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`sc-voice-demo ${demoVoice === selectedVoice ? "is-playing" : ""}`}
                    onClick={() => previewVoice(selectedVoice)}
                    title="Hear a sample of this voice"
                  >
                    <VolumeUpIcon fontSize="small" />
                    {demoVoice === selectedVoice ? "Playing…" : "Demo"}
                  </button>
                </div>
                <span className="sc-field__hint">
                  Natural AI voice used when you tap Listen or play a line. Pick one to hear a sample.
                </span>
              </div>

              <button
                className="sc-generate"
                onClick={handleGenerate}
                disabled={loading}
                data-tour="sc-generate"
              >
                {loading ? "Assembling dialogue…" : "Generate conversation"}
              </button>
            </section>

            {conversation && (
              <section className="sc-conversation">
                <div className="sc-convo-header">
                  <span className="sc-convo-header__icon">
                    <RecordVoiceOverIcon fontSize="small" />
                  </span>
                  <div className="sc-convo-header__text">
                    <h3>{conversation.topic || "Conversation"}</h3>
                    {conversation.context && <p>{conversation.context}</p>}
                  </div>
                  <div className="sc-convo-header__meta">
                    {conversation.accent && <span className="sc-tag">{conversation.accent}</span>}
                    {conversation.level && <span className="sc-tag">{conversation.level}</span>}
                    <span className="sc-tag">{conversation.lines?.length || 0} turns</span>
                  </div>
                </div>
                <div className="sc-action-bar" data-tour="sc-actions">
                  <div className="sc-action-group">
                    {fullPlayState === "playing" ? (
                      <button className="sc-btn sc-btn--danger" onClick={stopFull}>
                        <StopIcon fontSize="small" /> Stop
                      </button>
                    ) : (
                      <button
                        className="sc-btn sc-btn--ghost"
                        onClick={playFull}
                        disabled={busy}
                      >
                        <PlayArrowIcon fontSize="small" /> Listen to full
                      </button>
                    )}
                    <button
                      className="sc-btn sc-btn--primary"
                      onClick={startRolePlay}
                      disabled={busy}
                    >
                      <MicIcon fontSize="small" />
                      {rolePlayIndex !== null ? "Role-playing…" : "Live role play"}
                    </button>
                  </div>
                  <div className="sc-action-group">
                    <div className="sc-speed">
                      <span>Speed</span>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      />
                      <span className="sc-speed__val">{speed.toFixed(1)}x</span>
                    </div>
                    <button
                      className="sc-icon-btn"
                      onClick={swapRoles}
                      disabled={busy}
                      title="Swap roles"
                    >
                      <SwapHorizIcon fontSize="small" />
                    </button>
                    <button
                      className="sc-icon-btn sc-icon-btn--danger"
                      onClick={resetPracticeState}
                      title="Reset"
                    >
                      <RestartAltIcon fontSize="small" />
                    </button>
                  </div>
                </div>

                <div className="sc-tip" data-tour="sc-vocab">
                  <InfoOutlinedIcon fontSize="small" />
                  <span>
                    <strong>Tip:</strong> select any word or phrase to get its meaning, IPA and a
                    speaking tip — then save it as a term or highlight it to revisit later.
                    Words you already saved appear <mark className="sc-hl sc-hl--term">underlined</mark>;
                    click them to study.
                  </span>
                </div>

                <div className="sc-lines">
                  {conversation.lines.map((line) => {
                    const isMe = line.speaker === userName;
                    const isActive = activeLineId === line.id;
                    return (
                      <div
                        key={line.id}
                        className={`sc-line ${isMe ? "sc-line--me" : "sc-line--them"} ${
                          isActive ? "sc-line--active" : ""
                        }`}
                      >
                        <div className="sc-line__bubble">
                          <span className="sc-line__speaker">{line.speaker}</span>
                          <p
                            className="sc-line__text"
                            onMouseUp={() => handleSelection(line.text)}
                          >
                            {renderLineContent(line.text)}
                          </p>

                          {rolePlayIndex === null ? (
                            <div className="sc-line__actions">
                              <button
                                className={`sc-icon-btn ${
                                  speakingLineId === line.id ? "sc-icon-btn--on" : ""
                                }`}
                                onClick={() => playLine(line)}
                                title="Listen"
                              >
                                <VolumeUpIcon fontSize="small" />
                              </button>
                              {isActive && isRecording ? (
                                <button
                                  className="sc-btn sc-btn--danger sc-btn--sm"
                                  onClick={() => stopRecording(line.text)}
                                >
                                  <StopIcon fontSize="small" /> Finish
                                </button>
                              ) : (
                                <button
                                  className="sc-icon-btn"
                                  onClick={() => startRecording(line.id)}
                                  title="Practice"
                                >
                                  <MicIcon fontSize="small" />
                                </button>
                              )}
                            </div>
                          ) : (
                            isActive &&
                            isMe && (
                              <div className="sc-line__roleplay">
                                {isRecording ? (
                                  <button
                                    className="sc-btn sc-btn--danger sc-btn--sm"
                                    onClick={() => stopRecording(line.text)}
                                  >
                                    <StopIcon fontSize="small" /> Stop & continue
                                  </button>
                                ) : (
                                  <button
                                    className="sc-btn sc-btn--primary sc-btn--sm"
                                    onClick={() => startRecording(line.id)}
                                  >
                                    <MicIcon fontSize="small" /> Record your line
                                  </button>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {analyzing && (
                  <div className="sc-analyzing">
                    <div className="sc-spinner" />
                    <h4>Analyzing your speech…</h4>
                    <p>Measuring syllable timing, intonation, and correction markers.</p>
                  </div>
                )}

                {analysisResult && (
                  <div className="sc-result">
                    {analysisResult.overallFeedback && (
                      <div className="sc-callout sc-callout--brand">
                        <EmojiEventsIcon fontSize="small" />
                        <div>
                          <h4>Session overview</h4>
                          <p>"{analysisResult.overallFeedback}"</p>
                        </div>
                      </div>
                    )}
                    <LineAnalysis
                      result={analysisResult}
                      savedWords={savedWords}
                      onSaveWord={saveWordAsTerm}
                      onSaveSentence={saveActiveSentence}
                      onPlayReference={() => {
                        const cur = conversation.lines.find((l) => l.id === activeLineId);
                        if (cur) playLine(cur);
                      }}
                    />
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {view === "history" && (
          <div className="sc-history">
            <div className="sc-history__banner">
              <span className="sc-brand__icon">
                <HistoryIcon fontSize="small" />
              </span>
              <div>
                <h3>Your practice history</h3>
                <p>Revisit past conversations and pronunciation scores.</p>
              </div>
            </div>

            <div className="sc-history__cols">
              <div className="sc-history__col">
                <div className="sc-history__colhead">
                  <h4>Recent conversations ({history.conversations.length})</h4>
                  {selectedIds.size > 0 && (
                    <div className="sc-history__bulk">
                      <button
                        className="sc-btn sc-btn--danger sc-btn--sm"
                        onClick={deleteSelected}
                      >
                        <DeleteOutlineIcon fontSize="small" /> Delete ({selectedIds.size})
                      </button>
                      <button
                        className="sc-btn sc-btn--ghost sc-btn--sm"
                        onClick={() => setSelectedIds(new Set())}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                {sortedConversations.length ? (
                  sortedConversations.map((c) => (
                    <div
                      key={c.id}
                      className={`sc-history-item sc-history-item--row ${
                        selectedIds.has(c.id) ? "sc-history-item--selected" : ""
                      }`}
                    >
                      <label className="sc-checkbox" title="Select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </label>
                      <div className="sc-history-item__main">
                        <span className="sc-tag sc-tag--brand">{c.topic || "Conversation"}</span>
                        <p>
                          {c.lines?.length || 0} turns · {c.accent || "US"}
                        </p>
                      </div>
                      <div className="sc-history-item__tools">
                        <button
                          className={`sc-icon-btn ${c.starred ? "sc-icon-btn--star" : ""}`}
                          onClick={() => toggleStar(c)}
                          title={c.starred ? "Unstar" : "Star"}
                        >
                          {c.starred ? (
                            <StarIcon fontSize="small" />
                          ) : (
                            <StarBorderIcon fontSize="small" />
                          )}
                        </button>
                        <button
                          className="sc-btn sc-btn--ghost sc-btn--sm"
                          onClick={() => {
                            resetPracticeState();
                            setConversation(c);
                            if (c.voice) setSelectedVoice(c.voice);
                            setView("practice");
                            navigate(`/speaking-coach/${c.id}`);
                          }}
                        >
                          Reopen
                        </button>
                        <button
                          className="sc-icon-btn sc-icon-btn--danger"
                          onClick={() => deleteConversation(c.id)}
                          title="Delete"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="sc-empty">No saved conversations yet.</p>
                )}
              </div>

              <div className="sc-history__col">
                <h4>Pronunciation scores ({history.analyses.length})</h4>
                {history.analyses.length ? (
                  history.analyses.map((a) => (
                    <div key={a.id} className="sc-history-item">
                      <div className="sc-history-item__row">
                        <span className={`sc-score sc-score--${a.accuracy_score >= 80 ? "good" : a.accuracy_score >= 50 ? "mid" : "low"}`}>
                          {a.accuracy_score}%
                        </span>
                        <p className="sc-history-item__text">"{a.target_text}"</p>
                      </div>
                      {a.overall_feedback && <span className="sc-empty">{a.overall_feedback}</span>}
                    </div>
                  ))
                ) : (
                  <p className="sc-empty">No analyses yet — record a line to get started.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="sc-modal" onClick={() => setSelected(null)}>
          <div className="sc-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="sc-modal__head">
              <div>
                <span className="sc-modal__eyebrow">Vocabulary coach</span>
                <h3>"{selected.text}"</h3>
              </div>
              <button className="sc-icon-btn sc-icon-btn--light" onClick={() => setSelected(null)}>
                <CloseIcon fontSize="small" />
              </button>
            </div>

            <div className="sc-modal__body">
              {selected.loading ? (
                <div className="sc-modal__loading">
                  <div className="sc-spinner" />
                  <p>Looking it up…</p>
                </div>
              ) : selected.error ? (
                <div className="sc-modal__error">
                  <p>{selected.error}</p>
                  <button
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    onClick={() => openVocab(selected.text, selected.context)}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="sc-modal__meaning">
                    <span className="sc-section-label">Meaning</span>
                    <p>{selected.explain?.meaning || selected.fields?.definition || "—"}</p>
                  </div>
                  <div className="sc-grid-2">
                    <div className="sc-modal__cell">
                      <span className="sc-section-label">Pronunciation</span>
                      <span className="sc-mono sc-mono--good">
                        {selected.fields?.pronunciation || "/--/"}
                      </span>
                    </div>
                    <div className="sc-modal__cell">
                      <span className="sc-section-label">Word type</span>
                      <span>{selected.fields?.word_type || "—"}</span>
                    </div>
                  </div>
                  {selected.explain?.mouthTip && (
                    <div className="sc-modal__cell">
                      <span className="sc-section-label">Speaking tip</span>
                      <p>{selected.explain.mouthTip}</p>
                    </div>
                  )}
                  {selected.fields?.examples?.length > 0 && (
                    <div className="sc-modal__cell">
                      <span className="sc-section-label">Example</span>
                      <p
                        className="sc-modal__example"
                        dangerouslySetInnerHTML={{ __html: selected.fields.examples[0] }}
                      />
                    </div>
                  )}
                  {conversation?.id && (
                    <div className="sc-modal__note">
                      <span className="sc-section-label">Note (optional)</span>
                      <input
                        type="text"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add a quick note for this highlight…"
                      />
                      <div className="sc-modal__note-actions">
                        <button
                          className={`sc-btn sc-btn--sm ${
                            isHighlighted(selected.text) ? "sc-btn--primary" : "sc-btn--ghost"
                          }`}
                          onClick={() => toggleHighlight(false)}
                        >
                          <BorderColorIcon fontSize="small" />
                          {isHighlighted(selected.text) ? "Update highlight" : "Highlight in chat"}
                        </button>
                        {isHighlighted(selected.text) && (
                          <button
                            className="sc-btn sc-btn--ghost sc-btn--sm"
                            onClick={() => toggleHighlight(true)}
                          >
                            <CloseIcon fontSize="small" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="sc-modal__actions">
                    <button
                      className="sc-btn sc-btn--ghost"
                      onClick={() => speak(selected.text)}
                    >
                      <VolumeUpIcon fontSize="small" /> Listen
                    </button>
                    <button className="sc-btn sc-btn--primary" onClick={saveSelectionAsTerm}>
                      <AddIcon fontSize="small" /> Save as term
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
