import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SchoolIcon from "@mui/icons-material/School";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import HeadphonesIcon from "@mui/icons-material/Headphones";

import CoursePanel from "@pages/home/deckDetail/speakingCoach/coursePanel";
import ListeningCourses from "./listeningCourses";

// Standalone Course page mounted on /course so the navbar "Course" link gets
// its own route (and stays highlighted) instead of redirecting into Speaking
// Coach. It groups two kinds of courses:
//   • Speaking course — freeCodeCamp dialogues played line by line (CoursePanel).
//   • Listening course — DailyDictation listen-and-type topics.
// The switch is a ?tab= query param so the split is shareable. It only shows at
// the catalog root; drilling into a speaking course/lesson (via :courseId) keeps
// CoursePanel mounted.
export default function Course() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();

  const tab = params.get("tab") === "listening" ? "listening" : "speaking";
  const atRoot = !courseId;

  const selectTab = (next) => {
    if (next === "listening") setParams({ tab: "listening" });
    else setParams({});
  };

  return (
    <div className="sc-wrapper">
      <header className="sc-topbar">
        <button className="sc-back" onClick={() => navigate("/")}>
          <ArrowBackIcon fontSize="small" />
          <span>Back</span>
        </button>
        <div className="sc-brand">
          <span className="sc-brand__icon">
            <SchoolIcon fontSize="small" />
          </span>
          <div>
            <h2>Course</h2>
            <p>Speaking dialogues &amp; listening dictation</p>
          </div>
        </div>
      </header>

      {atRoot && (
        <div className="course-type-tabs" role="tablist" aria-label="Course type" data-tour="course-type-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "speaking"}
            className={`course-type-tab ${tab === "speaking" ? "is-active" : ""}`}
            onClick={() => selectTab("speaking")}
          >
            <RecordVoiceOverIcon fontSize="small" />
            <span>Speaking course</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "listening"}
            className={`course-type-tab ${tab === "listening" ? "is-active" : ""}`}
            onClick={() => selectTab("listening")}
          >
            <HeadphonesIcon fontSize="small" />
            <span>Listening course</span>
          </button>
        </div>
      )}

      <div className="sc-body">
        {atRoot && tab === "listening" ? <ListeningCourses /> : <CoursePanel basePath="/course" />}
      </div>
    </div>
  );
}
