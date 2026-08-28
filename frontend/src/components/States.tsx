import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse-bar rounded-lg bg-[color-mix(in_oklab,var(--color-ink)_9%,transparent)]",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-accent">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-[color-mix(in_oklab,var(--color-accent)_6%,transparent)] px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent/15 text-accent">
        <span className="font-display text-xl">!</span>
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      {description && <p className="text-sm text-ink-soft">{description}</p>}
      {action}
    </div>
  );
}
