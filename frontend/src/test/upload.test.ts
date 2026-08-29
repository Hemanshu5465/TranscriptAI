import { describe, expect, it } from "vitest";
import { validateFile, MAX_UPLOAD_MB } from "../lib/upload";

function fakeFile(name: string, type: string, sizeMB: number): File {
  const blob = new Blob([new Uint8Array(1)], { type });
  const f = new File([blob], name, { type });
  Object.defineProperty(f, "size", { value: Math.round(sizeMB * 1024 * 1024) });
  return f;
}

describe("validateFile", () => {
  it("accepts a normal video", () => {
    expect(validateFile(fakeFile("clip.mp4", "video/mp4", 12))).toBeNull();
  });

  it("accepts audio", () => {
    expect(validateFile(fakeFile("talk.mp3", "audio/mpeg", 3))).toBeNull();
  });

  it("accepts by extension when the browser gives no MIME type", () => {
    expect(validateFile(fakeFile("recording.m4a", "", 2))).toBeNull();
  });

  it("rejects a non-media file", () => {
    expect(validateFile(fakeFile("notes.pdf", "application/pdf", 1))).toMatch(/video or audio/i);
  });

  it(`rejects files over ${MAX_UPLOAD_MB} MB`, () => {
    expect(validateFile(fakeFile("big.mp4", "video/mp4", MAX_UPLOAD_MB + 5))).toMatch(/limit/i);
  });

  it("rejects empty files", () => {
    expect(validateFile(fakeFile("empty.mp4", "video/mp4", 0))).toMatch(/empty/i);
  });
});
