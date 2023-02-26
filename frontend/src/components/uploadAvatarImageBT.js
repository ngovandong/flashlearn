import React, { useState } from "react";
import UploadButton from "./uploadButton";

function UploadAvatarButton() {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="upload-card">
      <UploadButton
        text="UPLOAD IMAGE"
        setFile={setSelectedFile}
        id="set-avatar"
      />
      {selectedFile ? (
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
