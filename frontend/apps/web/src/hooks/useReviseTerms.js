import { useQuery } from "@tanstack/react-query";
import { learningService } from "@api-services/learningService";
import { getFirstError } from "@utils/errorHandler";
import { generateQuestions } from "@pages/home/deckDetail/revise/generateQuestion";

export function useReviseTerms(deckID) {
  return useQuery({
    queryKey: ["reviseTerms", deckID],
    queryFn: async () => {
      const res = await learningService.getReviseTerms(deckID);
      if (res.error) {
        throw new Error(getFirstError(res.error));
      }
      const { revise_terms, all_terms, deck_name } = res.data;
      return {
        deckName: deck_name,
        questions: generateQuestions(revise_terms, all_terms),
        reviseCount: revise_terms.length,
      };
    },
    enabled: Boolean(deckID),
    // A revise session is a freshly randomized question set: keeping it cached
    // would render the previous session's questions before the refetch lands.
    staleTime: 0,
    gcTime: 0,
  });
}
