import { useMemo } from "react";

export interface SearchMatch {
  segmentIndex: number;
  segmentId: string;
  start: number;
  offset: number;
  length: number;
  snippet: string;
}

interface Searchable {
  id: string;
  order_index: number;
  start_time: number;
  text: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function useTranscriptSearch(segments: Searchable[], query: string) {
  return useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return { matches: [] as SearchMatch[], total: 0 };

    const re = new RegExp(escapeRegExp(q), "gi");
    const matches: SearchMatch[] = [];

    for (const seg of segments) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(seg.text)) !== null) {
        const start = Math.max(0, m.index - 32);
        const end = Math.min(seg.text.length, m.index + m[0].length + 32);
        matches.push({
          segmentIndex: seg.order_index,
          segmentId: seg.id,
          start: seg.start_time,
          offset: m.index,
          length: m[0].length,
          snippet:
            (start > 0 ? "…" : "") +
            seg.text.slice(start, end) +
            (end < seg.text.length ? "…" : ""),
        });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    return { matches, total: matches.length };
  }, [segments, query]);
}

export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (q.length < 2) return [{ text, hit: false }];
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  return text
    .split(re)
    .filter((p) => p !== "")
    .map((part) => ({ text: part, hit: part.toLowerCase() === q.toLowerCase() }));
}
