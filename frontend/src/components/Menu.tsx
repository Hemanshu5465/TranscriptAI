import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  hint?: string;
}

export function Menu({
  trigger,
  items,
  align = "end",
}: {
  trigger: (props: { open: boolean }) => ReactNode;
  items: (MenuItem | "divider")[];
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger({ open })}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "absolute z-30 mt-2 min-w-52 overflow-hidden rounded-xl border border-line-strong bg-surface p-1 shadow-xl animate-rise",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                {item.icon && <span className="shrink-0 text-ink-faint">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="font-mono text-[0.7rem] text-ink-faint">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
