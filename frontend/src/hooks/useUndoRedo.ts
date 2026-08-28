import { useCallback, useMemo, useState } from "react";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setHistory((h) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(h.present) : next;
      if (Object.is(resolved, h.present)) return h;
      return { past: [...h.past, h.present], present: resolved, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  const reset = useCallback((value: T) => {
    setHistory({ past: [], present: value, future: [] });
  }, []);

  return useMemo(
    () => ({
      state: history.present,
      set,
      undo,
      redo,
      reset,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history, set, undo, redo, reset],
  );
}
