import { m, useReducedMotion } from "motion/react";

const FORMATS = ["TXT", "DOCX", "PDF", "SRT", "VTT", "JSON", "CSV"];

function Row() {
  return (
    <div className="flex shrink-0 items-center">
      {FORMATS.map((f) => (
        <span key={f} className="flex items-center">
          <span className="px-5 font-mono text-xs tracking-[0.2em] text-ink-faint">{f}</span>
          <span className="text-ink-faint/40">·</span>
        </span>
      ))}
    </div>
  );
}

export function FormatTicker() {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-line py-4">
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-faint">
          Export to
        </span>
        {FORMATS.map((f) => (
          <span key={f} className="font-mono text-xs tracking-[0.2em] text-ink-faint">
            {f}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex overflow-hidden border-y border-line py-4">
      <span className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-paper to-transparent" />
      <span className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-paper to-transparent" />
      <m.div
        className="flex"
        style={{ willChange: "transform" }}
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 24, ease: "linear", repeat: Infinity }}
      >
        <Row />
        <Row />
        <Row />
        <Row />
      </m.div>
    </div>
  );
}
