import { memo, useEffect, useRef, useState } from "react";
import type { SegmentOut } from "../lib/types";
import { hhmmssFull } from "../lib/format";
import { highlightParts } from "../hooks/useTranscriptSearch";
import { cn } from "../lib/cn";

const LOW_CONFIDENCE = 0.6;

interface Props {
  segment: SegmentOut;
  text: string;
  active: boolean;
  searchQuery: string;
  editing: boolean;
  showConfidence: boolean;
  onSeek: (seconds: number) => void;
  onEdit: (orderIndex: number, value: string) => void;
}

function ConfidenceText({ segment, showConfidence }: { segment: SegmentOut; showConfidence: boolean }) {
  const [popover, setPopover] = useState<number | null>(null);
  if (!showConfidence || segment.words.length === 0) return <>{segment.text}</>;

  return (
    <>
      {segment.words.map((w, i) => {
        const low = w.confidence != null && w.confidence < LOW_CONFIDENCE;
        if (!low) return <span key={i}>{w.word} </span>;
        return (
          <span key={i} className="relative">
            <button
              type="button"
              onClick={() => setPopover(popover === i ? null : i)}
              className="rounded-[3px] underline decoration-warn decoration-dotted decoration-2 underline-offset-4 hover:bg-warn-soft"
            >
              {w.word}
            </button>{" "}
            {popover === i && (
              <span className="absolute bottom-full left-0 z-20 mb-1 w-max rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-lg">
                Confidence: {Math.round((w.confidence ?? 0) * 100)}%
                <br />
                <span className="font-mono text-ink-faint">{hhmmssFull(w.start_time)}</span>
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

export const SegmentRow = memo(function SegmentRow({
  segment,
  text,
  active,
  searchQuery,
  editing,
  showConfidence,
  onSeek,
  onEdit,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${taRef.current.scrollHeight}px`;
    }
  }, [editing, text]);

  return (
    <div
      id={`seg-${segment.order_index}`}
      className={cn(
        "group grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg px-3 py-3 transition-colors sm:gap-x-6",
        active ? "bg-accent-soft" : "hover:bg-surface-sunken",
      )}
    >
      <div className="flex flex-col items-start gap-1 pt-0.5">
        <button
          onClick={() => onSeek(segment.start_time)}
          className="font-mono text-[0.78rem] text-accent tabular-nums transition-colors hover:text-accent-hover"
          title="Jump to this moment"
        >
          {hhmmssFull(segment.start_time)}
        </button>
        {segment.speaker && (
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.68rem] font-medium text-ink-soft">
            {segment.speaker}
          </span>
        )}
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => onEdit(segment.order_index, e.target.value)}
          rows={1}
          className="transcript-body w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
        />
      ) : (
        <p className="transcript-body text-ink">
          {searchQuery.trim().length >= 2 ? (
            highlightParts(text, searchQuery).map((part, i) =>
              part.hit ? (
                <mark key={i} className="rounded-[3px] bg-warn-soft px-0.5 text-ink">
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )
          ) : (
            <ConfidenceText segment={{ ...segment, text }} showConfidence={showConfidence} />
          )}
        </p>
      )}
    </div>
  );
});
