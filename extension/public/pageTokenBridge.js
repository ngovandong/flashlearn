(function () {
  if (window.__flashlearnPageBridgeLoaded) return;
  window.__flashlearnPageBridgeLoaded = true;

  function relayToken(token) {
    window.postMessage(
      { source: "flashlearn-page", type: "token", token: token },
      "*"
    );
  }

  try {
    var stored = JSON.parse(localStorage.getItem("token"));
    if (stored) relayToken(stored);
  } catch (e) {}

  window.addEventListener("loginEvent", function (event) {
    if (event.detail && event.detail.token) {
      relayToken(event.detail.token);
    }
  });

  window.addEventListener("message", function (event) {
    if (
      event.source === window &&
      event.data &&
      event.data.source === "flashlearn-content" &&
      event.data.type === "getToken"
    ) {
      try {
        var token = JSON.parse(localStorage.getItem("token"));
        relayToken(token);
      } catch (e) {}
    }
  });
})();
