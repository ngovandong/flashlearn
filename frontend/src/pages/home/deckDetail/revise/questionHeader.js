import { IconButton } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useEffect, useRef, useState } from "react";
import { learningService } from "@api-services/learningService";
import { toast } from "react-toastify";
import { getFirstError } from "@utils/errorHandler";
function QuestionHeader({
  id,
  name,
  question,
  speakTerm,
  image,
  setIsLoading,
}) {
  const [isRemember, setIsRemember] = useState(false);
  const clickTimer = useRef(null);
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

  const delayClick = () => {
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      speakTerm();
    }, 200);
  };

  const openYouglish = () => {
    const encodedPhrase = encodeURIComponent(name);
    const youglish =
      "https://youglish.com/pronounce/" + encodedPhrase + "/english";
    window.open(youglish, "_blank");
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
          <IconButton
            component="label"
            onDoubleClick={openYouglish}
            onClick={delayClick}
          >
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
