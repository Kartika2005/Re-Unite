import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfig() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export async function uploadImage(
  fileBuffer: Buffer,
  folder = "reunite"
): Promise<string> {
  ensureConfig();
  const b64 = `data:image/png;base64,${fileBuffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(b64, {
    folder,
    resource_type: "image",
  });
  return result.secure_url;
}

export default cloudinary;
