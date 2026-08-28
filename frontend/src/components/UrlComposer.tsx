import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Link2, TriangleAlert } from "lucide-react";
import { Button } from "./Button";
import { transcriptApi, apiErrorMessage } from "../lib/api";
import { isValidYouTubeUrl } from "../lib/youtube";
import { toast } from "../hooks/useToast";
import type { AccuracyMode } from "../lib/types";
import { cn } from "../lib/cn";

const MODES: { value: AccuracyMode; label: string; hint: string }[] = [
  { value: "exact", label: "Exact", hint: "Preserve detected words verbatim" },
  { value: "clean", label: "Clean", hint: "Punctuation & formatting, wording kept" },
  { value: "readable", label: "Readable", hint: "Also fix obvious transcription slips" },
];

export function UrlComposer({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<AccuracyMode>("clean");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

      {invalid && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-accent">
          <TriangleAlert className="size-3.5" /> That doesn't look like a YouTube link.
        </p>
      )}
    </form>
  );
}
