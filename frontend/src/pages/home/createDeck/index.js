import { Alert, Snackbar } from "@mui/material";
import { useEffect, useState } from "react";
import { deckService } from "@api-services/deckService";
import { useSearchParams } from "react-router-dom";
import { getFirstError } from "@utils/errorHandler";
import { isChangeState } from "@utils/state";
import AddTerms from "./addTermsTab";
import CreateDeckTab from "./createDeckTab";
import { LocalLoadingWrapper } from "@components/loading";

let oldDeck = {};

function CreateDeck() {
  const [error, setError] = useState();
  const [currentTab, setCurrentTab] = useState({ tab: 0, start: 1 });
  const [isLoading, setIsLoading] = useState(false);
  let [searchParams, setSearchParams] = useSearchParams();
  const [deck, setDeck] = useState({
    is_public: false,
    name: "",
    description: "",
    background: null,
  });
  const id = searchParams.get("id");

  const handleClickBack = () => {
    setCurrentTab({ tab: 0, start: 0 });
    setSearchParams({ id: id, tab: "0" });
  };

  const handleClickNext = async () => {
    if (id) {
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
          const res = await deckService.partial_update(id, formData);
          setIsLoading(false);
          if (res.data) {
            setDeck(res.data);
            oldDeck = res.data;

            setCurrentTab({ tab: 1, start: 0 });
            setSearchParams({ id: res.data.id, tab: "1" });
          } else {
            const responseError = getFirstError(res.response.data);
            setError(responseError);
          }
        } else {
          setError("Please fill all fields!");
        }
      } else {
        setCurrentTab({ tab: 1, start: 0 });
        setSearchParams({ id, tab: "1" });
      }
    } else {
      if (deck.background && deck.description && deck.name) {
        const formData = new FormData();
        formData.append("is_public", deck.is_public);
        formData.append("name", deck.name);
        formData.append("description", deck.description);
        formData.append("background", deck.background);
        setIsLoading(true);
        try {
          const res = await deckService.create(formData);
          setIsLoading(false);
          if (res.data) {
            setDeck(res.data);
            setDeck(res.data);
            oldDeck = res.data;
            setCurrentTab({ tab: 1, start: 0 });
            setSearchParams((pre) => ({ ...pre, id: res.data.id, tab: "1" }));
          } else {
            const responseError = getFirstError(res.response.data);
            setError(responseError);
          }
        } catch (error) {
          console.log(error);
          setIsLoading(false);
          setError("Something wrong!");
        }
      } else {
        setError("Please fill all fields!");
      }
    }
  };

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (tab == null) {
      setSearchParams((pre) => ({ ...pre, tab: "0" }));
    }
    if (tab === "1") {
      setCurrentTab({ tab: 1, start: 0 });
    }
  }, []);

  const fetchDeck = async (id) => {
    setIsLoading(true);
    const res = await deckService.retrieve(id);
    setIsLoading(false);
    if (res.data) {
      setDeck(res.data);
      oldDeck = res.data;
    } else {
      const responseError = getFirstError(res.response.data);
      setError(responseError);
    }
  };

  useEffect(() => {
    if (id && !deck.id) {
      fetchDeck(id);
    }
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
          <h2>Create a new study deck</h2>
        </div>
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
          <AddTerms handleClickBack={handleClickBack} />
        </div>
      </div>
    </>
  );
}

export default CreateDeck;
