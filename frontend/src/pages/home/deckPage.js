import { Alert, Snackbar } from "@mui/material";
import React, { useState } from "react";
import PaginatedDeckSection, {
  fetchMyOwnDecksPage,
  fetchOthersDeckPage,
  fetchPublicDecksPage,
} from "./paginatedDeckSection";

function DeckPage() {
  const [error, setError] = useState();

  return (
    <div className="home-page">
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
      <PaginatedDeckSection
        title="My decks"
        queryKey={["decks", "my_own"]}
        fetchPage={fetchMyOwnDecksPage}
        onError={setError}
      />
      <PaginatedDeckSection
        title="Others deck"
        queryKey={["decks", "others"]}
        fetchPage={fetchOthersDeckPage}
        hideWhenEmpty
        onError={setError}
      />
      <PaginatedDeckSection
        title="Public decks"
        queryKey={["decks", "public"]}
        fetchPage={fetchPublicDecksPage}
        onError={setError}
      />
    </div>
  );
}

export default DeckPage;
