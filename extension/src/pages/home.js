import { useEffect, useState } from "react";
import { deckService } from "../api-service/deckService";
import { request } from "../api-service/httpRequest";
import { getFirstError } from "../util/errorHandler";
import { useDispatch, useSelector } from "react-redux";
import { logout, selectToken, selectUser } from "../store";

const FRONTEND_URL = import.meta.env.VITE_BASE_FRONTEND_URL;

const LANGUAGES = [
  { code: "vi", name: "Vietnamese (Tiếng Việt)" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "ko", name: "Korean (한국어)" },
  { code: "zh-CN", name: "Chinese Simplified (简体中文)" }
];

function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const [decks, setDecks] = useState([]);
  const [error, setError] = useState();
  const [defaultDeck, setDefaultDeck] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("vi");
  const [openOnStartup, setOpenOnStartup] = useState(false);
  const dispatch = useDispatch();

  const handleLogout = async () => {
    try {
      if (token?.refresh) {
        await request.post("users/logout/", { refresh: token.refresh });
      }
    } catch {
      // ignore — clear the session locally regardless
    }
    dispatch(logout());
  };

  const fetchDecks = async () => {
    setIsLoading(true);
    try {
      const res = await deckService.getMyDecks();
      if (!res.error) {
        const data = res.data;
        setDecks(Array.isArray(data) ? data : data?.results ?? []);
      } else {
        const responseError = getFirstError(res.error);
        setError(responseError);
      }
      const res2 = await deckService.getMyProfile();
      if (!res2.error) {
        const default_deck = res2.data.default_deck;
        // eslint-disable-next-line no-undef
        chrome.runtime.sendMessage({
          type: "set_default_deck",
          default_deck,
        });
        setDefaultDeck(default_deck || "");
      } else {
        const responseError = getFirstError(res2.error);
        setError(responseError);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChange = (e) => {
    setDefaultDeck(e.target.value);
    deckService.setDefaultDeck(e.target.value);
  };

  const handleLanguageChange = (e) => {
    setTargetLanguage(e.target.value);
    // eslint-disable-next-line no-undef
    chrome.storage.sync.set({ targetLanguage: e.target.value });
  };

  const handleStartupToggle = (e) => {
    const enabled = e.target.checked;
    setOpenOnStartup(enabled);
    // eslint-disable-next-line no-undef
    chrome.storage.sync.set({ openOnStartup: enabled });
  };

  useEffect(() => {
    fetchDecks();
    // eslint-disable-next-line no-undef
    chrome.storage.sync.get(["targetLanguage", "openOnStartup"]).then((result) => {
      if (result.targetLanguage) {
        setTargetLanguage(result.targetLanguage);
      }
      setOpenOnStartup(Boolean(result.openOnStartup));
    });
  }, []);

  return (
    <div className="home-container">
      {error && (
        <div className="error-alert">
          <span className="error-message">{error}</span>
          <span className="error-close" onClick={() => setError(null)}>x</span>
        </div>
      )}

      <div className="home-card">
        <div className="home-header">
          <div className="user-info">
            <img src="images/icon-32.png" className="header-logo" alt="flashlearn logo" />
            <div className="user-text-container">
              <div className="welcome-text">Welcome back,</div>
              {user && <div className="user-name">{user.name}</div>}
            </div>
          </div>
          <button className="logout-button" onClick={handleLogout} title="Logout">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="logout-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading details...</p>
          </div>
        ) : (
          <div className="settings-section">
            <div className="settings-group">
              <label htmlFor="deck-select">Default Deck</label>
              <div className="select-wrapper">
                <select
                  id="deck-select"
                  value={defaultDeck}
                  onChange={handleSelectChange}
                  className="select-deck"
                >
                  <option value="" disabled hidden>
                    Choose deck
                  </option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-group">
              <label htmlFor="lang-select">Translation Language</label>
              <div className="select-wrapper">
                <select
                  id="lang-select"
                  value={targetLanguage}
                  onChange={handleLanguageChange}
                  className="select-deck"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-group settings-toggle-row">
              <div className="settings-toggle-text">
                <label htmlFor="startup-toggle">Open on browser start</label>
                <p className="settings-hint">
                  Automatically open Flashlearn when you launch the browser
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  id="startup-toggle"
                  type="checkbox"
                  checked={openOnStartup}
                  onChange={handleStartupToggle}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </label>
            </div>

            <a href={FRONTEND_URL} target="_blank" rel="noreferrer" className="keep-learning-card">
              <div className="card-content">
                <h3>Go to Flashlearn Website</h3>
                <p>Revise cards and manage decks.</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="arrow-icon"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
