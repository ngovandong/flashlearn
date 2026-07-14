import React from "react";

const CircleButton = ({
  children,
  onClick,
  disabled = false,
  size = 40,
  active = false,
  title,
}) => {
  return (
    <button
      onClick={onClick}
      className={`circle-btn${active ? " active" : ""}`}
      title={title}
      style={{ height: `${size}px`, width: `${size}px` }}
      disabled={disabled}
    >
      <span
        style={{
          color: active ? "var(--fl-primary)" : "#586380",
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
