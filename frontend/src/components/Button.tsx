import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-[var(--color-accent-ink)] hover:bg-accent-hover shadow-[0_1px_0_rgba(0,0,0,0.04)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-ink-faint hover:bg-surface-sunken",
  ghost: "text-ink-soft hover:text-ink hover:bg-surface-sunken",
  danger: "bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] text-accent hover:bg-[color-mix(in_oklab,var(--color-accent)_20%,transparent)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[0.95rem] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium tracking-tight",
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});
