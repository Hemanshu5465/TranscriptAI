import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";

/**
 * A mechanical split-flap display (airport / departure board). Character tiles
 * riffle through glyphs and clatter to a stop on a diagonal cascade, cycling
 * through short lines about the product. It stays blank until scrolled into
 * view, then does its first big flip. Purely decorative — `aria-hidden`.
 */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/· ";
const COLS = 12;

const MESSAGES: string[][] = [
  ["EVERY SPOKEN", "WORD ON", "THE RECORD"],
  ["TIMESTAMPED", "DOWN TO", "THE SECOND"],
  ["FIND ANY", "PHRASE IN", "ONE CLICK"],
  ["EXPORT TO", "SRT VTT DOCX", "PDF JSON CSV"],
  ["PASTE A LINK", "OR A FILE —", "GET A SCRIPT"],
];

function fit(line: string): string {
  const s = line.toUpperCase().slice(0, COLS);
  const pad = COLS - s.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + s + " ".repeat(pad - left);
}

const NBSP = " ";
const glyph = (ch: string) => (ch === " " ? NBSP : ch);

function FlapCell({ target, delay, accent }: { target: string; delay: number; accent: boolean }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const [leaf, setLeaf] = useState<{ ch: string; k: number } | null>(null);
  const keyRef = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    if (reduced || target === display) {
      setDisplay(target);
      setLeaf(null);
      return;
    }

    const steps = 3 + Math.floor(Math.random() * 3); // 3–5 flaps
    let cur = display;
    let idx = Math.max(0, CHARSET.indexOf(display));

    for (let s = 1; s <= steps; s++) {
      const next =
        s === steps ? target : CHARSET[(idx = (idx + 1 + (s % 3)) % CHARSET.length)];
      const from = cur;
      cur = next;
      timers.current.push(
        window.setTimeout(() => {
          setDisplay(next); // the new glyph is revealed behind the folding leaf
          setLeaf({ ch: from, k: ++keyRef.current });
          timers.current.push(window.setTimeout(() => setLeaf(null), 135));
        }, delay + (s - 1) * 96),
      );
    }

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // Re-run only when the target glyph changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);

  return (
    <span className={cn("flap-cell", accent && "flap-cell--accent")}>
      <span className="flap-half flap-half--top">
        <span className="flap-face">{glyph(display)}</span>
      </span>
      <span className="flap-half flap-half--bottom">
        <span className="flap-face">{glyph(display)}</span>
      </span>
      {leaf && (
        <span key={leaf.k} className="flap-leaf">
          <span className="flap-face">{glyph(leaf.ch)}</span>
        </span>
      )}
      <span className="flap-seam" />
    </span>
  );
}

export function SplitFlapBoard() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const [fallback, setFallback] = useState(false);
  const [mi, setMi] = useState(0);

  // Kick the board off once it's on screen — or after a beat if the observer
  // never fires (no-JS-observer environments).
  const started = reduced || inView || fallback;

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setFallback(true), 1800);
    return () => window.clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (reduced || !started) return;
    const id = window.setInterval(() => setMi((v) => (v + 1) % MESSAGES.length), 4200);
    return () => window.clearInterval(id);
  }, [reduced, started]);

  const rows = (started ? MESSAGES[mi] : ["", "", ""]).map(fit);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="split-flap mx-auto max-w-[880px] select-none [perspective:1500px]"
      onClick={() => started && !reduced && setMi((v) => (v + 1) % MESSAGES.length)}
    >
      <div className="split-flap-housing relative rounded-[26px] border border-white/10 bg-[#1d1710] p-4 shadow-[0_50px_100px_-35px_rgba(20,18,12,0.6),0_0_0_1px_rgba(0,0,0,0.25)] sm:p-6">
        {["left-3 top-3", "right-3 top-3", "left-3 bottom-3", "right-3 bottom-3"].map((pos) => (
          <span key={pos} className={`absolute ${pos} size-1.5 rounded-full bg-white/10`} />
        ))}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {rows.map((line, r) => (
            <div
              key={r}
              className="grid gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {line.split("").map((ch, c) => (
                <FlapCell
                  key={`${r}-${c}`}
                  target={ch}
                  delay={(r + c) * 26}
                  accent={started && r === rows.length - 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
