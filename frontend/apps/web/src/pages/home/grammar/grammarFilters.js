import React from "react";

// Split a book's level string ("A1-A2", "B1") into individual CEFR level codes.
function parseLevels(level) {
  const codes = (level || "").toUpperCase().match(/[ABC][12]/g);
  return codes ? Array.from(new Set(codes)) : [];
}

// Filter bar for the grammar catalog / grammar course: pick a CEFR level
// (A1/A2 → Essential Grammar in Use, B1 → English Grammar in Use) or a specific
// book. A level maps to the book that covers it, so the two controls stay in
// sync — selecting either resolves to a single book slug. Hidden with a single
// book so the single-book experience is unchanged.
export default function GrammarFilters({ books, activeSlug, onSelect }) {
  if (!books || books.length < 2) return null;

  const activeBook = books.find((b) => b.slug === activeSlug);
  const activeLevels = parseLevels(activeBook && activeBook.level);

  const levelChips = [];
  const seen = new Set();
  books.forEach((book) =>
    parseLevels(book.level).forEach((code) => {
      if (!seen.has(code)) {
        seen.add(code);
        levelChips.push({ code, slug: book.slug });
      }
    })
  );
  levelChips.sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="gr-filters" data-tour="grammar-filters">
      {levelChips.length > 1 && (
        <div className="gr-filter-group">
          <span className="gr-filter-group__label">Level</span>
          <div className="gr-filter-chips" role="tablist" aria-label="Grammar level">
            {levelChips.map(({ code, slug }) => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={activeLevels.includes(code)}
                className={`gr-chip ${activeLevels.includes(code) ? "is-active" : ""}`}
                onClick={() => onSelect(slug)}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="gr-filter-group">
        <span className="gr-filter-group__label">Book</span>
        <div className="gr-filter-chips" role="tablist" aria-label="Grammar books">
          {books.map((book) => (
            <button
              key={book.slug}
              type="button"
              role="tab"
              aria-selected={book.slug === activeSlug}
              className={`gr-chip gr-chip--book ${book.slug === activeSlug ? "is-active" : ""}`}
              onClick={() => onSelect(book.slug)}
            >
              <span className="gr-chip__title">{book.title}</span>
              <span className="gr-chip__meta">
                {book.completed_units}/{book.total_units}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
