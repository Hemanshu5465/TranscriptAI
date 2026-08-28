import { useQuery } from "@tanstack/react-query";
import { transcriptApi } from "../lib/api";
import type { JobStatusOut, TranscriptDetail } from "../lib/types";

export function useJobStatus(jobId: string | undefined, enabled = true) {
  return useQuery<JobStatusOut>({
    queryKey: ["job", jobId],
    queryFn: () => transcriptApi.jobStatus(jobId!),
    enabled: Boolean(jobId) && enabled,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "completed" || s === "failed" ? false : 1200;
    },
  });
}

export function useTranscript(id: string | undefined, opts?: { poll?: boolean }) {
  return useQuery<TranscriptDetail>({
    queryKey: ["transcript", id],
    queryFn: () => transcriptApi.get(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      if (!opts?.poll) return false;
      const s = query.state.data?.status;
      return s === "completed" || s === "failed" ? false : 1500;
    },
  });
}
