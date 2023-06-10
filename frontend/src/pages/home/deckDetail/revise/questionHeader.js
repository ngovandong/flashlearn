import { IconButton } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useEffect, useState } from "react";
import { learningService } from "@api-services/learningService";
import { toast } from "react-toastify";
import { getFirstError } from "@utils/errorHandler";
function QuestionHeader({ id, question, speakTerm, image, setIsLoading }) {
  const [isRemember, setIsRemember] = useState(false);
  const handleCheckClick = async () => {
    try {
      const res = await learningService.remember(id);
      if (!res.error) {
        setIsRemember((pre) => !pre);
      } else {
        toast.error(getFirstError(res.error));
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    if (image) {
      const img = new Image();
      img.onload = () => setIsLoading(true);
      img.src = image;
    }
  }, [image]);
  return (
    <div className="question-container">
      <div className="question-header">
        <div className="speaker">
          <IconButton component="label" onClick={speakTerm}>
            <VolumeUpIcon />
          </IconButton>
        </div>
        <div className="question"> {question}</div>
        <div className="speaker">
          <IconButton component="label" onClick={handleCheckClick}>
            <CheckCircleOutlineIcon color={isRemember ? "blue" : ""} />
          </IconButton>
        </div>
      </div>
      {image && <img src={image} alt="" />}
    </div>
  );
}

export default QuestionHeader;
