import { Check, Loader2 } from "lucide-react";
import { STAGE_LABELS, STAGE_ORDER } from "../lib/types";
import { cn } from "../lib/cn";

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(3, value))}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function StageChecklist({
  stage,
  failed = false,
}: {
  stage: string;
  failed?: boolean;
}) {
  const currentIdx = STAGE_ORDER.indexOf(stage);
  return (
    <ol className="flex flex-col gap-1">
      {STAGE_ORDER.map((key, idx) => {
        const done = idx < currentIdx || stage === "complete";
        const active = idx === currentIdx && stage !== "complete";
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
              active && "bg-surface-sunken",
            )}
          >
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                done && "border-good bg-good/15 text-good",
                active && !failed && "border-accent text-accent",
                active && failed && "border-accent bg-accent/15 text-accent",
                !done && !active && "border-line text-ink-faint",
              )}
            >
              {done ? (
                <Check className="size-3" />
              ) : active && !failed ? (
                <Loader2 className="size-3 animate-spin" />
              ) : active && failed ? (
                "!"
              ) : (
                <span className="size-1 rounded-full bg-current" />
              )}
            </span>
            <span className={cn(done || active ? "text-ink" : "text-ink-faint")}>
              {STAGE_LABELS[key]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
