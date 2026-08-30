import { FileText, Languages, Pencil, Search, ShieldCheck, Timer } from "lucide-react";
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { UrlComposer } from "../components/UrlComposer";
import { RecordDot } from "../components/Brand";
import { SplitFlapBoard } from "../components/landing/SplitFlapBoard";
import { FormatTicker } from "../components/landing/FormatTicker";
import { Magnetic } from "../components/landing/Magnetic";
import { useLenis } from "../hooks/useLenis";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const HEAD_LINES = ["Turn any video", "into a script"];

const FEATURES = [
  { icon: Timer, title: "Timestamped segments", body: "Every line is anchored to the moment it was spoken. Click to jump the video." },
  { icon: Search, title: "Search the spoken word", body: "Find any phrase across the whole transcript and leap straight to it." },
  { icon: Pencil, title: "Edit without losing the original", body: "Raw, clean, and your edited version are kept side by side — always." },
  { icon: FileText, title: "Export anywhere", body: "TXT, DOCX, PDF, SRT, VTT, JSON and CSV, with or without timestamps." },
  { icon: Languages, title: "Built for many languages", body: "English, Hindi and Gujarati today, with automatic language detection." },
  { icon: ShieldCheck, title: "Word-for-word, never a summary", body: "Formatting restores punctuation and paragraphs — it never rewrites meaning." },
];

const STEPS = [
  { n: "01", title: "Paste a link or file", body: "A YouTube URL, or an uploaded video / audio file up to 1 GB." },
  { n: "02", title: "We transcribe it", body: "Speech recognition with punctuation, paragraphs and per-word timing." },
  { n: "03", title: "Edit & export", body: "Fix a word if you need to, then download it in any of seven formats." },
];

export function LandingPage() {
  const reduced = useReducedMotion();
  const lenisRef = useLenis(!reduced);

  const { scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  const washY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const washOpacity = useTransform(scrollYProgress, [0, 0.45, 1], [1, 0.55, 0.12]);

  const cue = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: EASE },
        };

  const rise = (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.35 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  function goToComposer() {
    const el = document.getElementById("start");
    if (lenisRef.current) lenisRef.current.scrollTo("#start", { offset: -110, duration: 1.1 });
    else el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(
      () => el?.querySelector<HTMLInputElement>('input:not([type="file"])')?.focus({ preventScroll: true }),
      reduced ? 0 : 500,
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      {/* scroll progress */}
      <m.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-accent"
        style={{ scaleX: reduced ? 1 : progressScaleX }}
      />

      {/* drifting warm wash behind everything */}
      <m.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={reduced ? undefined : { y: washY, opacity: washOpacity }}
      >
        <div className="hero-wash absolute inset-x-0 top-0 h-[85vh]" />
      </m.div>

      <div className="overflow-x-clip">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="paper-grain relative">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-4 top-10 -z-10 select-none font-display text-[13rem] leading-none text-ink/[0.035] sm:-left-8 sm:text-[22rem]"
          >
            &ldquo;
          </span>

          <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pt-24">
            <div id="start" className="text-center lg:text-left">
              <m.p
                {...cue(0)}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft"
              >
                <RecordDot /> Accurate transcription for creators &amp; researchers
              </m.p>

              <h1 className="font-display text-[2.7rem] leading-[1.12] tracking-tight sm:text-6xl">
                {HEAD_LINES.map((line, li) => (
                  <span key={li} className="block overflow-hidden">
                    <m.span
                      className="block"
                      initial={reduced ? undefined : { y: "110%" }}
                      animate={reduced ? undefined : { y: 0 }}
                      transition={{ duration: 0.8, delay: 0.12 + li * 0.12, ease: EASE }}
                    >
                      {line}
                    </m.span>
                  </span>
                ))}
              </h1>

              <m.p
                {...cue(0.42)}
                className="mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-soft lg:mx-0"
              >
                Paste a YouTube URL or upload a file and generate an accurate, searchable,
                timestamped transcript in seconds.
              </m.p>

              <m.div {...cue(0.5)} className="mt-8">
                <UrlComposer autoFocus />
              </m.div>

              <m.p {...cue(0.58)} className="mt-4 break-words text-xs text-ink-faint">
                Example: youtube.com/watch?v=dQw4w9WgXcQ · Only transcribe content you are
                authorized to process.
              </m.p>
            </div>

            <m.div
              className="hidden md:block"
              initial={reduced ? undefined : { opacity: 0, y: 20 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            >
              <SplitFlapBoard />
            </m.div>
          </div>
        </section>

        {/* ── Format ticker ────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FormatTicker />
        </div>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <m.h2 {...rise()} className="font-display text-2xl sm:text-3xl">
            Everything in one place
          </m.h2>
          <m.p {...rise(0.05)} className="mt-2 max-w-lg text-ink-soft">
            From raw speech to a polished, exportable script — without ever rewriting what
            was said.
          </m.p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <m.div
                key={f.title}
                initial={reduced ? undefined : { opacity: 0, y: 24 }}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: EASE }}
                className="group relative overflow-hidden rounded-xl border border-line bg-surface p-6 transition-colors hover:bg-surface-sunken"
              >
                <span className="font-mono text-[0.7rem] text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <f.icon className="mt-3 size-5 text-accent transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
                <h3 className="mt-3 font-display text-lg">{f.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{f.body}</p>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" />
              </m.div>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <m.div key={s.n} {...rise(i * 0.08)} className="relative">
                <div className="font-display text-4xl text-accent">{s.n}</div>
                <m.div
                  className="mt-3 h-px origin-left bg-line-strong"
                  initial={reduced ? undefined : { scaleX: 0 }}
                  whileInView={reduced ? undefined : { scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.15 + i * 0.12, ease: EASE }}
                />
                <h3 className="mt-3 font-display text-lg">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{s.body}</p>
              </m.div>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-ink text-paper">
          <div className="paper-grain absolute inset-0 opacity-[0.06]" aria-hidden />
          <m.div
            {...rise()}
            className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6"
          >
            <h2 className="font-display text-3xl text-paper sm:text-[2.6rem]">
              Your next transcript is one paste away.
            </h2>
            <Magnetic strength={0.4}>
              <button
                onClick={goToComposer}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[0.95rem] font-medium text-[var(--color-accent-ink)] transition-colors hover:bg-accent-hover active:scale-[0.98]"
              >
                Start transcribing
              </button>
            </Magnetic>
          </m.div>
        </section>
      </div>
    </LazyMotion>
  );
}
