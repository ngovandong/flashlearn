import { Alert, Button, Snackbar } from "@mui/material";
import TermCard from "./termCard";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import { termService } from "@api-services/termService";
import { Link, useParams } from "react-router-dom";
import { LocalLoadingWrapper } from "@components/loading";
import { getFirstError } from "@utils/errorHandler";
import { filterChangedTerms, isChangeState } from "@utils/state";

const emptyTerm = {
  name: "",
  description: "",
  image: "",
  error: null,
  open: false,
};

const initTerms = [emptyTerm, emptyTerm, emptyTerm, emptyTerm];
let oldTerms = initTerms;

function AddTermsTab({ handleClickBack }) {
  const [terms, setTerms] = useState(initTerms);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState();
  const [isSuccess, setIsSuccess] = useState(false);
  const { deckID } = useParams();
  const isUpdate = terms[0].id;
  const isSateChanged = isChangeState(oldTerms, terms);

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
    if (terms.length > 5) {
      const term = terms[i];
      if (term.id) {
        try {
          setIsLoading(true);
          const res = await termService.delete(term.id);
          if (res.status === 204) {
            fetchTerms();
          } else {
            setError("Delete Fail!");
          }
        } catch (error) {
          console.log(error);
          setError("Something Wrong!");
        } finally {
          setIsLoading(false);
        }
      } else {
        const newTerms = terms.filter((_, index) => index !== i);
        setTerms(newTerms);
      }
    } else {
      setError("Decks must have more than 4 terms");
    }
  };
  const handleAddTerm = () => {
    setTerms((pre) => [...pre, emptyTerm]);
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
      } else if (!t.description) {
        success = false;
        return { ...t, error: "Description is required" };
      }
      return { ...t, error: null };
    });
    const sameNameTerms = validateSameName(newterms);
    console.log(newterms);
    console.log(sameNameTerms);
    if (success && sameNameTerms) {
      success = false;
      sameNameTerms.forEach(
        (index) =>
          (newterms[
            index
          ].error = `Term '${newterms[index].name}' is already used`)
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
      setError("You must add at least four terms!");
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
            const updatedTerms = filterChangedTerms(oldTerms, result);
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
          console.log(error);
          setError("Something wrong!");
        } finally {
          if (ischangedState) fetchTerms();
          setIsLoading(false);
        }
      } else {
        setTerms(result);
      }
    }
  };

  const fetchTerms = async () => {
    setIsLoading(true);
    try {
      const res = await termService.getTermsByDeck(deckID);
      if (!res.error) {
        if (res.data.length) {
          const fetchedTerms = convertTerms(res.data);
          oldTerms = fetchedTerms;
          setTerms(fetchedTerms);
        }
      } else {
        console.log(res.error);
        const errorMessage = getFirstError(res.error);
        setError(errorMessage);
      }
    } catch (error) {
      console.log(error);
      setError("Something wrong!");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (deckID) {
      fetchTerms();
    }
  }, []);

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
          Update terms success
        </Alert>
      </Snackbar>
      {isLoading && <LocalLoadingWrapper />}
      <div className="upper-btns">
        <div className="back-btn" onClick={handleClickBack}>
          <span>{"<   "}</span>
          Back to previous
        </div>
        <div className="group-btns">
          <div
            className={`save-btn ${!isSateChanged ? "disabled" : ""}`}
            onClick={handleClickSave}
          >
            Save
          </div>
          {isUpdate && (
            <Link to={`/deck/${deckID}`} className="main-btn">
              Done
            </Link>
          )}
        </div>
      </div>
      <div className="add-terms-tab">
        {terms.map((t, i) => (
          <TermCard
            key={i}
            index={i}
            term={t}
            handleTermChange={handleTermChange}
            handleDeleteTerm={handleDeleteTerm}
          />
        ))}
        <div className="add-more-container">
          <Button
            variant="contained"
            color="blue"
            component="span"
            startIcon={<AddIcon />}
            onClick={handleAddTerm}
          >
            <span className="button-text">Add Term</span>
          </Button>
        </div>
      </div>
    </>
  );
}

export default AddTermsTab;
