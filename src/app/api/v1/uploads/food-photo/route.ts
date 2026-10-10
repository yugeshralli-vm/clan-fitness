import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api-response";

// Vercel Function request bodies cap at 4.5MB; the app resizes and compresses photos (like the
// web's compressImage, 1600px JPEG) well under this before uploading.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/v1/uploads/food-photo (multipart, field `file`) — stores one food photo in Vercel Blob
 * and returns its `url`, which the app then sends in POST /api/v1/logs `photoUrls`. Server-side
 * counterpart of the web's client-direct upload (src/app/api/check-ins/upload), same `check-ins/`
 * folder and random suffix.
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return apiError(400, "file is required.");
  if (!file.type.startsWith("image/")) return apiError(400, "Only images can be uploaded.");
  if (file.size > MAX_BYTES) return apiError(413, "Photo is too large.");

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`check-ins/food.${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return NextResponse.json({ url: blob.url });
}
