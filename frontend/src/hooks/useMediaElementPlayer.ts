import { useCallback, useEffect, useRef, useState } from "react";

/** Wraps a native <video>/<audio> element with the same shape as useYouTubePlayer. */
export function useMediaElementPlayer() {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onReady = () => setReady(true);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onReady);
    el.addEventListener("canplay", onReady);
    if (el.readyState >= 1) setReady(true);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onReady);
      el.removeEventListener("canplay", onReady);
    };
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    void el.play().catch(() => {});
  }, []);

  return { mediaRef, currentTime, seekTo, ready };
}
