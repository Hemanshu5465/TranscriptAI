import { useRef, type ComponentType } from "react";
import { m, useReducedMotion, useSpring, useTransform } from "motion/react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  icon: ComponentType<{ className?: string }>;
  index: number;
  title: string;
  body: string;
}

/**
 * A feature card that tilts in 3D toward the pointer, with its heading and body
 * riding on raised layers so they parallax as the card turns. Reveals on scroll.
 * Falls back to a plain card under `prefers-reduced-motion`.
 */
export function FeatureCard({ icon: Icon, index, title, body }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const px = useSpring(0, { stiffness: 170, damping: 17, mass: 0.5 });
  const py = useSpring(0, { stiffness: 170, damping: 17, mass: 0.5 });
  const rotateX = useTransform(py, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(px, [-0.5, 0.5], [-9, 9]);
  const glowX = useTransform(px, [-0.5, 0.5], ["12%", "88%"]);
  const glowY = useTransform(py, [-0.5, 0.5], ["4%", "96%"]);

  const num = String(index + 1).padStart(2, "0");

  const shell =
    "group relative overflow-hidden rounded-xl border border-line bg-surface p-6 transition-colors hover:bg-surface-sunken";

  const inner = (
    <>
      <div style={reduced ? undefined : { transform: "translateZ(38px)" }}>
        <span className="font-mono text-[0.7rem] text-ink-faint">{num}</span>
        <Icon className="mt-3 size-5 text-accent transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
        <h3 className="mt-3 font-display text-lg">{title}</h3>
      </div>
      <p
        className="mt-1.5 text-sm text-ink-soft"
        style={reduced ? undefined : { transform: "translateZ(20px)" }}
      >
        {body}
      </p>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" />
    </>
  );

  if (reduced) {
    return (
      <m.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, delay: (index % 3) * 0.08, ease: EASE }}
        className={shell}
      >
        {inner}
      </m.div>
    );
  }

  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.08, ease: EASE }}
      style={{ rotateX, rotateY, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
      className={shell}
    >
      <m.span
        aria-hidden
        className="pointer-events-none absolute size-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{
          left: glowX,
          top: glowY,
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent)",
        }}
      />
      {inner}
    </m.div>
  );
}
