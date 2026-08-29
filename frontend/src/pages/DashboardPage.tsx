import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileVideo, Mic, Search, Trash2 } from "lucide-react";
import { UrlComposer } from "../components/UrlComposer";
import { EmptyState, Skeleton } from "../components/States";
import { useAuth } from "../store/auth";
import { transcriptApi, apiErrorMessage } from "../lib/api";
import { toast } from "../hooks/useToast";
import { useDebounce } from "../hooks/useDebounce";
import { compactNumber, humanDuration, languageName, relativeTime } from "../lib/format";
import { cn } from "../lib/cn";
import type { TranscriptListItem } from "../lib/types";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "recent", label: "Recent" },
  { key: "en", label: "English" },
  { key: "hi", label: "Hindi" },
  { key: "gu", label: "Gujarati" },
];

export function DashboardPage() {
  const { status } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [rawQuery, setRawQuery] = useState("");
  const q = useDebounce(rawQuery, 300);

  const list = useQuery({
    queryKey: ["transcripts", filter, q],
    queryFn: () =>
      transcriptApi.list({
        q: q || undefined,
        filter: filter === "recent" ? "recent" : "all",
        language: ["en", "hi", "gu"].includes(filter) ? filter : undefined,
        page_size: 30,
      }),
    enabled: status === "authed",
  });

  const del = useMutation({
    mutationFn: (id: string) => transcriptApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transcripts"] });
      toast.success("Transcript deleted");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't delete that transcript.")),
  });

  if (status === "anon") return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl">Your workspace</h1>
      <p className="mt-1 text-sm text-ink-soft">Paste a link to start a new transcript.</p>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <UrlComposer />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg">Recent transcripts</h2>
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
          <Search className="size-3.5 text-ink-faint" />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search transcripts…"
            aria-label="Search your transcripts"
            className="w-40 bg-transparent text-sm outline-none placeholder:text-ink-faint sm:w-56"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-ink bg-ink text-paper"
                : "border-line text-ink-soft hover:text-ink",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {list.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}

        {list.data?.items.length === 0 && (
          <EmptyState
            icon={<Mic className="size-6" />}
            title="No transcripts yet"
            description="Paste a YouTube URL above to generate your first transcript."
          />
        )}

        {list.data?.items.map((t) => (
          <TranscriptCard
            key={t.id}
            item={t}
            deleting={del.isPending && del.variables === t.id}
            onDelete={() => del.mutate(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TranscriptCard({
  item,
  onDelete,
  deleting,
}: {
  item: TranscriptListItem;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const thumb = item.thumbnail_url ?? "";
  const isUpload = item.source_type === "upload";

  return (
    <div className="group relative flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-ink-faint">
      <Link
        to={item.status === "completed" ? `/t/${item.id}` : `/t/${item.id}/processing`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken text-ink-faint sm:w-36">
          {isUpload ? (
            <FileVideo className="size-6" />
          ) : (
            thumb && <img src={thumb} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[1.02rem]">{item.title ?? "Untitled"}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {isUpload ? "Uploaded file" : item.channel ?? "—"}
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-ink-faint">
            <span>{humanDuration(item.duration_seconds)}</span>
            <span>·</span>
            <span>{languageName(item.language)}</span>
            <span>·</span>
            <span>{compactNumber(item.word_count)} words</span>
            <span>·</span>
            <span>{relativeTime(item.created_at)}</span>
          </p>
        </div>
      </Link>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-[var(--color-accent-ink)] disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Delete transcript "${item.title ?? "Untitled"}"`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-faint opacity-0 transition-opacity hover:bg-surface-sunken hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}
