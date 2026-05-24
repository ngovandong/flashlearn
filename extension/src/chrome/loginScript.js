/* eslint-disable no-undef */

/*
 * Content scripts run in an "isolated world" — they share the DOM with
 * the page but have a separate JavaScript execution context.  This means:
 *
 *   1. localStorage accessed here is the *content-script's own* storage,
 *      NOT the web page's localStorage.
 *   2. CustomEvent.detail created by the page is NOT readable from here
 *      (the object lives in the page's JS heap).
 *
 * Solution: inject a script file (not inline) that runs in the PAGE's
 * context, reads localStorage / listens for loginEvent there, and relays
 * the token to this content script via window.postMessage.
 *
 * Using script.src avoids CSP "inline script" violations on strict sites.
 */

function injectPageBridge() {
  if (document.getElementById("flashlearn-page-bridge")) return;

  const script = document.createElement("script");
  script.id = "flashlearn-page-bridge";
  script.src = chrome.runtime.getURL("pageTokenBridge.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

injectPageBridge();

window.addEventListener("message", function (event) {
  if (
    event.source !== window ||
    !event.data ||
    event.data.source !== "flashlearn-page"
  ) {
    return;
  }

  if (event.data.type === "token" && event.data.token) {
    chrome.runtime.sendMessage({
      type: "login",
      token: event.data.token,
    });
  }
});

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (message.type === "getToken") {
    window.postMessage(
      { source: "flashlearn-content", type: "getToken" },
      "*"
    );

    let responded = false;

    function onPageResponse(event) {
      if (
        event.source === window &&
        event.data &&
        event.data.source === "flashlearn-page" &&
        event.data.type === "token" &&
        !responded
      ) {
        responded = true;
        window.removeEventListener("message", onPageResponse);
        sendResponse(event.data.token);
      }
    }

    window.addEventListener("message", onPageResponse);

    setTimeout(function () {
      if (!responded) {
        responded = true;
        window.removeEventListener("message", onPageResponse);
        sendResponse(null);
      }
    }, 500);

    return true;
  }
});
