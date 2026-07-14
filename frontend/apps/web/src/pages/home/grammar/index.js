import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuBookIcon from "@mui/icons-material/MenuBook";

import GrammarCatalog from "./catalog";
import UnitView from "./unitView";

// The Grammar tab. URL-driven so units are deep-linkable:
//   /grammar            → the book catalog (sections → units)
//   /grammar/:unitKey   → one unit's reference + auto-graded exercises
export default function Grammar() {
  const navigate = useNavigate();
  const { unitKey } = useParams();
  const inUnit = !!unitKey;

  return (
    <div className="sc-wrapper gr-wrapper">
      <header className="sc-topbar">
        <button
          className="sc-back"
          onClick={() => (inUnit ? navigate("/grammar") : navigate("/"))}
        >
          <ArrowBackIcon fontSize="small" />
          <span>{inUnit ? "All units" : "Back"}</span>
        </button>
        <div className="sc-brand">
          <span className="sc-brand__icon">
            <MenuBookIcon fontSize="small" />
          </span>
          <div>
            <h2>Grammar</h2>
            <p>Learn the rules, then practise with instant feedback</p>
          </div>
        </div>
      </header>

      <div className="sc-body">
        {inUnit ? <UnitView unitKey={unitKey} /> : <GrammarCatalog />}
      </div>
    </div>
  );
}
