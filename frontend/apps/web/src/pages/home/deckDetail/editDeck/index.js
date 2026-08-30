import { Alert, Snackbar } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBackIosNew";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { deckService } from "@api-services/deckService";
import { getFirstError } from "@utils/errorHandler";
import { isChangeState } from "@utils/state";
import { LocalLoadingWrapper } from "@components/loading";
import DeckDetailsPanel from "./deckDetailsPanel";
import TermManager from "./termManager";

const EMPTY_DECK = {
  is_public: false,
  name: "",
  description: "",
  background: null,
};

/**
 * Deck editor — deck details and terms on a single page.
 *
 * It used to be a two-step wizard (`?tab=0` / `?tab=1`), which forced a round
 * trip through the details form for anyone who only wanted to fix a term. The
 * details now live in a collapsible panel above the term list; the legacy tab
 * query param is dropped on arrival so old links still land here.
 */
function EditDeck() {
  const { deckID } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [deck, setDeck] = useState(EMPTY_DECK);
  const [savedDeck, setSavedDeck] = useState(EMPTY_DECK);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isDirty = isChangeState(savedDeck, deck);

  const fetchDeck = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await deckService.retrieve(deckID);
      if (res.error) {
        setError(getFirstError(res.error));
        return;
      }
      setDeck(res.data);
      setSavedDeck(res.data);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [deckID]);

  useEffect(() => {
    if (deckID) fetchDeck();
  }, [deckID, fetchDeck]);

  useEffect(() => {
    if (searchParams.has("tab")) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const saveDetails = async () => {
    if (!deck.name || !deck.description) {
      setError("A deck needs a title and a description.");
      return;
    }
    const formData = new FormData();
    formData.append("is_public", deck.is_public);
    formData.append("name", deck.name);
    formData.append("description", deck.description);
    if (deck.background && typeof deck.background !== "string") {
      formData.append("background", deck.background);
    }
    setIsSaving(true);
    try {
      const res = await deckService.partial_update(deckID, formData);
      if (res.error) {
        setError(getFirstError(res.error));
        return;
      }
      setDeck(res.data);
      setSavedDeck(res.data);
      setJustSaved(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!justSaved) return undefined;
    const timer = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  return (
    <>
      <LocalLoadingWrapper open={isLoading || isSaving} />
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={error != null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={notice != null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
      >
        <Alert onClose={() => setNotice(null)} severity="success">
          {notice}
        </Alert>
      </Snackbar>

      <div className="deck-editor">
        <Link to={`/deck/${deckID}`} className="deck-editor__back">
          <ArrowBackIcon fontSize="inherit" />
          Back to deck
        </Link>

        <div className="deck-editor__header">
          <div>
            <h2>Edit deck</h2>
            <p>Deck details and every term, all on one page. Changes to terms save as you make them.</p>
          </div>
          <Link to={`/deck/${deckID}`} className="deck-editor__done" data-tour="deck-done">
            Done
          </Link>
        </div>

        <DeckDetailsPanel
          deck={deck}
          setDeck={setDeck}
          onSave={saveDetails}
          isSaving={isSaving}
          isDirty={isDirty}
          justSaved={justSaved}
        />

        <TermManager onError={setError} onNotice={setNotice} />
      </div>
    </>
  );
}

export default EditDeck;
