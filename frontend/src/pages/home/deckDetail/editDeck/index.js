import { Alert, Snackbar } from "@mui/material";
import { useEffect, useState } from "react";
import { deckService } from "@api-services/deckService";
import { useParams, useSearchParams } from "react-router-dom";
import { getFirstError } from "@utils/errorHandler";
import { isChangeState } from "@utils/state";
import AddTermsTab from "./addTermsTab";
import CreateDeckTab from "./createDeckTab";
import DeckWizardSteps from "@components/deckWizardSteps";
import { LocalLoadingWrapper } from "@components/loading";

let oldDeck = {};

function EditDeck() {
  const [error, setError] = useState();
  const [currentTab, setCurrentTab] = useState({ tab: 0, start: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [deck, setDeck] = useState({
    is_public: false,
    name: "",
    description: "",
    background: null,
  });
  const { deckID } = useParams();

  const handleClickBack = () => {
    setCurrentTab({ tab: 0, start: 0 });
    setSearchParams({ tab: "0" });
  };

  const handleClickNext = async () => {
    if (isChangeState(oldDeck, deck)) {
      if (deck.background && deck.description && deck.name) {
        const formData = new FormData();
        formData.append("is_public", deck.is_public);
        formData.append("name", deck.name);
        formData.append("description", deck.description);
        if (typeof deck.background !== "string") {
          formData.append("background", deck.background);
        }
        setIsLoading(true);
        try {
          const res = await deckService.partial_update(deckID, formData);
          if (!res.error) {
            setDeck(res.data);
            oldDeck = res.data;
            setCurrentTab({ tab: 1, start: 0 });
            setSearchParams({ tab: "1" });
          } else {
            const responseError = getFirstError(res.error);
            setError(responseError);
          }
        } catch (error) {
          setError("Something went wrong. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        setError("Please fill in all fields.");
      }
    } else {
      setCurrentTab({ tab: 1, start: 0 });
      setSearchParams({ tab: "1" });
    }
  };

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (tab == null) {
      setSearchParams({ tab: "0" });
    }
    if (tab === "1") {
      setCurrentTab({ tab: 1, start: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDeck = async () => {
    setIsLoading(true);
    try {
      const res = await deckService.retrieve(deckID);
      if (!res.error) {
        setDeck(res.data);
        oldDeck = res.data;
      } else {
        const responseError = getFirstError(res.error);
        setError(responseError);
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (deckID) {
      fetchDeck();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <h2>Edit your deck</h2>
        </div>
        <DeckWizardSteps active={currentTab.tab} onStepClick={handleClickBack} />
        <div
          className="create-deck__tab next"
          tab={currentTab.tab}
          start={currentTab.start}
        >
          <CreateDeckTab
            deck={deck}
            setDeck={setDeck}
            handleClickNext={handleClickNext}
          />
        </div>
        <div className="create-deck__tab back" tab={currentTab.tab}>
          <AddTermsTab handleClickBack={handleClickBack} />
        </div>
      </div>
    </>
  );
}

export default EditDeck;
