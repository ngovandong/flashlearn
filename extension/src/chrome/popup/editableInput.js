import React, { useEffect, useState } from "react";
import styled from "styled-components";

const InputContainer = styled.div`
  position: relative;
`;

const TextArea = styled.textarea`
  border: none !important;
  outline: none !important;
  padding: 4px !important;
  background-color: transparent !important;
  font-size: 16px !important;
  color: #333 !important;
  box-shadow: none !important;
  &:focus {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  overflow-y: hidden;
  resize: none;
`;

const EditIcon = styled.img`
  width: 16px;
  height: 16px;
  cursor: pointer;
  position: absolute;
  right: 8px;
  top: 4px;
  filter: invert(28%) sepia(99%) saturate(4552%) hue-rotate(237deg)
    brightness(102%) contrast(86%);
`;
/*global chrome*/
const editURL = chrome.runtime.getURL("images/edit.png");
const EditableInput = ({ value, setValue }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleEditClick = () => {
    setIsEditing(true);
    document.getElementById("meaning-input").focus();
  };

  const handleInputChange = (e) => {
    setValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
  };

  useEffect(() => {
    if (value) {
      const textarea = document.getElementById("meaning-input");
      textarea.style.height = "auto"; // Reset the height to auto

      // Calculate the scroll height of the content
      const scrollHeight = textarea.scrollHeight;

      // Set the textarea height to the calculated scroll height
      textarea.style.height = scrollHeight + "px";
    }
  }, [value]);

  return (
    <InputContainer>
      <TextArea
        type="text"
        value={value}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        id="meaning-input"
      />
      {!isEditing && (
        <EditIcon onClick={handleEditClick} src={editURL} alt="Edit" />
      )}
    </InputContainer>
  );
};

export default EditableInput;
