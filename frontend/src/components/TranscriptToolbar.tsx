import { ChevronDown, ClipboardCopy, Download, Redo2, Undo2 } from "lucide-react";
import { Menu } from "./Menu";
import { Button } from "./Button";
import { transcriptApi } from "../lib/api";
import { buildTranscriptString, copyToClipboard, type DisplaySegment } from "../lib/transcriptText";
import { toast } from "../hooks/useToast";
import type { AccuracyMode, TranscriptDetail } from "../lib/types";
import { cn } from "../lib/cn";
import type { TextVariant } from "../lib/transcriptText";

interface Props {
  transcript: TranscriptDetail;
  variant: TextVariant;
  onVariantChange: (v: TextVariant) => void;
  accuracyMode: AccuracyMode;
  onAccuracyChange: (m: AccuracyMode) => void;
  displaySegments: DisplaySegment[];
  editing: boolean;
  onToggleEditing: () => void;
  dirty: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MODES: AccuracyMode[] = ["exact", "clean", "readable"];
const EXPORTS: { fmt: string; label: string }[] = [
  { fmt: "txt", label: "Plain text (.txt)" },
  { fmt: "docx", label: "Word document (.docx)" },
  { fmt: "pdf", label: "PDF document (.pdf)" },
  { fmt: "srt", label: "Subtitles (.srt)" },
  { fmt: "vtt", label: "WebVTT (.vtt)" },
  { fmt: "json", label: "JSON (.json)" },
  { fmt: "csv", label: "CSV (.csv)" },
];

export function TranscriptToolbar(p: Props) {
  const segs = p.displaySegments;

  async function copy(timestamps: boolean) {
    const ok = await copyToClipboard(buildTranscriptString(segs, { timestamps }));
    ok ? toast.success("Copied to clipboard") : toast.error("Couldn't access the clipboard");
  }

  async function download(fmt: string) {
    try {
      await transcriptApi.downloadExport(p.transcript.id, fmt, {
        variant: p.variant === "raw" ? "raw" : p.dirty || p.variant === "edited" ? "edited" : "clean",
      });
      toast.success(`Exported ${fmt.toUpperCase()}`);
    } catch {
      toast.error("Export failed. Please try again.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
      {/* Raw / Clean toggle */}
      <div className="flex rounded-full border border-line p-0.5" role="group" aria-label="Transcript view">
        {(["raw", "clean"] as TextVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => p.onVariantChange(v)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              p.variant === v || (v === "clean" && p.variant === "edited")
                ? "bg-ink text-paper"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Accuracy mode */}
      <Menu
        align="start"
        trigger={({ open }) => (
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-ink-soft transition-colors hover:text-ink",
              open && "border-ink-faint text-ink",
            )}
          >
            Mode: <span className="font-medium capitalize text-ink">{p.accuracyMode}</span>
            <ChevronDown className="size-3" />
          </span>
        )}
        items={MODES.map((m) => ({
          label: m[0].toUpperCase() + m.slice(1),
          onSelect: () => p.onAccuracyChange(m),
        }))}
      />

      <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

      {/* Edit controls */}
      <Button variant={p.editing ? "primary" : "secondary"} size="sm" onClick={p.onToggleEditing}>
        {p.editing ? "Done editing" : "Edit"}
      </Button>
      {p.editing && (
        <>
          <button
            onClick={p.onUndo}
            disabled={!p.canUndo}
            aria-label="Undo"
            className="grid size-8 place-items-center rounded-full border border-line text-ink-soft disabled:opacity-40 hover:text-ink"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            onClick={p.onRedo}
            disabled={!p.canRedo}
            aria-label="Redo"
            className="grid size-8 place-items-center rounded-full border border-line text-ink-soft disabled:opacity-40 hover:text-ink"
          >
            <Redo2 className="size-3.5" />
          </button>
          <Button size="sm" onClick={p.onSave} disabled={!p.dirty}>
            Save
          </Button>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Menu
          trigger={({ open }) => (
            <span
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm text-ink-soft transition-colors hover:text-ink",
                open && "border-ink-faint text-ink",
              )}
            >
              <ClipboardCopy className="size-4" /> Copy <ChevronDown className="size-3" />
            </span>
          )}
          items={[
            { label: "Copy with timestamps", onSelect: () => copy(true) },
            { label: "Copy without timestamps", onSelect: () => copy(false) },
          ]}
        />
        <Menu
          trigger={({ open }) => (
            <span
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-medium text-[var(--color-accent-ink)] transition-colors hover:bg-accent-hover",
                open && "bg-accent-hover",
              )}
            >
              <Download className="size-4" /> Export <ChevronDown className="size-3" />
            </span>
          )}
          items={EXPORTS.map((e) => ({ label: e.label, onSelect: () => download(e.fmt) }))}
        />
      </div>
    </div>
  );
}
