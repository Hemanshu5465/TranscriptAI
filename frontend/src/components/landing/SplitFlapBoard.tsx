import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";

/**
 * A mechanical split-flap display (airport / train-station board). Rows of
 * character tiles riffle through glyphs and clatter to a stop, cascading left to
 * right, cycling through short lines about the product. Purely decorative — the
 * headline carries the real message — so the whole thing is `aria-hidden`.
 */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/· ";
const COLS = 12;

const MESSAGES: string[][] = [
  ["EVERY SPOKEN", "WORD ON", "THE RECORD"],
  ["TIMESTAMPED", "DOWN TO", "THE SECOND"],
  ["SRT VTT DOCX", "PDF JSON CSV", "ANY FORMAT"],
  ["PASTE A LINK", "OR A FILE", "GET A SCRIPT"],
];

function fit(line: string): string {
  const s = line.toUpperCase().slice(0, COLS);
  const pad = COLS - s.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + s + " ".repeat(pad - left);
}

function FlapCell({ target, delay, accent }: { target: string; delay: number; accent: boolean }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const [flip, setFlip] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    if (reduced || target === display) {
      setDisplay(target);
      return;
    }

    const steps = 3 + Math.floor(Math.random() * 3); // 3–5 flaps
    let idx = Math.max(0, CHARSET.indexOf(display));

    for (let s = 1; s <= steps; s++) {
      timers.current.push(
        window.setTimeout(() => {
          setFlip(true);
          timers.current.push(
            window.setTimeout(() => {
              if (s === steps) {
                setDisplay(target);
              } else {
                idx = (idx + 1 + (s % 3)) % CHARSET.length;
                setDisplay(CHARSET[idx]);
              }
              setFlip(false);
            }, 28),
          );
        }, delay + s * 58),
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
    <span className="flap-cell">
      <span className={cn("flap-glyph", flip && "flap-glyph--flip", accent && "flap-glyph--accent")}>
        {display === " " ? " " : display}
      </span>
      <span className="flap-seam" />
    </span>
  );
}

export function SplitFlapBoard() {
  const reduced = useReducedMotion();
  const [mi, setMi] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setMi((v) => (v + 1) % MESSAGES.length), 4200);
    return () => window.clearInterval(id);
  }, [reduced]);

  const rows = MESSAGES[mi].map(fit);

  return (
    <div
      aria-hidden="true"
      className="split-flap mx-auto max-w-[480px] select-none md:mx-0"
      onClick={() => !reduced && setMi((v) => (v + 1) % MESSAGES.length)}
    >
      <div className="relative rounded-2xl border border-white/10 bg-[#1d1710] p-3.5 shadow-[0_40px_90px_-30px_rgba(20,18,12,0.6),0_0_0_1px_rgba(0,0,0,0.25)]">
        {[
          "left-2 top-2",
          "right-2 top-2",
          "left-2 bottom-2",
          "right-2 bottom-2",
        ].map((pos) => (
          <span key={pos} className={`absolute ${pos} size-1 rounded-full bg-white/10`} />
        ))}
        <div className="flex flex-col gap-[6px]">
          {rows.map((line, r) => (
            <div
              key={r}
              className="grid gap-[5px]"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {line.split("").map((ch, c) => (
                <FlapCell
                  key={`${r}-${c}`}
                  target={ch}
                  delay={(r + c) * 24}
                  accent={r === rows.length - 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
