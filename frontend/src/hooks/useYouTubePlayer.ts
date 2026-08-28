import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal YouTube IFrame Player API typings */
interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  getCurrentTime: () => number;
  destroy: () => void;
}
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function useYouTubePlayer(videoId: string | undefined) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!videoId || !containerRef.current) return;
    let cancelled = false;
    let poll: number | undefined;

    loadApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            poll = window.setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === "number") setCurrentTime(t);
            }, 500);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setReady(false);
    };
  }, [videoId]);

  const seekTo = useCallback((seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(Math.max(0, seconds), true);
    p.playVideo();
  }, []);

  return { containerRef, ready, seekTo, currentTime };
}
