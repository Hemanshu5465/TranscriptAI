export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type AccuracyMode = "exact" | "clean" | "readable";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface VideoOut {
  id: string;
  source_type: "youtube" | "upload";
  youtube_video_id: string | null;
  url: string;
  source_url: string | null;
  original_filename: string | null;
  content_type: string | null;
  title: string | null;
  channel: string | null;
  duration_seconds: number | null;
  language: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
}

export interface WordOut {
  word: string;
  start_time: number;
  end_time: number;
  confidence: number | null;
}

export interface SegmentOut {
  id: string;
  order_index: number;
  speaker: string | null;
  start_time: number;
  end_time: number;
  text: string;
  raw_text: string | null;
  edited_text: string | null;
  confidence: number | null;
  words: WordOut[];
}

export interface TranscriptStats {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  segments: number;
  duration_seconds: number | null;
  speaking_time_seconds: number | null;
  speaking_pace_wpm: number | null;
  reading_time_minutes: number | null;
  speaker_count: number;
}

export interface JobStatusOut {
  job_id: string;
  transcript_id: string;
  status: JobStatus;
  stage: string;
  progress: number;
  error: string | null;
}

export interface TranscriptDetail {
  id: string;
  status: JobStatus;
  stage: string;
  progress: number;
  error: string | null;
  accuracy_mode: AccuracyMode;
  provider: string | null;
  source: string | null;
  language: string | null;
  language_confidence: number | null;
  has_word_timestamps: boolean;
  has_speaker_labels: boolean;
  raw_text: string | null;
  clean_text: string | null;
  edited_text: string | null;
  stats: TranscriptStats | null;
  video: VideoOut;
  segments: SegmentOut[];
  created_at: string;
  updated_at: string;
}

export interface TranscriptListItem {
  id: string;
  status: JobStatus;
  language: string | null;
  accuracy_mode: AccuracyMode;
  created_at: string;
  source_type: "youtube" | "upload";
  title: string | null;
  channel: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  word_count: number;
}

export interface TranscriptListResponse {
  items: TranscriptListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ValidateResponse {
  valid: boolean;
  video_id: string | null;
  canonical_url: string | null;
  reason: string | null;
}

export const STAGE_LABELS: Record<string, string> = {
  validate_url: "Validate URL",
  fetch_metadata: "Retrieve video details",
  retrieve_transcript: "Retrieve available transcript",
  speech_recognition: "Speech recognition",
  detect_language: "Detect language",
  build_segments: "Add timestamps",
  format_transcript: "Format transcript",
  complete: "Complete",
};

export const STAGE_ORDER = Object.keys(STAGE_LABELS);
