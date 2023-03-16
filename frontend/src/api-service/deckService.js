import { request } from "./httpRequest";
import BaseService from "./baseService";

class DeckService extends BaseService {
  constructor() {
    super("decks");
  }

  getMyDecks = () => {
    return this.request.get(this.action("my_decks"));
  };
  getMyOwnDecks = () => {
    return this.request.get(this.action("my_own_decks"));
  };

  addUserToDeck = (id, user) => {
    return this.request.post(this.detailAction(id, "add_user_to_deck"), user);
  };

  removeUserFromDeck = (id, email) => {
    return this.request.post(this.detailAction(id, "add_user_from_deck"), { email });
  };
}

export const deckService = new DeckService();
