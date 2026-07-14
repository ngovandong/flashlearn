import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { listeningService } from "@api-services/listeningService";

// The "Listening test" tab: a grid of dictation topics, and — when a topic is
// selected via /listening/topics/:topicSlug — that topic's exercise list.
export default function ListeningCatalog() {
  const { topicSlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = topicSlug
      ? listeningService.getTopic(topicSlug).then((res) => active && setTopic(res.data))
      : listeningService.getTopics().then((res) => active && setTopics(res.data || []));
    load.catch(() => {}).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [topicSlug]);

  if (loading) {
    return (
      <div className="listening-loading">
        <div className="sc-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (topicSlug) {
    const exercises = topic?.exercises || [];
    return (
      <div className="listening-topic" data-tour="listening-exercises">
        <button className="sc-back" onClick={() => navigate("/listening")}>
          <ArrowBackIcon fontSize="small" /> All topics
        </button>
        <div className="listening-topic__head">
          <h3>{topic?.title}</h3>
          {topic?.level && <span className="listening-chip">{topic.level}</span>}
          {topic?.description && <p>{topic.description}</p>}
        </div>
        {exercises.length === 0 ? (
          <p className="listening-empty">No exercises yet for this topic.</p>
        ) : (
          <ul className="listening-ex-list">
            {exercises.map((ex) => {
              const done = ex.progress?.status === "completed";
              const best = ex.progress?.best_score || 0;
              return (
                <li key={ex.id}>
                  <button
                    className={`listening-ex ${done ? "is-done" : ""}`}
                    onClick={() => navigate(`/listening/exercise/${ex.id}/listen-and-type`)}
                    disabled={!ex.has_audio}
                    title={ex.has_audio ? "" : "Audio not collected yet"}
                  >
                    <span className="listening-ex__icon">
                      {done ? <CheckCircleIcon fontSize="small" /> : <HeadphonesIcon fontSize="small" />}
                    </span>
                    <span className="listening-ex__body">
                      <span className="listening-ex__title">{ex.title}</span>
                      <span className="listening-ex__meta">
                        {ex.sentence_count} sentences
                        {best > 0 && ` • best ${best}%`}
                      </span>
                    </span>
                    <ChevronRightIcon fontSize="small" className="listening-ex__chev" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <p className="listening-empty">
        No topics available yet. An admin can import them with the crawl_dictation command.
      </p>
    );
  }

  return (
    <div className="listening-grid" data-tour="listening-topics">
      {topics.map((t) => {
        const pct = t.total_exercises ? Math.round((t.completed_exercises / t.total_exercises) * 100) : 0;
        return (
          <button key={t.id} className="listening-topic-card" onClick={() => navigate(`/listening/topics/${t.slug}`)}>
            <div className="listening-topic-card__top">
              <span className="listening-topic-card__icon">
                <HeadphonesIcon />
              </span>
              {t.level && <span className="listening-chip">{t.level}</span>}
            </div>
            <h4>{t.title}</h4>
            <p>{t.description}</p>
            <div className="listening-topic-card__foot">
              <div className="listening-progress">
                <div className="listening-progress__bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="listening-topic-card__count">
                {t.completed_exercises}/{t.total_exercises}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
