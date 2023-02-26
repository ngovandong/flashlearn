import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Button } from "@mui/material";

function UploadButton({ id, setFile, text }) {
  const handleFileInput = (event) => {
    setFile(event.target.files[0]);
  };
  return (
    <div className="upload-button">
      <input type="file" accept="image/*" id={id} onChange={handleFileInput} />
      <label htmlFor={id}>
        <Button
          variant="contained"
          color="blue"
          component="span"
          startIcon={<CloudUploadIcon />}
        >
          <span className="button-text">{text}</span>
        </Button>
      </label>
    </div>
  );
}

export default UploadButton;
