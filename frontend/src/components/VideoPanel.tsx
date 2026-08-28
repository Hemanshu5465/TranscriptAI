import { ExternalLink } from "lucide-react";
import type { RefObject } from "react";
import type { VideoOut } from "../lib/types";
import { humanDuration, languageName } from "../lib/format";
import { youtubeThumb } from "../lib/youtube";

interface Props {
  video: VideoOut;
  language?: string | null;
  languageConfidence?: number | null;
  playerRef?: RefObject<HTMLDivElement | null>;
  playerReady?: boolean;
}

export function VideoPanel({ video, language, languageConfidence, playerRef, playerReady }: Props) {
  const thumb = video.thumbnail_url ?? youtubeThumb(video.youtube_video_id);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-video bg-surface-sunken">
        {playerRef ? (
          <>
            <div ref={playerRef} className="absolute inset-0 size-full [&>iframe]:size-full" />
            {!playerReady && (
              <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" />
            )}
          </>
        ) : (
          <img src={thumb} alt={video.title ?? "Video thumbnail"} className="size-full object-cover" />
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-display text-[1.05rem] leading-snug">
            {video.title ?? `YouTube · ${video.youtube_video_id}`}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">{video.channel ?? "Unknown channel"}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Meta label="Duration" value={humanDuration(video.duration_seconds)} />
          <Meta
            label="Language"
            value={
              language
                ? `${languageName(language)}${
                    languageConfidence ? ` · ${Math.round(languageConfidence * 100)}%` : ""
                  }`
                : "—"
            }
          />
          {video.published_at && (
            <Meta
              label="Published"
              value={new Date(video.published_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            />
          )}
          <Meta label="Video ID" value={video.youtube_video_id} mono />
        </dl>

        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent"
        >
          Open on YouTube <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[0.7rem] uppercase tracking-widest text-ink-faint">{label}</dt>
      <dd className={mono ? "font-mono text-[0.8rem] text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}
