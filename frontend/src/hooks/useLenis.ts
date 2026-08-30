import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Buttery inertia scroll for one route. Mounts a Lenis instance while `enabled`
 * (turn it off for `prefers-reduced-motion`) and tears it down on unmount so the
 * rest of the app keeps native scrolling. Returns a ref to the instance so
 * callers can drive `scrollTo`.
 */
export function useLenis(enabled: boolean) {
  const ref = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let lenis: Lenis;
    try {
      lenis = new Lenis({ lerp: 0.12, smoothWheel: true, wheelMultiplier: 0.9 });
    } catch {
      return; // non-DOM environment (tests) — bail quietly
    }
    ref.current = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      ref.current = null;
    };
  }, [enabled]);

  return ref;
}
