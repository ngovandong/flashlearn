import React from "react";
import { useNavigate } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SchoolIcon from "@mui/icons-material/School";

import CoursePanel from "@pages/home/deckDetail/speakingCoach/coursePanel";

// Standalone Course page mounted on /course so the navbar "Course" link gets
// its own route (and stays highlighted) instead of redirecting into Speaking
// Coach. It reuses CoursePanel, pointing its internal navigation at /course.
export default function Course() {
  const navigate = useNavigate();

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
            <p>Guided dialogue lessons &amp; live role-play</p>
          </div>
        </div>
      </header>

      <div className="sc-body">
        <CoursePanel basePath="/course" />
      </div>
    </div>
  );
}
