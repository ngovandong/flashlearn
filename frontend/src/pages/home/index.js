import { deckService } from "@api-services/deckService";
import { LocalLoadingWrapper } from "@components/loading";
import { Alert, Snackbar } from "@mui/material";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import DeckCard from "./deckCard";
import { useSelector } from "react-redux";
import { selectUser } from "@app/store/authSlice";
function Home() {
  const [mydecks, setMydecks] = useState();
  const [publicDecks, setPublicDecks] = useState();
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
      console.log(error);
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
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchDeck();
  }, []);
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
              <div>You have a 1-day streak of learning</div>
              <span>Keep studying hard to maintain your streak!</span>
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
