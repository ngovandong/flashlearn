import { deckService } from "@api-services/deckService";
import { DeckCardSkeletonGrid } from "@components/skeletons";
import { DECK_PAGE_SIZE } from "@constants/pageSize";
import { getFirstError } from "@utils/errorHandler";
import { Pagination } from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import DeckCard from "./deckCard";

function normalizeDeckPage(data) {
  if (!data) {
    return { results: [], count: 0, hasNext: false };
  }
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      hasNext: data.length >= DECK_PAGE_SIZE,
    };
  }
  return {
    results: data.results ?? [],
    count: data.count ?? 0,
    hasNext: Boolean(data.next),
  };
}

function PaginatedDeckSection({
  title,
  queryKey,
  fetchPage,
  enabled = true,
  hideWhenEmpty = false,
  onError,
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: [...queryKey, page],
    queryFn: async () => {
      const res = await fetchPage(page);
      if (res.error) {
        throw new Error(getFirstError(res.error));
      }
      return res.data;
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (error && onError) {
      onError(error.message);
    }
  }, [error, onError]);

  const { results: decks, count: totalCount, hasNext } = normalizeDeckPage(data);
  const pageCount = Math.max(1, Math.ceil(totalCount / DECK_PAGE_SIZE));
  const showPagination = pageCount > 1 || hasNext;

  if (hideWhenEmpty && !isLoading && totalCount === 0) {
    return null;
  }

  return (
    <section>
      <div className="section-header">
        <h5>{title}</h5>
      </div>
      {isLoading && !data ? (
        <DeckCardSkeletonGrid count={4} />
      ) : (
        <div className={`section-cards${isFetching ? " section-cards--loading" : ""}`}>
          {decks.map((d) => (
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
      )}
      {showPagination && (
        <div className="section-pagination">
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            shape="rounded"
          />
        </div>
      )}
    </section>
  );
}

export const fetchPublicDecksPage = (page) => deckService.getPublicDecks(page);
export const fetchMyOwnDecksPage = (page) => deckService.getMyOwnDecks(page);
export const fetchOthersDeckPage = (page) => deckService.getOthersDeck(page);

export default PaginatedDeckSection;
