import { LocalLoadingWrapper } from "@components/loading";
import { Alert, Box, Snackbar } from "@mui/material";
import {
  useLatestDecks,
  useLearningStreak,
  useReminders,
} from "@hooks/useLatestDecks";
import React, { useMemo, useState } from "react";
import DeckCard from "./deckCard";
import PaginatedDeckSection, { fetchPublicDecksPage } from "./paginatedDeckSection";
import { useSelector } from "react-redux";
import { selectUser } from "@app/store/authSlice";
import InstallExtensionReminder from "@components/installExtensionReminder";
import ThemeSuggestion from "@components/themeSuggestion";
import { Link } from "react-router-dom";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { REMINDER_META } from "@constants/reminders";

function streakCopy({ streak, studied_today }) {
  if (streak === 0) {
    return {
      main: "Start your learning streak today!",
      sub: "Study a deck to begin building your streak.",
    };
  }
  const dayLabel = streak === 1 ? "1-day" : `${streak}-day`;
  return {
    main: `You have a ${dayLabel} streak of learning`,
    sub: studied_today
      ? "Keep studying hard to maintain your streak!"
      : "Study today to keep your streak going!",
  };
}

function Home() {
  const [error, setError] = useState();
  const user = useSelector(selectUser);
  const {
    data: mydecks,
    isLoading: decksLoading,
    error: decksError,
  } = useLatestDecks();
  const { data: learningStreak } = useLearningStreak();
  const { data: reminders } = useReminders();

  const queryError = decksError?.message;

  const streakText = learningStreak ? streakCopy(learningStreak) : null;

  // Drop any reminder whose type we don't know how to render.
  const visibleReminders = useMemo(
    () => (reminders || []).filter((r) => REMINDER_META[r.type]),
    [reminders]
  );

  return user ? (
    <div className="home-page">
      <LocalLoadingWrapper open={decksLoading} />
      <Snackbar
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        open={error != null || queryError != null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error || queryError}
        </Alert>
      </Snackbar>
      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 16, sm: 24 },
          left: { xs: 16, sm: 24 },
          right: { xs: 16, sm: "auto" },
          zIndex: (theme) => theme.zIndex.snackbar,
          display: "flex",
          flexDirection: "column",
          alignItems: { xs: "stretch", sm: "flex-start" },
          gap: 1.5,
          pointerEvents: "none",
        }}
      >
        <InstallExtensionReminder />
        <ThemeSuggestion />
      </Box>
      <div className="welcome-text">
        <h2>Hi, {user.name}</h2>
      </div>
      <section>
        <div className="section-header">
          <h5>Pick up where you left off</h5>
        </div>
        <div className="reminders-grid" data-tour="reminders">
          {streakText && (
            <div className="reminder-card reminder-card--streak">
              <div className="reminder-card__icon">
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1869/1869397.png"
                  alt="streak-calendar"
                />
              </div>
              <div className="reminder-card__body">
                <h4>{streakText.main}</h4>
                <p>{streakText.sub}</p>
              </div>
            </div>
          )}
          {visibleReminders.map((reminder, index) => {
            const meta = REMINDER_META[reminder.type];
            return (
              <Link
                key={reminder.type}
                to={reminder.route}
                className={`reminder-card reminder-card--link reminder-card--${meta.tone}`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="reminder-card__icon">{meta.icon}</div>
                <div className="reminder-card__body">
                  <h4>{meta.title}</h4>
                  <p>{meta.description(reminder.label)}</p>
                  <span className="reminder-card__cta">
                    {meta.cta}
                    <ArrowForwardRoundedIcon />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      {mydecks && mydecks.length !== 0 && (
        <section>
          <div className="section-header">
            <h5>Recents</h5>
          </div>
          <div className="section-cards">
            {mydecks.map((d) => (
              <DeckCard
                key={d.id}
                id={d.id}
                name={d.name}
                owner={d.owner}
                terms={d.number_of_term}
                background={d.background}
              />
            ))}
          </div>
        </section>
      )}
      <PaginatedDeckSection
        title="Public decks"
        queryKey={["decks", "public"]}
        fetchPage={fetchPublicDecksPage}
        onError={setError}
      />
    </div>
  ) : (
    <></>
  );
}

export default Home;
