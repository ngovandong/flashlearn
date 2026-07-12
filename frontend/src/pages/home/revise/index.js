import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, IconButton, LinearProgress } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/Close";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import Confetti from "react-confetti";
import { toast } from "react-toastify";
import { LocalLoadingWrapper } from "@components/loading";
import { reviseService } from "@api-services/reviseService";
import { getFirstError } from "@utils/errorHandler";
import VocabCard from "./vocabCard";
import GrammarCard from "./grammarCard";
import ListeningCard from "./listeningCard";
import SpeakingCard from "./speakingCard";

const SESSION_SIZE = 12;

function Revise() {
  const navigate = useNavigate();
  const [cards, setCards] = useState(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);

  // Per-card input state, reset on every advance.
  const [chosen, setChosen] = useState(null);
  const [blanks, setBlanks] = useState({});
  const [textValue, setTextValue] = useState("");

  const sounds = useRef(null);
  if (sounds.current === null) {
    sounds.current = {
      correct: new Audio(`${process.env.PUBLIC_URL}/sound/true.mp3`),
      wrong: new Audio(`${process.env.PUBLIC_URL}/sound/false.mp3`),
      finish: new Audio(`${process.env.PUBLIC_URL}/sound/congratulation.mp3`),
    };
  }

  useEffect(() => {
    let active = true;
    reviseService.buildSession(SESSION_SIZE).then((res) => {
      if (!active) return;
      if (res.error) {
        toast.error(getFirstError(res.error));
        setCards([]);
        return;
      }
      setCards(res.data?.cards || []);
    });
    return () => {
      active = false;
    };
  }, []);

  const card = cards && cards[index];
  const total = cards ? cards.length : 0;
  const answered = result != null;

  const isChooseGrammar = useMemo(() => {
    const p = card?.payload || {};
    return card?.kind === "grammar" && p.exercise_kind === "choose" && (p.options || []).length > 0 && p.blank_count === 1;
  }, [card]);

  const isTyped = card && ((card.kind === "grammar" && !isChooseGrammar) || card.kind === "listening");

  const submit = useCallback(
    async (given, opts = {}) => {
      if (submitting || answered || !card) return;
      setSubmitting(true);
      const res = opts.audio
        ? await reviseService.answerSpeaking(card.id, opts)
        : await reviseService.answer(card.id, given);
      setSubmitting(false);
      if (res.error) {
        toast.error(getFirstError(res.error));
        return;
      }
      const data = res.data;
      setResult(data);
      if (data.correct) {
        setScore((s) => s + 1);
        setStreak((s) => s + 1);
        sounds.current.correct.play().catch(() => {});
      } else {
        setStreak(0);
        sounds.current.wrong.play().catch(() => {});
      }
    },
    [card, submitting, answered]
  );

  const chooseVocab = (opt) => {
    setChosen(opt);
    submit(opt);
  };
  const chooseGrammar = (opt) => {
    setChosen(opt);
    submit([opt]);
  };
  const checkTyped = () => {
    if (card.kind === "listening") submit(textValue);
    else {
      const count = card.payload?.blank_count || 1;
      submit(Array.from({ length: count }, (_, i) => blanks[i] || ""));
    }
  };

  const advance = () => {
    if (index + 1 >= total) {
      setDone(true);
      sounds.current.finish.play().catch(() => {});
      return;
    }
    setIndex((i) => i + 1);
    setResult(null);
    setChosen(null);
    setBlanks({});
    setTextValue("");
  };

  if (cards === null) return <LocalLoadingWrapper open />;

  if (cards.length === 0) {
    return (
      <div className="revise-page revise-empty">
        <div className="revise-empty__card">
          <AutoAwesomeRoundedIcon className="revise-empty__icon" />
          <h2>Nothing to revise yet</h2>
          <p>
            Learn some words, practise grammar, listening or speaking, and the
            things you miss will show up here — hardest first.
          </p>
          <Button className="revise-btn" onClick={() => navigate("/")}>Back home</Button>
        </div>
      </div>
    );
  }

  if (done) {
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    return (
      <div className="revise-page revise-finish">
        <Confetti gravity={0.2} width={window.innerWidth} height={window.innerHeight} numberOfPieces={220} recycle={false} />
        <div className="revise-finish__card">
          <div className="revise-finish__ring">{accuracy}%</div>
          <h2>Session complete!</h2>
          <p>
            You revised <strong>{total}</strong> item{total === 1 ? "" : "s"} and got{" "}
            <strong>{score}</strong> right.
          </p>
          <div className="revise-finish__actions">
            <Button className="revise-btn" onClick={() => window.location.reload()}>
              Revise more
            </Button>
            <Button className="revise-btn revise-btn--ghost" onClick={() => navigate("/")}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progress = total ? (index / total) * 100 : 0;
  const canCheck =
    isTyped &&
    (card.kind === "listening"
      ? textValue.trim().length > 0
      : (blanks[0] || "").trim().length > 0);

  return (
    <div className="revise-page">
      <header className="revise-header">
        <IconButton aria-label="Exit" onClick={() => navigate(-1)} className="revise-header__close">
          <CloseRoundedIcon />
        </IconButton>
        <div className="revise-header__bar" data-tour="revise-progress">
          <LinearProgress variant="determinate" value={progress} className="revise-progressbar" />
        </div>
        <div className="revise-streak">🔥 {streak}</div>
      </header>

      <main className="revise-body">
        <div className="revise-stage" data-tour="revise-card">
          {card.kind === "vocab" && (
            <VocabCard card={card} answered={answered} result={result} chosen={chosen} onChoose={chooseVocab} />
          )}
          {card.kind === "grammar" && (
            <GrammarCard
              card={card}
              answered={answered}
              result={result}
              values={blanks}
              chosen={chosen}
              onChangeBlank={(i, v) => setBlanks((b) => ({ ...b, [i]: v }))}
              onChoose={chooseGrammar}
            />
          )}
          {card.kind === "listening" && (
            <ListeningCard card={card} answered={answered} result={result} value={textValue} onChange={setTextValue} />
          )}
          {card.kind === "speaking" && (
            <SpeakingCard
              card={card}
              answered={answered}
              result={result}
              submitting={submitting}
              onSubmitAudio={(payload) => submit(null, payload)}
            />
          )}
        </div>
      </main>

      <footer className={`revise-footer ${answered ? (result.correct ? "is-correct" : "is-wrong") : ""}`}>
        {answered ? (
          <div className="revise-footer__inner revise-footer__inner--centered">
            <span className="revise-footer__verdict">
              {result.correct ? "Nice! 🎉" : "Keep practising 💪"}
            </span>
            <Button className="revise-btn revise-continue" onClick={advance} endIcon={<ArrowForwardRoundedIcon />}>
              {index + 1 >= total ? "Finish" : "Continue"}
            </Button>
          </div>
        ) : isTyped ? (
          <div className="revise-footer__inner revise-footer__inner--centered">
            <Button
              className="revise-btn revise-continue"
              disabled={!canCheck || submitting}
              onClick={checkTyped}
              endIcon={<CheckRoundedIcon />}
            >
              Check
            </Button>
          </div>
        ) : (
          <Box className="revise-footer__hint">
            {card.kind === "speaking" ? "Tap the mic and read the sentence" : "Choose your answer"}
          </Box>
        )}
      </footer>
    </div>
  );
}

export default Revise;
