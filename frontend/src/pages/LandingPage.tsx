import { FileText, Languages, Pencil, Search, ShieldCheck, Timer } from "lucide-react";
import { UrlComposer } from "../components/UrlComposer";
import { RecordDot } from "../components/Brand";

const FEATURES = [
  { icon: Timer, title: "Timestamped segments", body: "Every line is anchored to the moment it was spoken. Click to jump the video." },
  { icon: Search, title: "Search the spoken word", body: "Find any phrase across the whole transcript and leap straight to it." },
  { icon: Pencil, title: "Edit without losing the original", body: "Raw, clean, and your edited version are kept side by side — always." },
  { icon: FileText, title: "Export anywhere", body: "TXT, DOCX, PDF, SRT, VTT, JSON and CSV, with or without timestamps." },
  { icon: Languages, title: "Built for many languages", body: "English, Hindi and Gujarati today, with automatic language detection." },
  { icon: ShieldCheck, title: "Word-for-word, never a summary", body: "Formatting restores punctuation and paragraphs — it never rewrites meaning." },
];

export function LandingPage() {
  return (
    <div className="paper-grain">
      <section className="mx-auto max-w-3xl px-4 pb-16 pt-16 text-center sm:pt-24">
        <p className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft">
          <RecordDot /> Accurate transcription for creators & researchers
        </p>
        <h1 className="animate-rise text-balance font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl" style={{ animationDelay: "60ms" }}>
          Turn any YouTube video into a script
        </h1>
        <p className="animate-rise mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-soft" style={{ animationDelay: "120ms" }}>
          Paste a YouTube URL and generate an accurate, searchable, timestamped transcript in
          seconds.
        </p>

        <div className="animate-rise mt-9" style={{ animationDelay: "180ms" }}>
          <UrlComposer autoFocus />
        </div>

        <p className="animate-rise mt-4 break-words text-xs text-ink-faint" style={{ animationDelay: "220ms" }}>
          Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ · Only transcribe content you are
          authorized to process.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface p-6">
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-3 font-display text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
