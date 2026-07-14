import React from "react";
import { useNavigate } from "react-router-dom";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";

import GrammarFilters from "./grammarFilters";
import { sectionHue, sectionIcon } from "./sectionVisual";
import useGrammarCatalog from "./useGrammarCatalog";

function UnitProgress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="gr-uprogress" aria-label={`${done} of ${total} exercises done`}>
      <div className="gr-uprogress__track">
        <div className="gr-uprogress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {done}/{total}
      </span>
    </div>
  );
}

// The Grammar tab catalog: every section of the book with its units. Each unit
// card shows how many of its exercises are done, so a learner can pick up where
// they left off. Selecting a unit opens its reference + exercises.
export default function GrammarCatalog() {
  const navigate = useNavigate();
  const { books, activeSlug, selectBook, catalog, loading } = useGrammarCatalog();

  if (loading && !catalog) {
    return (
      <div className="sc-loading gr-loading">
        <div className="sc-spinner" />
        <h4>Loading grammar…</h4>
      </div>
    );
  }

  if (!catalog || !catalog.book) {
    return (
      <div className="gr-empty">
        No grammar book imported yet. An admin can run the <code>import_grammar_json</code> command to populate it.
      </div>
    );
  }

  return (
    <div className="gr-catalog" data-tour="grammar-catalog">
      <GrammarFilters books={books} activeSlug={activeSlug} onSelect={selectBook} />
      <div className="gr-catalog__intro">
        <h3>{catalog.book.title}</h3>
        <p>{catalog.book.description}</p>
      </div>

      {catalog.sections.map((section, si) => {
        const SectionIcon = sectionIcon(section.title);
        const allDone = section.total_units > 0 && section.completed_units >= section.total_units;
        return (
          <section
            key={section.id}
            className={`gr-section ${allDone ? "is-complete" : ""}`}
            data-tour="grammar-sections"
            style={{ "--gr-hue": `${sectionHue(si)}deg` }}
          >
            <div className="gr-section__head">
              <span className="gr-section__icon">
                <SectionIcon fontSize="small" />
              </span>
              <h4>{section.title}</h4>
              <span className="gr-section__count">
                {section.completed_units}/{section.total_units} units
              </span>
            </div>
            {section.description && <p className="gr-section__desc">{section.description}</p>}
            <div className="gr-section__grid">
              {section.units.map((unit) => {
                const complete = unit.status === "completed";
                return (
                  <button
                    key={unit.key}
                    type="button"
                    className={`gr-unit-card ${complete ? "is-complete" : ""}`}
                    onClick={() => navigate(`/grammar/${unit.key}`)}
                  >
                    <span className="gr-unit-card__num">
                      {unit.number > 0 ? unit.number : <FitnessCenterIcon fontSize="inherit" />}
                    </span>
                    <span className="gr-unit-card__body">
                      <span className="gr-unit-card__title">{unit.title}</span>
                      <UnitProgress done={unit.completed_exercises} total={unit.total_exercises} />
                    </span>
                    {complete ? (
                      <CheckCircleIcon className="gr-unit-card__done" fontSize="small" />
                    ) : (
                      <ChevronRightIcon className="gr-unit-card__chev" fontSize="small" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
