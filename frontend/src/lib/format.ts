export function hhmmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function hhmmssFull(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function humanDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function compactNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  return n.toLocaleString("en-US");
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  gu: "Gujarati",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
};

export function languageName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  const base = code.split("-")[0].toLowerCase();
  return LANGUAGE_NAMES[base] ?? code.toUpperCase();
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
