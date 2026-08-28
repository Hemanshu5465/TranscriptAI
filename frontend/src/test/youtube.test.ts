import { describe, expect, it } from "vitest";
import { extractVideoId, isValidYouTubeUrl } from "../lib/youtube";

describe("extractVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1s", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("parses %s", (input, expected) => {
    expect(extractVideoId(input)).toBe(expected);
  });

  it.each([
    "",
    "  ",
    "not a link",
    "https://vimeo.com/12345",
    "https://www.youtube.com/watch?v=",
    "https://youtu.be/",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=tooShort",
  ])("rejects %s", (input) => {
    expect(extractVideoId(input)).toBeNull();
    expect(isValidYouTubeUrl(input)).toBe(false);
  });
});
