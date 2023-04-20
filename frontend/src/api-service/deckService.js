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
  getLatestDeck = () => {
    return this.request.get(this.action("latest_decks"));
  };
  getOthersDeck = () => {
    return this.request.get(this.action("others_deck"));
  };
  getInviteUrl = (id, role) => {
    return this.request.post(this.detailAction(id, "get_invite_url"), { role });
  };

  addUserToDeck = (id, user) => {
    return this.request.post(this.detailAction(id, "add_user_to_deck"), user);
  };

  removeUserFromDeck = (id, email) => {
    return this.request.post(this.detailAction(id, "add_user_from_deck"), {
      email,
    });
  };
  clearLearningProgress = (id) => {
    return this.request.put(this.detailAction(id, "clear_learning_process"));
  };
  searchDeck = (searchText) => {
    return this.request.get(this.base, { params: { search: searchText } });
  };
  joinDeck = (id) => {
    return this.request.post(this.detailAction(id, "join_deck"));
  };
  leaveDeck = (id) => {
    return this.request.post(this.detailAction(id, "leave_deck"));
  };
}

export const deckService = new DeckService();
