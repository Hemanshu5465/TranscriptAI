import type { TranscriptStats } from "../lib/types";
import { compactNumber, hhmmss } from "../lib/format";

export function StatsPanel({ stats }: { stats: TranscriptStats | null }) {
  if (!stats) return null;
  const rows: [string, string][] = [
    ["Words", compactNumber(stats.words)],
    ["Characters", compactNumber(stats.characters)],
    ["Sentences", compactNumber(stats.sentences)],
    ["Paragraphs", compactNumber(stats.paragraphs)],
    ["Segments", compactNumber(stats.segments)],
    ["Duration", stats.duration_seconds ? hhmmss(stats.duration_seconds) : "—"],
    ["Speaking time", stats.speaking_time_seconds ? hhmmss(stats.speaking_time_seconds) : "—"],
    ["Speaking pace", stats.speaking_pace_wpm ? `${stats.speaking_pace_wpm} wpm` : "—"],
    ["Reading time", stats.reading_time_minutes ? `${stats.reading_time_minutes} min` : "—"],
  ];
  if (stats.speaker_count > 1) rows.push(["Speakers", String(stats.speaker_count)]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-[0.7rem] uppercase tracking-widest text-ink-faint">
        Transcript stats
      </h3>
      <dl className="flex flex-col divide-y divide-[color-mix(in_oklab,var(--color-line)_70%,transparent)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between py-1.5 text-sm">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="font-mono text-[0.82rem] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
