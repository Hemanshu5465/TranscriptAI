import { describe, expect, it } from "vitest";
import { buildTranscriptString, segmentText } from "../lib/transcriptText";
import type { SegmentOut } from "../lib/types";

const seg = (over: Partial<SegmentOut>): SegmentOut => ({
  id: "s1",
  order_index: 0,
  speaker: null,
  start_time: 1,
  end_time: 4,
  text: "Hello there.",
  raw_text: "hello there",
  edited_text: null,
  confidence: null,
  words: [],
  ...over,
});

describe("segmentText", () => {
  it("returns raw text for raw variant", () => {
    expect(segmentText(seg({}), "raw", {})).toBe("hello there");
  });
  it("prefers local edit for edited variant", () => {
    expect(segmentText(seg({}), "edited", { 0: "EDITED" })).toBe("EDITED");
  });
  it("falls back to clean text", () => {
    expect(segmentText(seg({}), "clean", {})).toBe("Hello there.");
  });
  it("uses the saved edited_text for the edited variant when there is no local edit", () => {
    expect(segmentText(seg({ edited_text: "SAVED EDIT" }), "edited", {})).toBe("SAVED EDIT");
  });
  it("local edit still wins over saved edited_text", () => {
    expect(segmentText(seg({ edited_text: "SAVED EDIT" }), "edited", { 0: "LIVE" })).toBe("LIVE");
  });
});

describe("buildTranscriptString", () => {
  const segments = [
    { order_index: 0, speaker: null, start_time: 1, end_time: 4, text: "Hello there." },
    { order_index: 1, speaker: "Speaker 1", start_time: 65, end_time: 70, text: "Second line." },
  ];

  it("includes timestamps when asked", () => {
    const out = buildTranscriptString(segments, { timestamps: true });
    expect(out).toContain("[00:00:01]");
    expect(out).toContain("[00:01:05] Speaker 1:");
  });

  it("omits timestamps but keeps speaker prefix", () => {
    const out = buildTranscriptString(segments, { timestamps: false });
    expect(out).toBe("Hello there.\n\nSpeaker 1: Second line.");
  });
});
