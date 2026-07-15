import { Alert, Button, Snackbar } from "@mui/material";
import TermCard from "./termCard";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useRef, useState } from "react";
import { termService } from "@api-services/termService";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LocalLoadingWrapper } from "@components/loading";
import { getFirstError } from "@utils/errorHandler";
import { filterChangedTerms, isChangeState } from "@utils/state";

const emptyTerm = {
  name: "",
  meaning: "",
  image: "",
  word_type: "",
  pronunciation: "",
  definition: "",
  synonyms: [],
  antonyms: [],
  examples: [],
  word_forms: [],
  word_family: [],
  ai_filled: false,
  error: null,
  open: false,
};

const initTerms = [emptyTerm, emptyTerm, emptyTerm, emptyTerm];

function AddTermsTab({ handleClickBack }) {
  const oldTermsRef = useRef(initTerms);
  const isLoadMoreRef = useRef(false);
  const [terms, setTerms] = useState(initTerms);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState();
  const [isSuccess, setIsSuccess] = useState(false);
  const { deckID } = useParams();
  const isUpdate = terms.some((t) => t.id);
  const isSateChanged = isChangeState(oldTermsRef.current, terms);
  const [fetchState, setFetchState] = useState({
    cursor: null,
    next: "",
  });

  const navigate = useNavigate();

  const convertTerms = (terms) => {
    return terms.map((t) => ({
      ...t,
      open: false,
      error: null,
    }));
  };

  const handleTermChange = (i, term) => {
    const newTerms = terms.map((t, index) => {
      if (index !== i) {
        return t;
      } else {
        return term;
      }
    });
    setTerms(newTerms);
  };
  const handleDeleteTerm = async (i) => {
    if (terms.length > 4) {
      const term = terms[i];
      if (term.id) {
        try {
          setIsLoading(true);
          const res = await termService.delete(term.id);
          if (res.status === 204) {
            setTerms((pre) => pre.filter((t) => t.id !== term.id));
          } else {
            setError("Couldn't delete the term. Please try again.");
          }
        } catch (error) {
          setError("Something went wrong. Please try again.");
        } finally {
          setIsLoading(false);
        }
      } else {
        const newTerms = terms.filter((_, index) => index !== i);
        setTerms(newTerms);
      }
    } else {
      setError("A deck needs at least 4 terms.");
    }
  };
  const handleAddTerm = () => {
    setTerms((pre) => [emptyTerm, ...pre]);
  };

  function validateSameName(array) {
    const seenNames = {};
    const duplicateIndices = [];

    array.forEach((obj, index) => {
      const name = obj.name;
      if (seenNames[name]) {
        duplicateIndices.push(index);
      } else {
        seenNames[name] = true;
      }
    });

    if (duplicateIndices.length === 0) {
      return null;
    } else {
      return duplicateIndices;
    }
  }

  const validate = () => {
    let success = true;
    const newterms = terms.map((t) => {
      if (!t.name) {
        success = false;
        return { ...t, error: "Name is required" };
      }
      return { ...t, error: null };
    });
    const sameNameTerms = validateSameName(newterms);
    if (success && sameNameTerms) {
      success = false;
      sameNameTerms.forEach(
        (index) =>
          (newterms[
            index
          ].error = `Term '${newterms[index].name}' is already in this deck`)
      );
    }

    if (success) {
      return [true, newterms];
    } else {
      return [false, newterms];
    }
  };

  const handleClickSave = async () => {
    let ischangedState = false;
    if (terms.length < 4) {
      setError("A deck needs at least 4 terms.");
    } else {
      const [success, result] = validate();
      if (success === true) {
        setIsLoading(true);
        try {
          if (isUpdate) {
            const notCreated = result.filter((t) => !t.id);
            if (notCreated.length > 0) {
              const res = await termService.addTermsToDeck(deckID, notCreated);
              ischangedState = true;
              if (res.error) {
                setError(res.error);
              }
            }
            const updatedTerms = filterChangedTerms(oldTermsRef.current, result);
            if (updatedTerms.length > 0) {
              const res = await termService.updateTerms(updatedTerms);
              ischangedState = true;
              if (res.error) {
                setError(res.error);
              }
            }
          } else {
            const res = await termService.addTermsToDeck(deckID, result);
            ischangedState = true;
            if (res.error) {
              setError(res.error);
            }
          }
        } catch (error) {
          setError("Something went wrong. Please try again.");
        } finally {
          setFetchState({
            cursor: null,
            next: "",
          });
          if (ischangedState) fetchTerms(null, true);
          setIsLoading(false);
        }
      } else {
        setTerms(result);
      }
    }
  };

  const extractcursor = (url) => {
    if (!url) return null;
    const urlObject = new URL(url);

    return urlObject.searchParams.get("cursor");
  };

  const fetchTerms = async (cursor = null, refresh = false) => {
    setIsLoading(true);
    try {
      const res = await termService.getTermsByDeckCursor(
        deckID,
        cursor | refresh ? cursor : fetchState.cursor
      );
      if (!res.error) {
        if (res.data.results.length > 0) {
          setFetchState(() => ({
            cursor: extractcursor(res.data.next),
            next: res.data.next,
          }));
          const fetchedTerms = isUpdate
            ? [...(refresh ? [] : terms), ...convertTerms(res.data.results)]
            : convertTerms(res.data.results);
          oldTermsRef.current = fetchedTerms;
          setTerms(fetchedTerms);
        }
      } else {
        const errorMessage = getFirstError(res.error);
        setError(errorMessage);
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      isLoadMoreRef.current = false;
    }
  };

  useEffect(() => {
    if (deckID) {
      fetchTerms();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    // Calculate the distance between the bottom of the viewport and the bottom of the document
    const isAtBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 50;
    // Update the state based on whether the user is at the end of the page
    if (!isLoadMoreRef.current && isAtBottom && fetchState.next) {
      isLoadMoreRef.current = true;
      fetchTerms();
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchState]);

  return (
    <>
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
      <Snackbar
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        open={isSuccess}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setIsSuccess(false)} severity="success">
          Terms updated
        </Alert>
      </Snackbar>
      {isLoading && <LocalLoadingWrapper />}
      {!isUpdate && (
        <div
          className="back-btn"
          onClick={() => navigate(`/deck/${deckID}?notnavigate=true`)}
        >
          <span>{"<   "}</span>
          Back to detail
        </div>
      )}
      <div className="upper-btns">
        <div className="back-btn" onClick={handleClickBack}>
          <span>{"<   "}</span>
          Back to previous
        </div>
        <div className="group-btns">
          <div
            className={`save-btn${!isSateChanged ? " disabled" : ""}`}
            onClick={handleClickSave}
          >
            Save
          </div>
          {isUpdate && (
            <Link to={`/deck/${deckID}`} className={`main-btn`}>
              Done
            </Link>
          )}
        </div>
      </div>
      <div className="add-terms-tab">
        <div className="add-more-container">
          <Button
            variant="contained"
            color="blue"
            component="span"
            startIcon={<AddIcon />}
            onClick={handleAddTerm}
          >
            <span className="button-text">Add term</span>
          </Button>
        </div>
        {terms.map((t, i) => (
          <TermCard
            key={i}
            index={i}
            term={t}
            handleTermChange={handleTermChange}
            handleDeleteTerm={handleDeleteTerm}
          />
        ))}
      </div>
    </>
  );
}

export default AddTermsTab;
