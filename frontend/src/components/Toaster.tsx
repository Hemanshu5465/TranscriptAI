import { Check, Info, TriangleAlert, X } from "lucide-react";
import { useToast } from "../hooks/useToast";
import { cn } from "../lib/cn";

const ICONS = { success: Check, error: TriangleAlert, info: Info };

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 rounded-full border bg-surface px-4 py-2.5 text-sm shadow-lg animate-rise",
              t.tone === "error" ? "border-accent/40 text-accent" : "border-line-strong text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="max-w-xs">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-faint hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
