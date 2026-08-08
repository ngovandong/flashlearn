import { ENV } from "@/config/env";

/**
 * Unsigned Cloudinary upload from a local file URI (e.g. an `expo-image-picker`
 * asset). Mirrors the web app's `cloudinaryService.uploadImage`, adapted for
 * React Native's `FormData` file shape (`{ uri, type, name }` instead of a
 * browser `File`).
 */
export async function uploadImageToCloudinary(uri: string): Promise<string> {
  const { cloudName, uploadPreset } = ENV.cloudinary;
  if (!cloudName || !uploadPreset) {
    throw new Error("Image upload is not configured.");
  }

  const filename = uri.split("/").pop() || "upload.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const data = new FormData();
  data.append("file", { uri, name: filename, type: mimeType } as unknown as Blob);
  data.append("upload_preset", uploadPreset);
  data.append("cloud_name", cloudName);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: data }
  );
  const json = await res.json();
  const url = json.secure_url || json.url;
  if (!url) {
    throw new Error(json.error?.message || "Image upload failed");
  }
  return url;
}
