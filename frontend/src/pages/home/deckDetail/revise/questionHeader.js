import { IconButton } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
function QuestionHeader({ question, speakTerm, image }) {
  return (
    <div className="question-container">
      <div className="question-header">
        <div className="speaker">
          <IconButton component="label" onClick={speakTerm}>
            <VolumeUpIcon />
          </IconButton>
        </div>
        <div className="question"> {question}</div>
      </div>
      {image && <img src={image} alt="" />}
    </div>
  );
}

export default QuestionHeader;
