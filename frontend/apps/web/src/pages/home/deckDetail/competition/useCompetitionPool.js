import { useQuery } from "@tanstack/react-query";
import { competitionService } from "@api-services/competitionService";
import { getFirstError } from "@utils/errorHandler";
import { buildGamePool } from "@flashlearn/core";

// Fetches the deck's term sample once and derives the game availability flags.
export function useCompetitionPool(deckID) {
  return useQuery({
    queryKey: ["competitionPool", deckID],
    queryFn: async () => {
      const res = await competitionService.getPool(deckID);
      if (res.error) {
        throw new Error(getFirstError(res.error));
      }
      const { terms, deck_name } = res.data;
      return {
        deckName: deck_name,
        pool: buildGamePool(terms),
      };
    },
    enabled: Boolean(deckID),
    staleTime: 60_000,
  });
}
