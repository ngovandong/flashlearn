import { useQuery } from "@tanstack/react-query";
import { buildGamePool, type GamePool, type Term } from "@flashlearn/core";
import { competitionApi } from "@/api/services";
import { unwrap } from "@/utils/apiError";

interface PoolResult {
  deckName: string;
  pool: GamePool;
}

export function useCompetitionPool(deckId: string) {
  return useQuery<PoolResult>({
    queryKey: ["competition", "pool", deckId],
    queryFn: async () => {
      const data = await unwrap<{ deck_name: string; terms: Term[] }>(
        await competitionApi.getPool(deckId)
      );
      return { deckName: data.deck_name, pool: buildGamePool(data.terms) };
    },
    enabled: !!deckId,
    staleTime: 60_000,
  });
}
