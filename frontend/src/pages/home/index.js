import { deckService } from "@api-services/deckService";
import { LocalLoadingWrapper } from "@components/loading";
import { Alert, Snackbar } from "@mui/material";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import DeckCard from "./deckCard";
function Home() {
  const [mydecks, setMydecks] = useState();
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const fetchDeck = async () => {
    setIsLoading(true);
    const res = await deckService.getMyDecks();
    if (res.data) {
      setMydecks(res.data);
    } else if (res.response) {
      const responseError = getFirstError(res.response.data);
      setError(responseError);
    } else {
      setError("Network fail!");
    }
    setIsLoading(false);
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
        <h2>Hi, Dong Ngo</h2>
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
