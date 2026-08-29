import { upload } from "@vercel/blob/client";

export const MAX_UPLOAD_MB = 50;
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const ACCEPTED_EXTENSIONS =
  ".mp4,.webm,.mov,.mkv,.mpeg,.mpg,.mp3,.m4a,.wav,.flac,.ogg,.aac";

export interface UploadResult {
  url: string;
  contentType: string;
  filename: string;
}

export function validateFile(file: File): string | null {
  const isMedia =
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/") ||
    /\.(mp4|webm|mov|mkv|mpe?g|mp3|m4a|wav|flac|ogg|aac)$/i.test(file.name);
  if (!isMedia) return "That doesn't look like a video or audio file.";
  if (file.size > MAX_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${MAX_UPLOAD_MB} MB.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** Uploads directly from the browser to Vercel Blob; returns its public URL. */
export async function uploadTranscriptFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const err = validateFile(file);
  if (err) throw new Error(err);

  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob",
    contentType: file.type || undefined,
    onUploadProgress: onProgress
      ? ({ percentage }) => onProgress(Math.round(percentage))
      : undefined,
  });

  return {
    url: blob.url,
    contentType: blob.contentType || file.type || "application/octet-stream",
    filename: file.name,
  };
}
