import { useEffect, useState } from "react";
import { FileText, Pencil, Search } from "lucide-react";
import {
  m,
  stagger,
  useAnimate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { TranscriptDemo } from "./TranscriptDemo";

const BARS = 42;
// A fixed profile so the resting waveform looks like speech, not a test pattern.
const HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const t = i / (BARS - 1);
  const envelope = Math.sin(t * Math.PI); // fade in/out at the ends
  const detail = 0.45 + 0.55 * Math.abs(Math.sin(t * 21) * Math.cos(t * 8 + 1));
  return 0.18 + 0.82 * envelope * detail;
});

const CHIPS = [
  { icon: null as null, label: "[00:00:14]", cls: "-top-3 right-8 [animation:drift-a_6s_ease-in-out_infinite]" },
  { icon: FileText, label: ".srt", cls: "top-[36%] -left-6 [animation:drift-b_7.5s_ease-in-out_infinite]" },
  { icon: Search, label: "find", cls: "-bottom-3 left-14 [animation:drift-c_6.8s_ease-in-out_infinite]" },
  { icon: Pencil, label: "edit", cls: "bottom-12 -right-7 [animation:drift-a_8s_ease-in-out_infinite]" },
];

export function HeroStage() {
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate();
  const [ready, setReady] = useState(!!reduced);

  const rx = useSpring(0, { stiffness: 150, damping: 18, mass: 0.6 });
  const ry = useSpring(0, { stiffness: 150, damping: 18, mass: 0.6 });

  const { scrollY } = useScroll();
  const chipsY = useTransform(scrollY, [0, 600], [0, -60], { clamp: true });
  const cardY = useTransform(scrollY, [0, 600], [0, 28], { clamp: true });

  useEffect(() => {
    // `ready` already initialises to true under reduced motion.
    if (reduced) return;
    let cancelled = false;
    (async () => {
      await animate(
        ".wf-bar",
        { scaleY: [0.04, 1], opacity: [0, 1] },
        { duration: 0.45, delay: stagger(0.011, { from: "center" }), ease: [0.22, 1, 0.36, 1] },
      );
      if (cancelled) return;
      await animate(
        ".wf-bar",
        { scaleY: [1, 0.28, 0.8, 0.22, 0.55] },
        { duration: 0.8, delay: stagger(0.016, { from: "center" }) },
      );
      if (cancelled) return;
      await animate([
        [".wf-bar", { scaleY: 0.03, opacity: 0 }, { duration: 0.35, delay: stagger(0.007) }],
        [".wf-layer", { opacity: 0 }, { duration: 0.2, at: "-0.15" }],
        [
          ".demo-layer",
          { opacity: [0, 1], scale: [0.9, 1], y: [16, 0] },
          { duration: 0.5, ease: [0.22, 1, 0.36, 1], at: "-0.1" },
        ],
      ]);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reduced, animate]);

  return (
    <div
      ref={scope}
      className="relative flex min-h-[320px] items-center"
      onPointerMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 13);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {/* Waveform intro */}
      {!reduced && (
        <div className="wf-layer pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-[3px] px-4">
          {HEIGHTS.map((h, i) => (
            <span
              key={i}
              className="wf-bar w-1.5 origin-center rounded-full bg-accent/80"
              style={{ height: `${Math.round(h * 96)}px`, transform: "scaleY(0.04)" }}
            />
          ))}
        </div>
      )}

      {/* The card (scroll parallax → reveal → pointer tilt) */}
      <m.div className="w-full" style={{ y: cardY }}>
        <div className="demo-layer" style={{ opacity: reduced ? 1 : 0 }}>
          <m.div style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}>
            <TranscriptDemo paused={!ready} />
          </m.div>
        </div>
      </m.div>

      {/* Floating "ingredient" chips */}
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-500"
        style={{ y: chipsY, opacity: ready ? 1 : 0 }}
      >
        {CHIPS.map((c) => (
          <span
            key={c.label}
            className={`absolute inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[0.7rem] text-ink-soft shadow-[0_8px_24px_-10px_rgba(20,18,12,0.35)] ${c.cls}`}
          >
            {c.icon && <c.icon className="size-3 text-accent" />}
            {c.label}
          </span>
        ))}
      </m.div>
    </div>
  );
}
