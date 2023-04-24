import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
const Answer = ({
  option,
  letter,
  handleAnswerClick,
  selectedAnswer,
  correctAnswer,
}) => {
  const handleClick = () => {
    handleAnswerClick(letter);
  };

  const isSelected = selectedAnswer !== "";
  let styleClass = "";
  if (isSelected && selectedAnswer === letter) styleClass = " incorrect";
  if (isSelected && correctAnswer === letter) styleClass = " correct";

  let icon = null;

  if (isSelected) {
    if (correctAnswer === letter) {
      icon = <CheckIcon className="icon" style={{ color: "#59e8b5" }} />;
    } else if (selectedAnswer === letter) {
      icon = <CloseIcon className="icon" style={{ color: "#ff7873" }} />;
    }
  }

  return (
    <div
      className={`answer${styleClass}${isSelected ? " selected" : ""}`}
      onClick={handleClick}
    >
      <div className="option">
        {letter}. {option}
      </div>
      {icon}
    </div>
  );
};

export default Answer;
