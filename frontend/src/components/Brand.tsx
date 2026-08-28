import { Link } from "react-router-dom";
import { cn } from "../lib/cn";

export function RecordDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
      <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
    </span>
  );
}

export function Wordmark({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn("group inline-flex items-center gap-2.5 text-ink", className)}
      aria-label="TranscriptAI home"
    >
      <span className="grid size-8 place-items-center rounded-lg border border-line-strong bg-surface">
        <span className="size-2 rounded-full bg-accent transition-transform group-hover:scale-125" />
      </span>
      <span className="font-display text-[1.15rem] font-semibold tracking-tight">
        Transcript<span className="text-accent">AI</span>
      </span>
    </Link>
  );
}
