import { IconButton } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowCircleUpIcon from "@mui/icons-material/ArrowCircleUp";
import ArrowCircleDownIcon from "@mui/icons-material/ArrowCircleDown";
import { useEffect, useRef, useState } from "react";
import { learningService } from "@api-services/learningService";
import { toast } from "react-toastify";
import { getFirstError } from "@utils/errorHandler";
import { green, yellow } from "@mui/material/colors";

// Add this CSS to your stylesheet
const styles = `
@keyframes successPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.success-animate {
  animation: successPulse 0.5s ease-in-out;
}
`;

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
  const [animatingIcon, setAnimatingIcon] = useState(null);

  const changePriority = async (priority) => {
    try {
      const res = await learningService.changePriority(id, priority);
      if (!res.error) {
        // Trigger animation for the clicked icon
        setAnimatingIcon(priority > 0 ? "up" : "down");
        setTimeout(() => setAnimatingIcon(null), 500); // Reset after animation
      } else {
        toast.error(getFirstError(res.error));
      }
    } catch (error) {
      console.log(error);
    }
  };

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
  }, [image, setIsLoading]);
  return (
    <>
      <style>{styles}</style>
      <div className="question-container">
        <div className="question-header">
          <div className="header-button">
            <IconButton
              component="label"
              onDoubleClick={openYouglish}
              onClick={delayClick}
            >
              <VolumeUpIcon />
            </IconButton>
          </div>
          <div className="question"> {question}</div>
          <div className="util-bar">
            <div className="header-button">
              <IconButton
                component="label"
                onClick={() => changePriority(-10)}
                className={animatingIcon === "down" ? "success-animate" : ""}
              >
                <ArrowCircleDownIcon sx={{ color: yellow[900] }} />
              </IconButton>
            </div>
            <div className="header-button">
              <IconButton
                component="label"
                onClick={() => changePriority(+10)}
                className={animatingIcon === "up" ? "success-animate" : ""}
              >
                <ArrowCircleUpIcon sx={{ color: green[400] }} />
              </IconButton>
            </div>
            <div className="header-button">
              <IconButton component="label" onClick={handleCheckClick}>
                <CheckCircleOutlineIcon color={isRemember ? "blue" : ""} />
              </IconButton>
            </div>
          </div>
        </div>
        {image && <img src={image} alt="" />}
      </div>
    </>
  );
}

export default QuestionHeader;
