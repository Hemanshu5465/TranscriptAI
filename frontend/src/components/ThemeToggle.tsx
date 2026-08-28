import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../store/theme";
import { cn } from "../lib/cn";

const ICON = { light: Sun, dark: Moon, system: Monitor };
const LABEL = { light: "Light", dark: "Dark", system: "System" };

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { pref, cycle } = useTheme();
  const Icon = ICON[pref];
  return (
    <button
      onClick={cycle}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface text-ink-soft",
        "transition-colors hover:text-ink hover:border-ink-faint",
        compact ? "size-9 justify-center" : "h-9 px-3 text-[0.8rem]",
      )}
      aria-label={`Theme: ${LABEL[pref]}. Click to change.`}
      title={`Theme: ${LABEL[pref]}`}
    >
      <Icon className="size-4" />
      {!compact && <span>{LABEL[pref]}</span>}
    </button>
  );
}
