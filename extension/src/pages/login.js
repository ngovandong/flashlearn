import React from "react";

function LoginPage() {
  const handleClick = () => {
    // eslint-disable-next-line no-undef
    chrome.runtime.sendMessage({
      type: "get_auth_token",
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-container">
          <img src="images/icon-128.png" className="login-logo" alt="Flashlearn Logo" />
        </div>
        <h1 className="login-title">Flashlearn</h1>
        <p className="login-subtitle">
          Create flashcards and study vocabulary seamlessly while browsing the web.
        </p>
        
        <button className="login-button" onClick={handleClick}>
          Connect Account
        </button>
        
        <div className="login-footer">
          Opens Flashlearn web dashboard to authenticate
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

