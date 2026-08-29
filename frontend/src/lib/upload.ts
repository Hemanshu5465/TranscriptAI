import { uploadPresigned } from "@vercel/blob/client";

export const MAX_UPLOAD_MB = 1024; // 1 GB
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
// Above this, the SDK splits the upload into parallel parts (needed for big files).
const MULTIPART_THRESHOLD = 20 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS =
  ".mp4,.webm,.mov,.mkv,.mpeg,.mpg,.mp3,.m4a,.wav,.flac,.ogg,.aac";

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska",
  mpeg: "video/mpeg", mpg: "video/mpeg",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", flac: "audio/flac",
  ogg: "audio/ogg", aac: "audio/aac",
};

function contentTypeFor(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

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
    const gb = (file.size / 1024 / 1024 / 1024).toFixed(2);
    return `File is ${gb} GB — the limit is 1 GB.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

export function humanSize(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    : `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** Uploads directly from the browser to Vercel Blob; returns its public URL. */
export async function uploadTranscriptFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const err = validateFile(file);
  if (err) throw new Error(err);

  const contentType = contentTypeFor(file);
  const blob = await uploadPresigned(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob",
    contentType,
    multipart: file.size > MULTIPART_THRESHOLD,
    onUploadProgress: onProgress
      ? ({ percentage }) => onProgress(Math.round(percentage))
      : undefined,
  });

  return {
    url: blob.url,
    contentType: blob.contentType || contentType,
    filename: file.name,
  };
}
