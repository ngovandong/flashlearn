import BaseService from "./baseService";

class DeckService extends BaseService {
  constructor() {
    super("decks");
  }
  getMyDecks = () => {
    return this.request.get(this.action("my_own_decks"));
  };
  setDefaultDeck = (deck_id) => {
    return this.request.put(this.detailAction(deck_id, "set_default_deck"));
  };
  getMyProfile = () => {
    return this.request.get("users/get_profile");
  };
}
export const deckService = new DeckService();
