import axios, { AxiosError } from "axios";
import type {
  AuthResponse,
  JobStatusOut,
  TranscriptDetail,
  TranscriptListResponse,
  ValidateResponse,
} from "./types";

const TOKEN_KEY = "transcriptai.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401 && getToken()) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("transcriptai:signout"));
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_NETWORK") return "Connection lost. We're trying to reconnect.";
    const detail = (err.response?.data as { detail?: string })?.detail;
    if (detail) return detail;
  }
  return fallback;
}

// ─── Endpoints ────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, full_name?: string) =>
    api.post<AuthResponse>("/auth/register", { email, password, full_name }).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<AuthResponse["user"]>("/auth/me").then((r) => r.data),
};

export const videoApi = {
  validate: (url: string) =>
    api.get<ValidateResponse>("/videos/validate", { params: { url } }).then((r) => r.data),
};

export const transcriptApi = {
  create: (youtube_url: string, accuracy_mode: string, language?: string | null) =>
    api
      .post<JobStatusOut>("/transcripts", { youtube_url, accuracy_mode, language: language || null })
      .then((r) => r.data),
  createFromFile: (file_url: string, filename: string, accuracy_mode: string) =>
    api
      .post<JobStatusOut>("/transcripts", { file_url, filename, accuracy_mode })
      .then((r) => r.data),
  jobStatus: (jobId: string) =>
    api.get<JobStatusOut>(`/transcripts/${jobId}/status`).then((r) => r.data),
  get: (id: string) => api.get<TranscriptDetail>(`/transcripts/${id}`).then((r) => r.data),
  update: (
    id: string,
    segments: { order_index: number; speaker: string | null; start_time: number; end_time: number; text: string }[],
  ) => api.put<TranscriptDetail>(`/transcripts/${id}`, { segments }).then((r) => r.data),
  list: (params: { page?: number; page_size?: number; q?: string; language?: string; filter?: string }) =>
    api.get<TranscriptListResponse>("/transcripts", { params }).then((r) => r.data),
  remove: (id: string) => api.delete(`/transcripts/${id}`).then(() => undefined),
  exportUrl: (id: string, format: string, opts?: { timestamps?: boolean; variant?: string }) => {
    const p = new URLSearchParams({ format });
    if (opts?.timestamps === false) p.set("timestamps", "false");
    if (opts?.variant) p.set("variant", opts.variant);
    return `/api/v1/transcripts/${id}/export?${p.toString()}`;
  },
  downloadExport: async (id: string, format: string, opts?: { timestamps?: boolean; variant?: string }) => {
    const res = await api.get(transcriptApi.exportUrl(id, format, opts).replace("/api/v1", ""), {
      responseType: "blob",
    });
    const disposition = res.headers["content-disposition"] as string | undefined;
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `transcript.${format}`;
    const blobUrl = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  },
};

export const adminApi = {
  stats: () => api.get("/admin/stats").then((r) => r.data),
  jobs: (status = "all") => api.get("/admin/jobs", { params: { status } }).then((r) => r.data),
  retry: (id: string) => api.post(`/admin/jobs/${id}/retry`).then((r) => r.data),
  remove: (id: string) => api.delete(`/admin/jobs/${id}`),
};
