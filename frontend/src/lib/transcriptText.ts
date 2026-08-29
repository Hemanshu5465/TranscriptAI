import { hhmmssFull } from "./format";
import type { SegmentOut } from "./types";

export interface DisplaySegment {
  order_index: number;
  speaker: string | null;
  start_time: number;
  end_time: number;
  text: string;
}

export type TextVariant = "raw" | "clean" | "edited";

/** Resolve the text to show for a segment given the active variant + local edits. */
export function segmentText(
  seg: SegmentOut,
  variant: TextVariant,
  edits: Record<number, string>,
): string {
  if (variant === "edited") {
    if (edits[seg.order_index] !== undefined) return edits[seg.order_index];
    if (seg.edited_text != null) return seg.edited_text;
  }
  if (variant === "raw") return seg.raw_text ?? seg.text;
  return seg.text;
}

export function buildTranscriptString(
  segments: DisplaySegment[],
  opts: { timestamps: boolean },
): string {
  if (!opts.timestamps) {
    return segments
      .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
      .join("\n\n")
      .trim();
  }
  return segments
    .map((s) => {
      const head = `[${hhmmssFull(s.start_time)}]` + (s.speaker ? ` ${s.speaker}:` : "");
      return `${head}\n${s.text}`;
    })
    .join("\n\n")
    .trim();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
