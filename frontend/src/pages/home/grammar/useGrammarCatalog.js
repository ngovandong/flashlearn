import { useCallback, useEffect, useState } from "react";

import { grammarService } from "@api-services/grammarService";

// Loads the list of grammar books plus the selected book's catalog. Shared by
// the Grammar tab and the Course tab so both get identical book-selector
// behaviour. Switching books refetches only that book's catalog.
export default function useGrammarCatalog() {
  const [books, setBooks] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([grammarService.getBooks(), grammarService.getCatalog()])
      .then(([booksRes, catRes]) => {
        if (!active) return;
        setBooks(booksRes.data?.books || []);
        setCatalog(catRes.data);
        setActiveSlug(catRes.data?.book?.slug || null);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selectBook = useCallback(
    (slug) => {
      if (!slug || slug === activeSlug) return;
      setActiveSlug(slug);
      setLoading(true);
      grammarService
        .getCatalog(slug)
        .then((res) => setCatalog(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [activeSlug]
  );

  return { books, activeSlug, selectBook, catalog, loading };
}
