import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HeadphonesOutlinedIcon from "@mui/icons-material/HeadphonesOutlined";
import HearingIcon from "@mui/icons-material/Hearing";
import PinIcon from "@mui/icons-material/Pin";

import NumberTest from "@pages/home/deckDetail/numberTest";
import ListeningCatalog from "./catalog";

// The Listening hub. Two URL-driven sub-tabs:
//   /listening                     → Listening test (dictation catalog, default)
//   /listening/topics/:topicSlug   → Listening test (a topic's exercise list)
//   /listening/numbers             → Number listening (the original number drill)
export default function Listening() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const view = pathname.startsWith("/listening/numbers") ? "numbers" : "test";

  return (
    <div className="sc-wrapper listening-wrapper">
      <div className="sc-topbar">
        <div className="sc-brand">
          <div className="sc-brand__icon">
            <HeadphonesOutlinedIcon />
          </div>
          <div>
            <h2>Listening</h2>
            <p>Train your ears</p>
          </div>
        </div>
        <div className="sc-tabs" data-tour="listening-tabs">
          <button className={view === "test" ? "active" : ""} onClick={() => navigate("/listening")}>
            <HearingIcon fontSize="small" /> Listening test
          </button>
          <button className={view === "numbers" ? "active" : ""} onClick={() => navigate("/listening/numbers")}>
            <PinIcon fontSize="small" /> Number listening
          </button>
        </div>
      </div>

      {view === "numbers" ? <NumberTest /> : <ListeningCatalog />}
    </div>
  );
}
