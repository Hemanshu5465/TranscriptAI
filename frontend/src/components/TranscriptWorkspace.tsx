import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TranscriptToolbar } from "./TranscriptToolbar";
import { SearchPanel } from "./SearchPanel";
import { SegmentRow } from "./SegmentRow";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useDebounce } from "../hooks/useDebounce";
import { useTranscriptSearch, type SearchMatch } from "../hooks/useTranscriptSearch";
import { transcriptApi, apiErrorMessage } from "../lib/api";
import { toast } from "../hooks/useToast";
import { segmentText, type TextVariant } from "../lib/transcriptText";
import type { AccuracyMode, TranscriptDetail } from "../lib/types";

interface Props {
  transcript: TranscriptDetail;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function TranscriptWorkspace({ transcript, currentTime, onSeek }: Props) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [variant, setVariant] = useState<TextVariant>(transcript.edited_text ? "edited" : "clean");
  const [accuracyMode, setAccuracyMode] = useState<AccuracyMode>(transcript.accuracy_mode);
  const [editing, setEditing] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const query = useDebounce(rawQuery, 200);
  const [showConfidence, setShowConfidence] = useState(true);

  const edits = useUndoRedo<Record<number, string>>({});
  const dirty = Object.keys(edits.state).length > 0;

  // Re-run the pipeline when the accuracy mode changes.
  const remode = useMutation({
    mutationFn: (mode: AccuracyMode) => transcriptApi.create(transcript.video.url, mode),
    onSuccess: (job) => {
      toast.info("Re-processing with the new accuracy mode…");
      window.location.href = `/t/${job.job_id}/processing`;
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = transcript.segments.map((s) => ({
        order_index: s.order_index,
        speaker: s.speaker,
        start_time: s.start_time,
        end_time: s.end_time,
        // Keep previously-saved edits on segments the user didn't touch this round.
        text: edits.state[s.order_index] ?? segmentText(s, "edited", {}),
      }));
      return transcriptApi.update(transcript.id, payload);
    },
    onSuccess: (data) => {
      qc.setQueryData(["transcript", transcript.id], data);
      edits.reset({});
      setVariant("edited");
      toast.success("Transcript saved");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't save your edits.")),
  });

  const displaySegments = useMemo(
    () =>
      transcript.segments.map((s) => ({
        order_index: s.order_index,
        speaker: s.speaker,
        start_time: s.start_time,
        end_time: s.end_time,
        // While editing, resolve against the "edited" layer so the textarea is a
        // controlled input that reflects every keystroke (live edit → last saved
        // edit → clean text); otherwise honour the selected raw / clean / edited view.
        text: segmentText(s, editing ? "edited" : variant, edits.state),
      })),
    [transcript.segments, variant, edits.state, editing],
  );

  const searchSource = useMemo(
    () =>
      transcript.segments.map((s, i) => ({
        id: s.id,
        order_index: s.order_index,
        start_time: s.start_time,
        text: displaySegments[i].text,
      })),
    [transcript.segments, displaySegments],
  );
  const { matches } = useTranscriptSearch(searchSource, query);

  const activeIndex = useMemo(() => {
    if (!currentTime) return -1;
    for (let i = transcript.segments.length - 1; i >= 0; i--) {
      if (currentTime >= transcript.segments[i].start_time - 0.4) return i;
    }
    return -1;
  }, [currentTime, transcript.segments]);

  const virtualizer = useVirtualizer({
    count: transcript.segments.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 108,
    overscan: 8,
  });

  const scrollToSegment = useCallback(
    (orderIndex: number) => {
      virtualizer.scrollToIndex(orderIndex, { align: "center" });
    },
    [virtualizer],
  );

  // Follow along with playback (only when not editing / searching).
  useEffect(() => {
    if (editing || query || activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "center", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const onJump = useCallback(
    (m: SearchMatch) => {
      onSeek(m.start);
      scrollToSegment(m.segmentIndex);
    },
    [onSeek, scrollToSegment],
  );

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col">
      <TranscriptToolbar
        transcript={transcript}
        variant={variant}
        onVariantChange={setVariant}
        accuracyMode={accuracyMode}
        onAccuracyChange={(m) => {
          setAccuracyMode(m);
          if (m !== transcript.accuracy_mode) remode.mutate(m);
        }}
        displaySegments={displaySegments}
        editing={editing}
        onToggleEditing={() => setEditing((e) => !e)}
        dirty={dirty}
        onSave={() => save.mutate()}
        onUndo={edits.undo}
        onRedo={edits.redo}
        canUndo={edits.canUndo}
        canRedo={edits.canRedo}
      />
      <SearchPanel query={rawQuery} onQuery={setRawQuery} matches={matches} onJump={onJump} />

      {transcript.has_word_timestamps && (
        <label className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs text-ink-soft sm:px-6">
          <input
            type="checkbox"
            checked={showConfidence}
            onChange={(e) => setShowConfidence(e.target.checked)}
            className="accent-accent"
          />
          Highlight low-confidence words
        </label>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 sm:px-4">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {items.map((vi) => {
            const seg = transcript.segments[vi.index];
            return (
              <div
                key={seg.id}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
              >
                <SegmentRow
                  segment={seg}
                  text={displaySegments[vi.index].text}
                  active={vi.index === activeIndex}
                  searchQuery={query}
                  editing={editing}
                  showConfidence={showConfidence && variant !== "raw"}
                  onSeek={onSeek}
                  onEdit={(oi, value) => edits.set((prev) => ({ ...prev, [oi]: value }))}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
