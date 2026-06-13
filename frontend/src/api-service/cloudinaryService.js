const cloudName = process.env.REACT_APP_CLOUD_NAME;
const uploadPreset = process.env.REACT_APP_UPLOAD_PRESET;

const uploadImage = (file) => {
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", uploadPreset);
  data.append("cloud_name", cloudName);
  return fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "post",
    body: data,
  })
    .then((resp) => resp.json())
    .then((data) => {
      if (!data.url) {
        throw new Error(data.error?.message || "Image upload failed");
      }
      return data.url;
    });
};

const cloudinaryService = { uploadImage };

export default cloudinaryService;
