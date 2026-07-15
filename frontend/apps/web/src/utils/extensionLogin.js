export const sendTokenToExtension = (token) => {
  const loginEvent = new CustomEvent("loginEvent", {
    bubbles: true,
    detail: { token },
  });
  window.dispatchEvent(loginEvent);
};
