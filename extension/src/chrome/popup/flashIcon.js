import React from "react";
import styled from "styled-components";

/*global chrome*/
const imageUrl = chrome.runtime.getURL("images/icon-48.png");

const IconContainer = styled.div`
  position: absolute;
  width: 24px;
  height: 24px;
  left: ${(props) => props.left + 10}px;
  top: ${(props) => props.top + 20}px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 2147483647;
`;

function FlashIcon({ left, handleClick, top }) {
  return (
    <IconContainer top={top} left={left} onClick={handleClick}>
      <img id="flashlearn-icon" src={imageUrl} alt="flashlearn" />
    </IconContainer>
  );
}

export default FlashIcon;
