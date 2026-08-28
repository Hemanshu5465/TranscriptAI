import { Search, X } from "lucide-react";
import type { SearchMatch } from "../hooks/useTranscriptSearch";
import { hhmmssFull } from "../lib/format";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  matches: SearchMatch[];
  onJump: (m: SearchMatch) => void;
}

export function SearchPanel({ query, onQuery, matches, onJump }: Props) {
  const showResults = query.trim().length >= 2;
  return (
    <div className="border-b border-line px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5">
        <Search className="size-4 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search transcript…"
          aria-label="Search transcript"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        {query && (
          <button onClick={() => onQuery("")} aria-label="Clear search" className="text-ink-faint hover:text-ink">
            <X className="size-3.5" />
          </button>
        )}
        {showResults && (
          <span className="shrink-0 font-mono text-xs text-ink-faint">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {showResults && matches.length > 0 && (
        <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto pr-1">
          {matches.slice(0, 100).map((m, i) => (
            <li key={i}>
              <button
                onClick={() => onJump(m)}
                className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-sunken"
              >
                <span className="shrink-0 font-mono text-[0.72rem] text-accent">
                  {hhmmssFull(m.start)}
                </span>
                <span className="truncate text-ink-soft">{m.snippet}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
