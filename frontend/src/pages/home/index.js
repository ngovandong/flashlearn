import { deckService } from "@api-services/deckService";
import { userSettingService } from "@api-services/userSettingService";
import { LocalLoadingWrapper } from "@components/loading";
import { Alert, Snackbar } from "@mui/material";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import DeckCard from "./deckCard";
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
  const [mydecks, setMydecks] = useState();
  const [publicDecks, setPublicDecks] = useState();
  const [learningStreak, setLearningStreak] = useState();
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const user = useSelector(selectUser);
  const fetchDeck = async () => {
    setIsLoading(true);
    try {
      const res = await deckService.getLatestDeck();
      if (!res.error) {
        const decks = res.data;
        setMydecks(decks);
        if (decks.length < 3) {
          fetchPublicDeck();
        }
      } else {
        const responseError = getFirstError(res.error);
        setError(responseError);
      }
    } catch (error) {
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchPublicDeck = async () => {
    setIsLoading(true);
    try {
      const res = await deckService.getPublicDecks();
      if (!res.error) {
        setPublicDecks(res.data);
      } else {
        const responseError = getFirstError(res.error);
        setError(responseError);
      }
    } catch (error) {
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchLearningStreak = async () => {
    try {
      const res = await userSettingService.getLearningStreak();
      if (!res.error) {
        setLearningStreak(res.data);
      }
    } catch {
      // streak is non-critical; leave section empty on failure
    }
  };

  useEffect(() => {
    fetchDeck();
    fetchLearningStreak();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streakText = learningStreak ? streakCopy(learningStreak) : null;

  return user ? (
    <div className="home-page">
      <LocalLoadingWrapper open={isLoading} />
      <Snackbar
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        open={error != null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
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
      {publicDecks && (
        <section>
          <div className="section-header">
            <h5>Public decks</h5>
          </div>
          <div className="section-cards">
            {publicDecks.map((d) => (
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
    </div>
  ) : (
    <></>
  );
}

export default Home;
