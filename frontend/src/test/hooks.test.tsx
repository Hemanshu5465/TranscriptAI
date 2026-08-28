import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useTranscriptSearch } from "../hooks/useTranscriptSearch";

describe("useUndoRedo", () => {
  it("tracks history and steps back and forward", () => {
    const { result } = renderHook(() => useUndoRedo({ a: "1" }));

    act(() => result.current.set({ a: "2" }));
    act(() => result.current.set({ a: "3" }));
    expect(result.current.state.a).toBe("3");
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state.a).toBe("2");

    act(() => result.current.redo());
    expect(result.current.state.a).toBe("3");
    expect(result.current.canRedo).toBe(false);
  });
});

describe("useTranscriptSearch", () => {
  const segments = [
    { id: "a", order_index: 0, start_time: 0, text: "Artificial intelligence is powerful." },
    { id: "b", order_index: 1, start_time: 10, text: "The future of artificial intelligence." },
    { id: "c", order_index: 2, start_time: 20, text: "Nothing relevant here." },
  ];

  it("finds case-insensitive matches with counts", () => {
    const { result } = renderHook(() => useTranscriptSearch(segments, "artificial intelligence"));
    expect(result.current.total).toBe(2);
    expect(result.current.matches[0].segmentIndex).toBe(0);
  });

  it("ignores queries shorter than 2 chars", () => {
    const { result } = renderHook(() => useTranscriptSearch(segments, "a"));
    expect(result.current.total).toBe(0);
  });
});
