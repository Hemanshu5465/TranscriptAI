import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Link2, TriangleAlert, Upload } from "lucide-react";
import { Button } from "./Button";
import { transcriptApi, apiErrorMessage } from "../lib/api";
import { isValidYouTubeUrl } from "../lib/youtube";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_MB,
  uploadTranscriptFile,
  validateFile,
} from "../lib/upload";
import { toast } from "../hooks/useToast";
import type { AccuracyMode } from "../lib/types";
import { cn } from "../lib/cn";

const MODES: { value: AccuracyMode; label: string; hint: string }[] = [
  { value: "exact", label: "Exact", hint: "Preserve detected words verbatim" },
  { value: "clean", label: "Clean", hint: "Punctuation & formatting, wording kept" },
  { value: "readable", label: "Readable", hint: "Also fix obvious transcription slips" },
];

type Tab = "url" | "upload";

export function UrlComposer({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("url");
  const [mode, setMode] = useState<AccuracyMode>("clean");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <div className="mb-3 inline-flex rounded-full border border-line p-0.5" role="tablist" aria-label="Transcript source">
        {(
          [
            ["url", "YouTube URL"],
            ["upload", "Upload file"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            disabled={submitting}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              tab === key ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "url" ? (
        <UrlForm
          autoFocus={autoFocus}
          mode={mode}
          submitting={submitting}
          setSubmitting={setSubmitting}
          navigate={navigate}
        />
      ) : (
        <UploadForm
          mode={mode}
          submitting={submitting}
          setSubmitting={setSubmitting}
          navigate={navigate}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-ink-faint">Accuracy</span>
        <div className="flex rounded-full border border-line p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              title={m.hint}
              onClick={() => setMode(m.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                mode === m.value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type SharedProps = {
  mode: AccuracyMode;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
};

/* ── YouTube URL (unchanged behaviour) ─────────────────────────── */
function UrlForm({ autoFocus, mode, submitting, setSubmitting, navigate }: SharedProps & { autoFocus: boolean }) {
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = touched && url.trim().length > 0 && !isValidYouTubeUrl(url);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValidYouTubeUrl(url)) {
      toast.error("Please enter a valid YouTube URL.");
      return;
    }
    setSubmitting(true);
    try {
      const job = await transcriptApi.create(url.trim(), mode);
      navigate(`/t/${job.job_id}/processing`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "We couldn't start the transcript. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={cn(
          "group flex flex-col gap-2 rounded-2xl border bg-surface p-2 sm:flex-row sm:items-center sm:gap-1 sm:pl-5",
          invalid ? "border-accent/60" : "border-line-strong focus-within:border-ink-faint",
        )}
      >
        <Link2 className="hidden size-5 shrink-0 text-ink-faint sm:block" />
        <input
          autoFocus={autoFocus}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          inputMode="url"
          placeholder="Paste a YouTube video URL"
          aria-label="YouTube video URL"
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint sm:px-2"
        />
        <Button type="submit" size="lg" loading={submitting} className="shrink-0">
          Generate Transcript
          {!submitting && <ArrowRight className="size-4" />}
        </Button>
      </div>
      {invalid && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-accent">
          <TriangleAlert className="size-3.5" /> That doesn't look like a YouTube link.
        </p>
      )}
    </form>
  );
}

/* ── Upload a file ────────────────────────────────────────────── */
function UploadForm({ mode, submitting, setSubmitting, navigate }: SharedProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    setFileName(file.name);
    setProgress(0);
    try {
      const uploaded = await uploadTranscriptFile(file, setProgress);
      setProgress(100);
      const job = await transcriptApi.createFromFile(uploaded.url, uploaded.filename, mode);
      navigate(`/t/${job.job_id}/processing`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Upload failed. Please try again."));
      setSubmitting(false);
      setProgress(null);
      setFileName(null);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!submitting) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !submitting) void handleFile(f);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-surface px-6 py-9 text-center transition-colors",
        dragging ? "border-accent bg-accent-soft" : "border-line-strong",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {progress === null ? (
        <>
          <div className="grid size-11 place-items-center rounded-full border border-line text-accent">
            <Upload className="size-5" />
          </div>
          <p className="text-sm text-ink">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-accent hover:underline"
            >
              Choose a video or audio file
            </button>{" "}
            or drop it here
          </p>
          <p className="text-xs text-ink-faint">
            MP4, WebM, MP3, M4A, WAV… · up to {MAX_UPLOAD_MB} MB
          </p>
        </>
      ) : (
        <div className="w-full max-w-sm">
          <p className="mb-2 truncate text-sm text-ink" title={fileName ?? ""}>
            {progress < 100 ? "Uploading" : "Starting transcript"} · {fileName}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
