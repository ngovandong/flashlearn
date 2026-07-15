import React from "react";
import { createRoot } from "react-dom/client";
import TranslationPopup from "./popup";
import FlashIcon from "./popup/flashIcon";
import { createRequest } from "../api-service/httpRequest";

let activeRoot = null;
let activeContainer = null;
let resizeCleanup = null;

const isMouseInPopup = (event, popup) => {
  const firstChildElement = popup.firstElementChild;
  if (!firstChildElement) return false;
  const rect = firstChildElement.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const width = firstChildElement.offsetWidth;
  const height = firstChildElement.offsetHeight;

  return x >= 0 && x <= width && y >= 0 && y <= height;
};

const closePopup = (event) => {
  if (resizeCleanup) {
    resizeCleanup();
    resizeCleanup = null;
  }

  if (activeContainer && (!event || !isMouseInPopup(event, activeContainer))) {
    if (activeRoot) {
      activeRoot.unmount();
      activeRoot = null;
    }
    activeContainer.remove();
    activeContainer = null;
  }
};

function openIcon(apiRequest, left, top, term) {
  const handleCloseClick = () => {
    closePopup();
  };

  const handleIconClick = () => {
    if (activeRoot) {
      activeRoot.render(
        <TranslationPopup
          term={term}
          request={apiRequest}
          left={left}
          top={top}
          onClose={handleCloseClick}
        />
      );
    }
  };

  activeContainer = document.createElement("span");
  activeContainer.id = "flashlearn";
  document.body.appendChild(activeContainer);

  activeRoot = createRoot(activeContainer);
  activeRoot.render(
    <FlashIcon left={left} top={top} handleClick={handleIconClick} />
  );

  setTimeout(() => {
    const img = document.getElementById("flashlearn-icon");
    if (img) {
      const originalWidth = img.offsetWidth || 24;

      const adjustImageSize = () => {
        const zoomLevel = window.devicePixelRatio || 1;
        img.style.width = `${originalWidth / zoomLevel}px`;
      };

      window.addEventListener("resize", adjustImageSize);
      resizeCleanup = () =>
        window.removeEventListener("resize", adjustImageSize);
      adjustImageSize();
    }
  }, 50);
}

document.addEventListener("mouseup", function (event) {
  if (
    event.target.tagName === "INPUT" ||
    event.target.tagName === "TEXTAREA" ||
    event.target.isContentEditable
  ) {
    return;
  }

  const selectionText = document.getSelection().toString().trim();
  const popupContainer = document.getElementById("flashlearn");
  if (event.button === 0 && selectionText && !popupContainer) {
    // eslint-disable-next-line no-undef
    chrome.runtime.sendMessage({ type: "is_logged_in" }, function (response) {
      if (!response?.token) return;

      const selection = window.getSelection();
      const term = selection.toString().trim();
      if (!term) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const top = rect.top + window.scrollY + 5;
      const left = rect.right + window.scrollX + 3;

      const apiRequest = createRequest(response.token, {
        onTokenRefresh: (token) => {
          if (token) {
            // eslint-disable-next-line no-undef
            chrome.runtime.sendMessage({ type: "login", token });
          }
        },
      });

      openIcon(apiRequest, left, top, term);
    });
  }
});

document.addEventListener("mouseup", function (event) {
  const selectionText = document.getSelection().toString().trim();
  if (event.button === 0 && !selectionText) {
    closePopup(event);
  }
});
