import { useRef, useState } from "react";

export function CustomInput({
  value,
  setValue,
  placeholder,
  helpText,
  onEnter,
}) {
  const inputEl = useRef(null);
  const handleKeyPress = (event) => {
    if (event.key === "Enter" && onEnter) {
      onEnter(inputEl.current.value);
    }
  };
  return (
    <div className="custom-input">
      {onEnter ? (
        <input
          ref={inputEl}
          placeholder={placeholder}
          onKeyDown={handleKeyPress}
        ></input>
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={handleKeyPress}
        ></input>
      )}
      <span>{helpText}</span>
    </div>
  );
}
export function CustomArea({ value, setValue, placeholder, helpText }) {
  return (
    <div className="custom-input">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      ></textarea>
      <span>{helpText}</span>
    </div>
  );
}
