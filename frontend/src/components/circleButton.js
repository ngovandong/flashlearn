import React from "react";

const CircleButton = ({ children, onClick }) => {
  return (
    <button onClick={onClick} className="circle-btn">
      <span
        style={{
          color: "#586380",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
        }}
      >
        {children}
      </span>
    </button>
  );
};

export default CircleButton;
