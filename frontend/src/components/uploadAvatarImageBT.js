import React from "react";
import UploadButton from "./uploadButton";

function UploadAvatarButton({ selectedFile, setSelectedFile }) {
  const is_url = typeof selectedFile === "string";
  return (
    <div className="upload-card">
      <UploadButton
        text="UPLOAD IMAGE"
        setFile={setSelectedFile}
        id="set-avatar"
      />
      {is_url ? (
        <img src={selectedFile} alt="placeholder" className="selected-image" />
      ) : selectedFile ? (
        <img
          src={URL.createObjectURL(selectedFile)}
          alt="selected"
          className="selected-image"
        />
      ) : (
        <img
          src="imgs/placeholder.png"
          alt="placeholder"
          className="selected-image"
        />
      )}
    </div>
  );
}

export default UploadAvatarButton;
