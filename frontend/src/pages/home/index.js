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
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const user = useSelector(selectUser);
  const fetchDeck = async () => {
    setIsLoading(true);
    try {
      const res = await deckService.getMyDecks();
      if (res.data) {
        setMydecks(res.data);
      } else if (res.response) {
        const responseError = getFirstError(res.response.data);
        setError(responseError);
      } else {
        setError("Network fail!");
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
  return (
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
          <h5>Recents</h5>
        </div>
        <div className="section-cards">
          {mydecks &&
            mydecks.map((d) => (
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
    </div>
  );
}

export default Home;
