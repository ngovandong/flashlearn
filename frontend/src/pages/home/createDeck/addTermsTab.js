import { Alert, Button, Snackbar } from "@mui/material";
import TermCard from "./termCard";
import AddIcon from "@mui/icons-material/Add";
import { useState } from "react";
import { termService } from "@api-services/termService";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LocalLoadingWrapper } from "@components/loading";
import { getFirstError } from "@utils/errorHandler";

const emptyTerm = {
  name: "",
  description: "",
  image: "",
  error: null,
  open: false,
};

function AddTerms({ handleClickBack }) {
  const [terms, setTerms] = useState([emptyTerm, emptyTerm, emptyTerm]);
  let [searchParams, _] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState();
  const navigate = useNavigate();
  const deck_id = searchParams.get("id");

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
  const handleDeleteTerm = (i) => {
    const term = terms[i];
    if (term.id) {
      termService.delete(term.id);
    } else {
      const newTerms = terms.filter((_, index) => index !== i);
      setTerms(newTerms);
    }
  };
  const handleAddTerm = () => {
    setTerms((pre) => [...pre, emptyTerm]);
  };

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
    if (success) {
      const result = terms.map((t) => ({
        name: t.name,
        description: t.description,
        image: t.image,
      }));
      return [true, result];
    } else {
      return [false, newterms];
    }
  };

  const handleClickDone = async () => {
    if (terms.length < 3) {
      setError("You must add at least three terms.");
    } else {
      const [success, result] = validate();
      if (success === true) {
        setIsLoading(true);
        try {
          const res = await termService.addTermsToDeck(deck_id, result);
          if (!res.error) {
            navigate("/");
          } else {
            const errorMessage = getFirstError(res.error);
            setError(errorMessage);
          }
        } catch (error) {
          console.log(error);
          setError("Something wrong!");
        } finally {
          setIsLoading(false);
        }
      } else {
        setTerms(result);
      }
    }
  };

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
      {isLoading && <LocalLoadingWrapper />}
      <div className="upper-btns">
        <div className="back-btn" onClick={handleClickBack}>
          <span>{"<   "}</span>
          Back to previous
        </div>
        <div className="main-btn" onClick={handleClickDone}>
          Done
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

export default AddTerms;
