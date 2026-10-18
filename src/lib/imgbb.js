const IMGBB_API_KEY = "624485cf7270b4096fa9300572896760";
const IMGBB_UPLOAD_ENDPOINT = "https://api.imgbb.com/1/upload";

/**
 * Uploads an image file to ImgBB and resolves with the public display URL.
 *
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The hosted image URL.
 */
export async function uploadToImgbb(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(
    `${IMGBB_UPLOAD_ENDPOINT}?key=${encodeURIComponent(IMGBB_API_KEY)}`,
    {
      method: "POST",
      body: formData,
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.error?.message ||
        "ImgBB upload failed — check the API key in src/lib/imgbb.js.",
    );
  }

  return payload.data.display_url || payload.data.url;
}
