import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranscript } from "../hooks/useTranscriptData";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { VideoPanel } from "../components/VideoPanel";
import { StatsPanel } from "../components/StatsPanel";
import { TranscriptWorkspace } from "../components/TranscriptWorkspace";
import { ErrorState, Skeleton } from "../components/States";
import { apiErrorMessage } from "../lib/api";

export function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useTranscript(id, { poll: true });
  const player = useYouTubePlayer(data?.video.youtube_video_id);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[20rem_1fr] sm:px-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-16">
        <ErrorState
          title="This transcript couldn't be loaded"
          description={apiErrorMessage(error, "It may have been removed.")}
          action={
            <Link to="/" className="text-sm text-accent hover:underline">
              Back to home
            </Link>
          }
        />
      </div>
    );
  }

  if (data.status !== "completed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ink-soft">
          {data.status === "failed"
            ? data.error ?? "This transcript failed to generate."
            : "This transcript is still processing…"}
        </p>
        <Link
          to={`/t/${data.id}/processing`}
          className="mt-3 inline-block text-sm text-accent hover:underline"
        >
          View progress
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-0 sm:px-6">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-0">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All transcripts
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
        <aside className="space-y-4 px-4 sm:px-0 lg:sticky lg:top-20">
          <VideoPanel
            video={data.video}
            language={data.language}
            languageConfidence={data.language_confidence}
            playerRef={player.containerRef}
            playerReady={player.ready}
          />
          <StatsPanel stats={data.stats} />
        </aside>

        <section className="overflow-hidden border-y border-line bg-surface sm:rounded-2xl sm:border">
          <div className="h-[calc(100dvh-9rem)]">
            <TranscriptWorkspace
              transcript={data}
              currentTime={player.currentTime}
              onSeek={player.seekTo}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
