import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useJobStatus } from "../hooks/useTranscriptData";
import { useTranscript } from "../hooks/useTranscriptData";
import { ProgressBar, StageChecklist } from "../components/StageChecklist";
import { VideoPanel } from "../components/VideoPanel";
import { ErrorState, Skeleton } from "../components/States";
import { Button } from "../components/Button";
import { STAGE_LABELS } from "../lib/types";

export function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const job = useJobStatus(jobId);
  const detail = useTranscript(jobId, { poll: true });

  const status = job.data?.status;

  useEffect(() => {
    if (status === "completed") {
      const t = setTimeout(() => navigate(`/t/${jobId}`, { replace: true }), 650);
      return () => clearTimeout(t);
    }
  }, [status, jobId, navigate]);

  const failed = status === "failed";
  const stage = job.data?.stage ?? "validate_url";
  const progress = failed ? job.data?.progress ?? 0 : job.data?.progress ?? 4;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-5">
          {detail.data?.video ? (
            <VideoPanel video={detail.data.video} language={detail.data.language} />
          ) : (
            <div className="flex gap-4">
              <Skeleton className="aspect-video w-40 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5">
          {failed ? (
            <ErrorState
              title="We couldn't generate the transcript"
              description={job.data?.error ?? "Something went wrong. Please try again."}
              action={
                <Button variant="secondary" size="sm" onClick={() => navigate("/")}>
                  Start over
                </Button>
              }
            />
          ) : (
            <>
              <div className="mb-4 flex items-baseline justify-between">
                <p className="text-sm font-medium">
                  {status === "completed" ? "Done — opening transcript…" : `${STAGE_LABELS[stage] ?? "Working"}…`}
                </p>
                <span className="font-mono text-sm text-ink-faint">{progress}%</span>
              </div>
              <ProgressBar value={progress} />
              <div className="mt-5">
                <StageChecklist stage={stage} />
              </div>
            </>
          )}
        </div>
      </div>

      {job.isError && (
        <p className="mt-4 text-center text-sm text-accent">
          Lost connection to the job. Retrying…
        </p>
      )}
    </div>
  );
}
