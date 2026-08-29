import { uploadPresigned } from "@vercel/blob/client";

export const MAX_UPLOAD_MB = 1024; // 1 GB
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
// Above this, the SDK splits the upload into parallel parts (needed for big files).
const MULTIPART_THRESHOLD = 20 * 1024 * 1024;

// Formats the transcription provider (Supadata) actually accepts.
export const ACCEPTED_EXTENSIONS = ".mp4,.webm,.mp3,.m4a,.wav,.flac,.ogg,.oga,.mpeg,.mpg";
const SUPPORTED_RE = /\.(mp4|webm|mp3|m4a|wav|flac|ogg|oga|mpe?g)$/i;

const EXT_CONTENT_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
};

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function contentTypeFor(file: File): string {
  return EXT_CONTENT_TYPE[extOf(file.name)] ?? file.type ?? "application/octet-stream";
}

export interface UploadResult {
  url: string;
  contentType: string;
  filename: string;
}

export function validateFile(file: File): string | null {
  const ext = extOf(file.name);
  if (!SUPPORTED_RE.test(file.name)) {
    if (/\.(mov|mkv|avi|wmv|m4v|3gp|ts)$/i.test(file.name)) {
      return `${ext.toUpperCase()} files aren't supported. Convert to MP4, WebM, MP3, M4A or WAV first.`;
    }
    return "Unsupported file. Use MP4, WebM, MP3, M4A, WAV, FLAC or OGG.";
  }
  if (file.size > MAX_BYTES) {
    return `File is ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB — the limit is 1 GB.`;
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
