import React from "react";

const CircleButton = ({ children, onClick, disabled = false, size = 40 }) => {
  return (
    <button
      onClick={onClick}
      className="circle-btn"
      style={{ height: `${size}px`, width: `${size}px` }}
      disabled={disabled}
    >
      <span
        style={{
          color: "#586380",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </span>
    </button>
  );
};

export default CircleButton;
