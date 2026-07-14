/* eslint-disable no-undef */

import { translateText } from "./popup/translate";

const FRONTEND_URL = import.meta.env.VITE_BASE_FRONTEND_URL;

function openFrontendIfEnabled() {
  chrome.storage.sync.get(["openOnStartup"]).then((result) => {
    if (result.openOnStartup && FRONTEND_URL) {
      chrome.tabs.create({ url: FRONTEND_URL });
    }
  });
}

chrome.runtime.onStartup.addListener(openFrontendIfEnabled);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "get_auth_token": {
      // Flag the tab so the web app hands a token to the extension even when the
      // user is already logged in (no fresh login event fires in that case).
      const sep = FRONTEND_URL.includes("?") ? "&" : "?";
      chrome.tabs.create({ url: `${FRONTEND_URL}${sep}source=extension` });
      break;
    }
    case "login":
      chrome.storage.sync.set({ token: message.token });
      break;
    case "set_default_deck":
      chrome.storage.sync.set({ default_deck: message.default_deck });
      break;
    case "is_logged_in":
      chrome.storage.sync.get(["token", "default_deck"]).then((result) => {
        if (result.token) {
          sendResponse({
            token: result.token,
            default_deck: result.default_deck || null,
          });
        } else {
          sendResponse(null);
        }
      });
      return true;
    default:
      break;
  }

  if (message.action === "translate") {
    chrome.storage.sync.get(["targetLanguage"]).then((result) => {
      const targetLang = result.targetLanguage || "vi";
      translateText(message.text, targetLang)
        .then((translatedText) => {
          sendResponse({ translatedText });
        })
        .catch((error) => {
          sendResponse({ error: error.message });
        });
    });
    return true;
  }

  if (message.action === "fetch_images") {
    const crawlerURL = import.meta.env.VITE_CRAWLER_URL;
    const count = message.count ?? 10;
    fetch(`${crawlerURL}images/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: message.query, count }),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ urls: data.urls || [] }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});
