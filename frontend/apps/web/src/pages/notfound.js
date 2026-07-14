import React from "react";

const NotFound = () => {
  return (
    <div className="error-container">
      <div className="error-text">
        <h1>404</h1>
        <h2>Oops! Page not found</h2>
        <p>We're sorry, the page you're looking for cannot be found.</p>
        <a href="/">Return to home</a>
      </div>
      <div className="error-image">
      </div>
    </div>
  );
};

export default NotFound;
