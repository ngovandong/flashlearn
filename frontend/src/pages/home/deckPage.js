import { deckService } from "@api-services/deckService";
import { LocalLoadingWrapper } from "@components/loading";
import { Alert, Snackbar } from "@mui/material";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import DeckCard from "./deckCard";
function DeckPage() {
  const [mydecks, setMydecks] = useState([]);
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [othersDeck, setOthersDeck] = useState([]);
  const fetchDeck = async () => {
    setIsLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        deckService.getMyOwnDecks(),
        deckService.getOthersDeck(),
      ]);
      if (!res1.error) {
        setMydecks(res1.data);
      } else {
        const responseError = getFirstError(res1.error);
        setError(responseError);
      }
      if (!res2.error) {
        setOthersDeck(res2.data);
      } else {
        const responseError = getFirstError(res2.error);
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
      <section>
        <div className="section-header">
          <h5>My decks</h5>
        </div>
        <div className="section-cards">
          {mydecks.length !== 0 &&
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
      {othersDeck.length !== 0 && (
        <section>
          <div className="section-header">
            <h5>Others deck</h5>
          </div>
          <div className="section-cards">
            {othersDeck.map((d) => (
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
  );
}

export default DeckPage;
