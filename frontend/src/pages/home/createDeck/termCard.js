import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { COLORS } from "@constants/colors";
import { CustomArea, CustomInput } from "@components/customInput";
import PhotoIcon from "@mui/icons-material/Photo";
import { useState } from "react";
import UploadButton from "@components/uploadButton";
function TermCard({ index }) {
  const [termState, setTermState] = useState({
    open: false,
    file: null,
    url: null,
  });
  const handleOnEnter = (url) => {
    setTermState({
      url,
      file: null,
      open: false,
    });
  };
  const handleOpenImageCard = () => {
    setTermState((pre) => ({
      ...pre,
      open: !pre.open,
    }));
  };

  const handleUploadAvatar = (file) => {
    setTermState({
      file,
      url: null,
      open: false,
    });
  };
  return (
    <div className="term-card">
      <div className="term-toolbar">
        <span className="index">{index}</span>
        <div className="toolbar"></div>
        <div className="toolbar"></div>

        <DeleteOutlineIcon
          sx={{
            color: COLORS.GRAY_TEXT,
            marginRight: "0.5rem",
            "&:hover": {
              color: COLORS.ERROR_RED,
            },
          }}
        />
        <DragIndicatorIcon
          sx={{
            color: COLORS.GRAY_TEXT,
            marginRight: "0.5rem",
            cursor: "move",
            "&:hover": {
              color: COLORS.YELLOW,
            },
          }}
        />
      </div>
      <div className="term-content">
        <div className="term">
          <CustomInput placeholder="Enter term" helpText="TERM" />
        </div>
        <div className="desc">
          <CustomArea placeholder="Enter term" helpText="DESCRIPTION" />
        </div>
        <div className="img">
          <div
            className={
              termState.file || termState.url ? "display-none" : "upload-btn"
            }
            onClick={handleOpenImageCard}
          >
            <PhotoIcon
              sx={{
                color: COLORS.MINOR_TEXT,
                "&:hover": {
                  color: COLORS.YELLOW,
                },
              }}
            />
            <div>IMAGE</div>
          </div>
          {termState.file && (
            <img
              onClick={handleOpenImageCard}
              src={URL.createObjectURL(termState.file)}
              alt={`avatar-${index}`}
              className="avatar-image"
            />
          )}
          {termState.url && (
            <img
              onClick={handleOpenImageCard}
              src={termState.url}
              alt={`avatar-${index}`}
              className="avatar-image"
            />
          )}
        </div>
      </div>
      <div className={termState.open ? "term-image" : "display-none"}>
        <div className="image-url">
          <CustomInput
            onEnter={handleOnEnter}
            placeholder="Enter image url"
            helpText="URL"
          />
        </div>
        <div className="local-upload">
          <UploadButton
            text="Or upload your local image"
            id={`avatar-${index}`}
            setFile={handleUploadAvatar}
          />
        </div>
      </div>
    </div>
  );
}

export default TermCard;
