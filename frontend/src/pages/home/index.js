import { LocalLoadingWrapper } from "@components/loading";
import { Alert, Snackbar } from "@mui/material";
import { useLatestDecks, useLearningStreak } from "@hooks/useLatestDecks";
import React, { useState } from "react";
import DeckCard from "./deckCard";
import PaginatedDeckSection, { fetchPublicDecksPage } from "./paginatedDeckSection";
import { useSelector } from "react-redux";
import { selectUser } from "@app/store/authSlice";

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

  const queryError = decksError?.message;

  const streakText = learningStreak ? streakCopy(learningStreak) : null;

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
      <div className="welcome-text">
        <h2>Hi, {user.name}</h2>
      </div>
      <section>
        <div className="section-header">
          <h5>Achievements</h5>
          <div className="streak-container">
            <img
              src="https://cdn-icons-png.flaticon.com/512/1869/1869397.png"
              alt="streak-calendar"
            />
            <div className="streak-text">
              {streakText && (
                <>
                  <div>{streakText.main}</div>
                  <span>{streakText.sub}</span>
                </>
              )}
            </div>
          </div>
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
