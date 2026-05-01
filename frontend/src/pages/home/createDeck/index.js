import { Alert, Snackbar } from "@mui/material";
import { useState } from "react";
import { deckService } from "@api-services/deckService";
import { getFirstError } from "@utils/errorHandler";
import { LocalLoadingWrapper } from "@components/loading";
import CreateDeckTab from "../deckDetail/editDeck/createDeckTab";
import { useNavigate } from "react-router-dom";

function CreateDeck() {
  const [error, setError] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [deck, setDeck] = useState({
    is_public: false,
    name: "",
    description: "",
    background: null,
  });

  const handleClickNext = async () => {
    if (deck.description && deck.name) {
      const formData = new FormData();
      formData.append("is_public", deck.is_public);
      formData.append("name", deck.name);
      formData.append("description", deck.description);
      if (deck.background) formData.append("background", deck.background);
      setIsLoading(true);
      try {
        const res = await deckService.create(formData);
        if (!res.error) {
          navigate(`/deck/${res.data.id}/edit?tab=1`);
        } else {
          const responseError = getFirstError(res.error);
          setError(responseError);
        }
      } catch (error) {
        setError("Something wrong!");
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("Please fill all fields!");
    }
  };

  return (
    <>
      <LocalLoadingWrapper open={isLoading} />
      <div className="create-deck">
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
        <div className="create-deck__header">
          <h2>Create a new study deck</h2>
        </div>
        <div className="create-deck__tab next" start={0}>
          <CreateDeckTab
            deck={deck}
            setDeck={setDeck}
            handleClickNext={handleClickNext}
          />
        </div>
      </div>
    </>
  );
}

export default CreateDeck;
