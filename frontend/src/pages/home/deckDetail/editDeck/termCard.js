import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { COLORS } from "@constants/colors";
import { CustomInput } from "@components/customInput";
import PhotoIcon from "@mui/icons-material/Photo";
import UploadButton from "@components/uploadButton";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { isImageUrl } from "@utils/imageURL";
function TermCard({ index, term, handleTermChange, handleDeleteTerm }) {
  const handleOnEnter = async (url) => {
    try {
      if (isImageUrl(url)) {
        handleTermChange(index, {
          ...term,
          error: term.error === "Not a valid image URL" ? null : term.error,
          open: false,
          image: url,
        });
      } else {
        handleTermChange(index, {
          ...term,
          image: "",
          error: "Not a valid image URL",
        });
      }
    } catch {
      handleTermChange(index, {
        ...term,
        image: "",
        error: "Not a valid image URL",
      });
    }
  };
  const handleOpenImageCard = () => {
    handleTermChange(index, {
      ...term,
      open: !term.open,
    });
  };

  const handleUploadAvatar = (file) => {
    handleTermChange(index, {
      ...term,
      error: term.error === "Not a valid image URL" ? null : term.error,
      image: file,
      open: !term.open,
    });
  };

  return (
    <div className={term.error ? "term-card red-bottom" : "term-card"}>
      <div className="term-toolbar">
        <span className="index">{index + 1}</span>
        <div className="error-session">
          {term.error && (
            <div className="error-message">
              <ErrorOutlineIcon />
              <span>{term.error}</span>
            </div>
          )}
        </div>

        <DeleteOutlineIcon
          onClick={() => handleDeleteTerm(index)}
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
          <CustomInput
            value={term.name}
            setValue={(value) =>
              handleTermChange(index, { ...term, name: value })
            }
            placeholder="Enter term"
            helpText="TERM"
          />
        </div>
        <div className="desc">
          <CustomInput
            value={term.description}
            setValue={(value) =>
              handleTermChange(index, { ...term, description: value })
            }
            placeholder="Enter desc"
            helpText="DESCRIPTION"
          />
        </div>
        <div className="img">
          <div
            className={term.image ? "display-none" : "upload-btn"}
            onClick={handleOpenImageCard}
          >
            <PhotoIcon
              sx={{
                color: COLORS.MINOR_TEXT,
              }}
            />
            <div>IMAGE</div>
          </div>
          {term.image && typeof term.image === "object" && (
            <img
              onClick={handleOpenImageCard}
              src={URL.createObjectURL(term.image)}
              alt={`avatar-${index}`}
              className="avatar-image"
            />
          )}
          {term.image && typeof term.image === "string" && (
            <img
              onClick={handleOpenImageCard}
              src={term.image}
              alt={`avatar-${index}`}
              className="avatar-image"
            />
          )}
        </div>
      </div>
      <div className={term.open ? "term-image" : "display-none"}>
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
