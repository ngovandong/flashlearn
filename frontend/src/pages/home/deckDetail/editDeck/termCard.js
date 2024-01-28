import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { COLORS } from "@constants/colors";
import { CustomInput } from "@components/customInput";
import PhotoIcon from "@mui/icons-material/Photo";
import UploadButton from "@components/uploadButton";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useEffect, useState } from "react";
import { getImagesURL, translateEnToVI } from "@api-services/crawlerService";
function TermCard({ index, term, handleTermChange, handleDeleteTerm }) {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const handleOnEnter = async (url) => {
    handleTermChange(index, {
      ...term,
      open: false,
      image: url,
    });
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

  const fetchImages = async () => {
    if (!isLoading) {
      try {
        setIsLoading(true);
        const res = await getImagesURL(term.name);
        setImages(res.data.urls);
      } catch (error) {
        setImages([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const translateTerms = async () => {
    if (term.name && !term.id) {
      try {
        const res = await translateEnToVI(term.name);
        handleTermChange(index, {
          ...{
            ...term,
            description: res.data,
          },
        });
      } catch (error) {}
    }
  };

  useEffect(() => {
    if (term.open && term.name !== "") {
      const debounceTimer = setTimeout(fetchImages, 800); // 800ms delay before calling the filter function

      return () => {
        clearTimeout(debounceTimer);
      };
    }
  }, [term.name, term.open]);

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
            translateTerm={translateTerms}
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
        {/* <div className="image-url">
          <CustomInput
            onEnter={handleOnEnter}
            placeholder="Enter image url"
            helpText="URL"
          />
        </div> */}
        <div className="google-photos">
          {isLoading && (
            <img
              className="loading-image"
              src="/imgs/loading.png"
              alt="Loading..."
            />
          )}
          {!isLoading &&
            images.map((i, key) => (
              <img
                onClick={() => handleOnEnter(i)}
                className={`google-image`}
                src={i}
                key={key}
                alt=""
              />
            ))}
        </div>
        <div className="local-upload">
          <UploadButton
            text="upload your local image"
            font
            id={`avatar-${index}`}
            setFile={handleUploadAvatar}
          />
        </div>
      </div>
    </div>
  );
}

export default TermCard;
