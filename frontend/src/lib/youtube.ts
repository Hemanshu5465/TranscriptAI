/**
 * Client-side YouTube URL validation — mirrors
 * `backend/app/utils/youtube_url.py`. Keep the two in sync.
 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const PATH_PREFIXES = new Set(["embed", "shorts", "live", "v"]);

export function extractVideoId(raw: string): string | null {
  const candidate = raw.trim();
  if (!candidate) return null;
  if (VIDEO_ID_RE.test(candidate)) return candidate;

  let url: URL;
  try {
    url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    return validate(url.pathname.replace(/^\//, "").split("/")[0]);
  }
  if (url.pathname === "/watch") {
    return validate(url.searchParams.get("v") ?? "");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && PATH_PREFIXES.has(parts[0])) {
    return validate(parts[1]);
  }
  return null;
}

function validate(id: string): string | null {
  const trimmed = id.trim();
  return VIDEO_ID_RE.test(trimmed) ? trimmed : null;
}

export function isValidYouTubeUrl(raw: string): boolean {
  return extractVideoId(raw) !== null;
}

export function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
