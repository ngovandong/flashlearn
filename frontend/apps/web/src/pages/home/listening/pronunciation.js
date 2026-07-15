import React, { useEffect, useRef, useState } from "react";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

// Per-word pronunciation (UK/US IPA + audio) for the listen-and-type reveal.
// Data comes from the free Dictionary API (dictionaryapi.dev) — no key, no
// backend. Words are underlined; tapping one opens a small popover with the two
// accents' IPA + audio, falling back to the browser voice when a clip is
// missing. Lookups are cached per word for the page's lifetime.

const CACHE = new Map();

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

// Strip surrounding punctuation but keep inner apostrophes/hyphens intact.
function cleanWord(word) {
  return (word || "").replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "");
}

async function lookup(word) {
  const key = word.toLowerCase();
  if (CACHE.has(key)) return CACHE.get(key);
  const promise = (async () => {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) throw new Error("not found");
    const phonetics = (entry.phonetics || []).filter((p) => p && (p.text || p.audio));
    const pick = (region) => phonetics.find((p) => (p.audio || "").includes(`-${region}.`));
    const anyText = entry.phonetic || phonetics.find((p) => p.text)?.text || "";
    const uk = pick("uk");
    const us = pick("us");
    return {
      word: entry.word || key,
      uk: { ipa: uk?.text || anyText, audio: uk?.audio || "" },
      us: { ipa: us?.text || anyText, audio: us?.audio || "" },
    };
  })();
  CACHE.set(key, promise);
  promise.catch(() => CACHE.delete(key)); // let transient failures retry
  return promise;
}

export default function PronunciationText({ text }) {
  const [active, setActive] = useState(null); // { word, rect }
  const [data, setData] = useState(null); // { loading } | { error } | { uk, us }
  const audioRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setActive(null);
    setData(null);
  };

  const openWord = (raw, el) => {
    const word = cleanWord(raw);
    if (!word) return;
    setActive({ word, rect: el.getBoundingClientRect() });
    setData({ loading: true });
    lookup(word)
      .then((res) => setData({ ...res }))
      .catch(() => setData({ error: true }));
  };

  const play = (url, word) => {
    if (!url) {
      browserSpeak(word);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.play().catch(() => browserSpeak(word));
  };

  const parts = (text || "").split(/(\s+)/);

  return (
    <span className="lt-pron">
      {parts.map((part, i) =>
        /^\s+$/.test(part) || part === "" ? (
          <React.Fragment key={i}>{part}</React.Fragment>
        ) : (
          <button
            key={i}
            type="button"
            className="lt-pron__word"
            onClick={(e) => openWord(part, e.currentTarget)}
          >
            {part}
          </button>
        )
      )}

      {active && (
        <>
          <div className="lt-pron__overlay" onClick={close} />
          <div
            className="lt-pron__pop"
            style={{
              top: active.rect.bottom + 8,
              left: Math.max(8, Math.min(active.rect.left, window.innerWidth - 248)),
            }}
          >
            <div className="lt-pron__pop-word">{active.word}</div>
            {data?.loading ? (
              <div className="lt-pron__loading">
                <div className="sc-spinner" />
              </div>
            ) : data?.error ? (
              <p className="lt-pron__err">No pronunciation found.</p>
            ) : (
              <>
                <div className="lt-pron__btns">
                  <button
                    type="button"
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    onClick={() => play(data.uk.audio, active.word)}
                  >
                    UK <VolumeUpIcon fontSize="inherit" />
                  </button>
                  <button
                    type="button"
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    onClick={() => play(data.us.audio, active.word)}
                  >
                    US <VolumeUpIcon fontSize="inherit" />
                  </button>
                </div>
                {(data.uk.ipa || data.us.ipa) && (
                  <div className="lt-pron__ipa">
                    {data.uk.ipa && (
                      <span>
                        UK <b>{data.uk.ipa}</b>
                      </span>
                    )}
                    {data.us.ipa && (
                      <span>
                        US <b>{data.us.ipa}</b>
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </span>
  );
}
