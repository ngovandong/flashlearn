import React from "react";

function SkeletonBlock({ className = "", style, ...props }) {
  return (
    <span
      className={`fl-skeleton ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

function DeckCardSkeleton() {
  return (
    <div className="deck-card-skeleton">
      <div className="deck-card-skeleton__header">
        <div className="deck-card-skeleton__body">
          <SkeletonBlock style={{ width: "85%", height: "1.1rem" }} />
          <SkeletonBlock
            className="fl-skeleton--pill"
            style={{ width: "4.5rem", height: "1.25rem" }}
          />
        </div>
        <SkeletonBlock className="deck-card-skeleton__thumb" />
      </div>
      <div className="deck-card-skeleton__footer">
        <SkeletonBlock className="deck-card-skeleton__avatar fl-skeleton--circle" />
        <SkeletonBlock style={{ width: "55%", height: "0.85rem" }} />
      </div>
    </div>
  );
}

function ReminderCardSkeleton() {
  return (
    <div className="reminder-card-skeleton">
      <SkeletonBlock className="reminder-card-skeleton__icon" />
      <div className="reminder-card-skeleton__body">
        <SkeletonBlock style={{ width: "72%", height: "1rem" }} />
        <SkeletonBlock style={{ width: "92%", height: "0.75rem" }} />
        <SkeletonBlock style={{ width: "40%", height: "0.75rem" }} />
      </div>
    </div>
  );
}

function DeckCardSkeletonGrid({ count = 4, className = "section-cards" }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading decks">
      {Array.from({ length: count }, (_, index) => (
        <DeckCardSkeleton key={index} />
      ))}
    </div>
  );
}

function ReminderCardSkeletonGrid({ count = 2 }) {
  return (
    <div
      className="reminders-grid"
      aria-busy="true"
      aria-label="Loading reminders"
    >
      {Array.from({ length: count }, (_, index) => (
        <ReminderCardSkeleton key={index} />
      ))}
    </div>
  );
}

function DeckPageSkeleton() {
  return (
    <div className="deck-page-skeleton" aria-busy="true" aria-label="Loading deck">
      <SkeletonBlock className="deck-page-skeleton__title" />
      <div className="deck-page-skeleton__menu">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className="deck-page-skeleton__menu-btn" />
        ))}
      </div>
      <SkeletonBlock className="deck-page-skeleton__quote" />
      <SkeletonBlock className="deck-page-skeleton__progress" />
    </div>
  );
}

function PageShellSkeleton() {
  return (
    <div className="page-shell-skeleton" aria-busy="true" aria-label="Loading page">
      <SkeletonBlock className="page-shell-skeleton__title" />
      <div>
        <SkeletonBlock className="page-shell-skeleton__section-title" />
        <DeckCardSkeletonGrid count={4} />
      </div>
    </div>
  );
}

export {
  SkeletonBlock,
  DeckCardSkeleton,
  ReminderCardSkeleton,
  DeckCardSkeletonGrid,
  ReminderCardSkeletonGrid,
  DeckPageSkeleton,
  PageShellSkeleton,
};
