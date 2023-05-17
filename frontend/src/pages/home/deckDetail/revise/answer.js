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
    handleAnswerClick(option);
  };

  const isSelected = selectedAnswer !== "";
  let styleClass = "";
  if (isSelected && selectedAnswer === option) styleClass = " incorrect";
  if (isSelected && correctAnswer === option) styleClass = " correct";

  let icon = null;

  if (isSelected) {
    if (correctAnswer === option) {
      icon = <CheckIcon className="icon" style={{ color: "#59e8b5" }} />;
    } else if (selectedAnswer === option) {
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
