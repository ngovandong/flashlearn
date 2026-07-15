import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import HeadphonesIcon from "@mui/icons-material/Headphones";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { listeningService } from "@api-services/listeningService";

function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="sc-course-progress" aria-label={`${done} of ${total} exercises done`}>
      <div className="sc-course-progress__track">
        <div className="sc-course-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {done}/{total} done
      </span>
    </div>
  );
}

// The "Listening course" tab on /course: DailyDictation-sourced topics rendered
// as course cards (reusing the Speaking course card styling). Selecting one opens
// the existing listen-and-type exercise list under /listening/topics/:slug.
export default function ListeningCourses() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listeningService
      .getTopics()
      .then((res) => active && setTopics(res.data || []))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading && topics.length === 0) {
    return (
      <div className="sc-loading">
        <div className="sc-spinner" />
        <h4>Loading listening courses…</h4>
      </div>
    );
  }

  return (
    <div className="sc-course" data-tour="listening-courses">
      <div className="sc-course__intro">
        <h3>
          <HeadphonesIcon fontSize="small" /> Listening courses
        </h3>
        <p>Sharpen your ear with dictations. Listen and type each sentence, then track your progress.</p>
      </div>
      {topics.length === 0 ? (
        <div className="sc-course__empty">
          No listening topics imported yet. An admin can run the crawl_dictation command to populate them.
        </div>
      ) : (
        <div className="sc-course__grid">
          {topics.map((t) => {
            const done = t.total_exercises && t.completed_exercises >= t.total_exercises;
            return (
              <div key={t.id} className="sc-course-card-wrap">
                <button className="sc-course-card" onClick={() => navigate(`/listening/topics/${t.slug}`)}>
                  <div
                    className="sc-course-card__cover"
                    style={t.background ? { backgroundImage: `url(${t.background})` } : undefined}
                  >
                    {!t.background && (
                      <span className="sc-course-card__cover-icon">
                        <HeadphonesIcon />
                      </span>
                    )}
                    <span className="sc-course-card__level">{t.level || "Listening"}</span>
                    {done && (
                      <span className="sc-course-card__done">
                        <CheckCircleIcon fontSize="small" /> Done
                      </span>
                    )}
                  </div>
                  <div className="sc-course-card__body">
                    <h4>{t.title}</h4>
                    <p>{t.description}</p>
                    <ProgressBar done={t.completed_exercises} total={t.total_exercises} />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
