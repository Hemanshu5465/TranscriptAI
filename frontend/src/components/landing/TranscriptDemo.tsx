import { useEffect } from "react";
import { Play } from "lucide-react";
import {
  animate,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { hhmmss, hhmmssFull } from "../../lib/format";

/**
 * A decorative, looping mock of the transcript workspace: a playhead sweeps a
 * ~30s clip while each line highlights and types itself in as the playhead
 * reaches its timestamp. Everything is derived from a single MotionValue, so it
 * animates on the compositor without re-rendering React.
 *
 * `aria-hidden` — this is illustration only; the real feature list carries the
 * meaning for assistive tech.
 */

const CLIP = 30; // seconds of "audio" the loop represents (last ~6s = a rest beat)
const SPAN = 24; // where the playhead visually stops
const TYPE = 2.2; // seconds a line takes to type in
const LOOP_SECONDS = 13; // real time for one loop

const LINES = [
  { at: 2, text: "So the first thing you notice is the timestamps." },
  { at: 8, text: "Every line is anchored to the moment it was said." },
  { at: 14, text: "Click a timestamp and the video jumps right there." },
  { at: 20, text: "Search, edit, export — the words never change." },
];

export function TranscriptDemo() {
  const reduced = useReducedMotion();
  const progress = useMotionValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(progress, 1, {
      duration: LOOP_SECONDS,
      ease: "linear",
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [reduced, progress]);

  const playX = useTransform(progress, [0, SPAN / CLIP, 1], ["0%", "100%", "100%"]);
  const clock = useTransform(progress, (p) => hhmmss(Math.min(SPAN, p * CLIP)));
  const groupOpacity = useTransform(progress, [0, 0.03, 0.9, 1], [0.35, 1, 1, 0.35]);

  return (
    <div
      aria-hidden="true"
      className="paper-grain select-none rounded-2xl border border-line-strong bg-surface p-4 shadow-[0_28px_70px_-28px_rgba(20,18,12,0.4)] sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[var(--color-accent-ink)]">
          <Play className="size-3 translate-x-px fill-current" />
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <m.div
            style={{ width: playX }}
            className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
          />
        </div>
        <m.span className="w-16 shrink-0 text-right font-mono text-[0.7rem] tabular-nums text-ink-faint">
          {clock}
        </m.span>
      </div>

      <m.div style={{ opacity: reduced ? 1 : groupOpacity }} className="mt-4 space-y-0.5">
        {LINES.map((line) => (
          <DemoLine
            key={line.at}
            progress={progress}
            at={line.at}
            text={line.text}
            reduced={!!reduced}
          />
        ))}
      </m.div>
    </div>
  );
}

function DemoLine({
  progress,
  at,
  text,
  reduced,
}: {
  progress: MotionValue<number>;
  at: number;
  text: string;
  reduced: boolean;
}) {
  const typed = useTransform(progress, [at / CLIP, (at + TYPE) / CLIP], [0, 1], { clamp: true });
  const shown = useTransform(typed, (t) =>
    reduced ? text : text.slice(0, Math.round(t * text.length)),
  );
  const caret = useTransform(typed, (t) => (t > 0 && t < 1 ? 1 : 0));
  const highlight = useTransform(
    progress,
    [(at - 1) / CLIP, at / CLIP, (at + 4) / CLIP, (at + 5.2) / CLIP],
    [0, 1, 1, 0],
  );

  return (
    <div className="relative grid grid-cols-[auto_1fr] gap-x-3 rounded-lg px-2 py-1.5">
      <m.div
        aria-hidden
        style={{ opacity: reduced ? 0 : highlight }}
        className="absolute inset-0 rounded-lg bg-accent-soft"
      />
      <span className="relative z-10 pt-[0.2rem] font-mono text-[0.68rem] tabular-nums text-accent">
        [{hhmmssFull(at)}]
      </span>
      <p className="transcript-body relative z-10 text-[0.95rem] leading-relaxed text-ink">
        <m.span>{shown}</m.span>
        <m.span
          style={{ opacity: reduced ? 0 : caret }}
          className="ml-px inline-block h-[1.05em] w-px translate-y-[0.15em] animate-pulse bg-accent"
        />
      </p>
    </div>
  );
}
