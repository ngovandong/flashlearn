import React from "react";
import { Link } from "react-router-dom";

function PermissionDenied() {
  return (
    <div className="permissiondenied-container">
      <h1 className="permissiondenied-heading">Oops!</h1>
      <p className="permissiondenied-message">
        You do not have permission to access this page.
      </p>
      <Link to="/" className={`permissiondenied-button`}>
        Go Back Home
      </Link>
    </div>
  );
}

export default PermissionDenied;
