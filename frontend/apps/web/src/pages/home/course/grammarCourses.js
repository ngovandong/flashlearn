import React from "react";
import { useNavigate } from "react-router-dom";

import MenuBookIcon from "@mui/icons-material/MenuBook";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import GrammarFilters from "../grammar/grammarFilters";
import { sectionHue, sectionIcon } from "../grammar/sectionVisual";
import useGrammarCatalog from "../grammar/useGrammarCatalog";

function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="sc-course-progress" aria-label={`${done} of ${total} units done`}>
      <div className="sc-course-progress__track">
        <div className="sc-course-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {done}/{total} done
      </span>
    </div>
  );
}

// The "Grammar course" tab on /course: the grammar book's sections rendered as
// course cards (reusing the Speaking course card styling). Selecting one opens
// its first unit under /grammar/:unitKey to study the rules and do the exercises.
export default function GrammarCourses() {
  const navigate = useNavigate();
  const { books, activeSlug, selectBook, catalog, loading } = useGrammarCatalog();

  if (loading && !catalog) {
    return (
      <div className="sc-loading">
        <div className="sc-spinner" />
        <h4>Loading grammar course…</h4>
      </div>
    );
  }

  const sections = catalog?.sections || [];
  const level = catalog?.book?.level || "Grammar";

  const openSection = (section) => {
    const first = section.units?.[0];
    navigate(first ? `/grammar/${first.key}` : "/grammar");
  };

  return (
    <div className="sc-course gr-course" data-tour="grammar-courses">
      <div className="sc-course__intro">
        <h3>
          <MenuBookIcon fontSize="small" /> Grammar course
        </h3>
        <p>
          Work through {catalog?.book?.title || "the grammar book"} section by section. Read the rule, then practise
          with instant feedback and track every unit.
        </p>
      </div>
      <GrammarFilters books={books} activeSlug={activeSlug} onSelect={selectBook} />
      {sections.length === 0 ? (
        <div className="sc-course__empty">
          No grammar book imported yet. An admin can run the import_grammar_json command to populate it.
        </div>
      ) : (
        <div className="sc-course__grid">
          {sections.map((section, si) => {
            const done = section.total_units > 0 && section.completed_units >= section.total_units;
            const SectionIcon = sectionIcon(section.title);
            return (
              <div key={section.id} className="sc-course-card-wrap">
                <button className="sc-course-card" onClick={() => openSection(section)}>
                  <div
                    className="sc-course-card__cover gr-course-cover"
                    style={{ "--gr-hue": `${sectionHue(si)}deg` }}
                  >
                    <span className="sc-course-card__cover-icon">
                      <SectionIcon />
                    </span>
                    <span className="sc-course-card__level">{level}</span>
                    {done && (
                      <span className="sc-course-card__done">
                        <CheckCircleIcon fontSize="small" /> Done
                      </span>
                    )}
                  </div>
                  <div className="sc-course-card__body">
                    <h4>{section.title}</h4>
                    <p>{section.description}</p>
                    <ProgressBar done={section.completed_units} total={section.total_units} />
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
