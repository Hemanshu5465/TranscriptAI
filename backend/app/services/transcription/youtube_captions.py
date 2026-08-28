"""Provider: YouTube's own caption track via ``youtube-transcript-api``.

Uses captions the uploader (or YouTube's ASR) already published. No key, no
audio download. Sentence-level timing only; no word timestamps or diarization.
"""
from __future__ import annotations

import logging
import re

from app.services.transcription.base import (
    ProviderUnavailable,
    Segment,
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSourceNotFound,
)

logger = logging.getLogger(__name__)

_TAG_RE = re.compile(r"<[^>]+>")
_BRACKET_NOISE_RE = re.compile(r"^\[(music|applause|laughter)\]$", re.IGNORECASE)


def _clean_snippet(text: str) -> str:
    text = _TAG_RE.sub("", text)
    text = text.replace("\n", " ").replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


class YouTubeCaptionsProvider(TranscriptionProvider):
    name = "youtube_captions"

    def is_available(self) -> bool:
        try:
            import youtube_transcript_api  # noqa: F401

            return True
        except ImportError:  # pragma: no cover
            return False

    @staticmethod
    def _proxy_config():
        """Return a youtube-transcript-api ProxyConfig if one is configured."""
        from app.config.settings import settings

        if settings.webshare_proxy_username and settings.webshare_proxy_password:
            from youtube_transcript_api.proxies import WebshareProxyConfig

            return WebshareProxyConfig(
                proxy_username=settings.webshare_proxy_username,
                proxy_password=settings.webshare_proxy_password,
            )
        if settings.http_proxy_url:
            from youtube_transcript_api.proxies import GenericProxyConfig

            return GenericProxyConfig(
                http_url=settings.http_proxy_url,
                https_url=settings.https_proxy_url or settings.http_proxy_url,
            )
        return None

    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            CouldNotRetrieveTranscript,
            NoTranscriptFound,
            TranscriptsDisabled,
            VideoUnavailable,
        )

        api = YouTubeTranscriptApi(proxy_config=self._proxy_config())
        languages = [*request.preferred_languages, "en"]

        try:
            transcript_list = api.list(request.video_id)
            transcript = self._pick_transcript(transcript_list, request.preferred_languages)
            fetched = transcript.fetch()
            language = transcript.language_code
            is_generated = transcript.is_generated
        except (NoTranscriptFound, TranscriptsDisabled):
            raise TranscriptSourceNotFound(
                "No permitted transcript or media source is available for this video."
            )
        except VideoUnavailable:
            raise ProviderUnavailable("This video is unavailable or cannot be accessed.")
        except CouldNotRetrieveTranscript as exc:
            # IpBlocked / RequestBlocked / PoTokenRequired all subclass this.
            logger.warning("youtube-transcript-api could not retrieve %s: %s", request.video_id, exc)
            raise ProviderUnavailable(
                "YouTube declined the transcript request from this network. "
                "Set SUPADATA_API_KEY (free at supadata.ai) or a proxy to fix this."
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Unexpected youtube-transcript-api failure")
            raise ProviderUnavailable(str(exc))

        segments: list[Segment] = []
        for snippet in fetched:
            text = _clean_snippet(snippet.text)
            if not text or _BRACKET_NOISE_RE.match(text):
                continue
            start = float(snippet.start)
            end = start + float(snippet.duration or 0.0)
            segments.append(Segment(start=start, end=max(end, start + 0.5), text=text))

        if not segments:
            raise TranscriptSourceNotFound(
                "No permitted transcript or media source is available for this video."
            )

        return TranscriptionResult(
            segments=segments,
            language=language,
            language_confidence=0.99 if not is_generated else 0.9,
            provider=self.name,
            source="youtube_captions",
            has_word_timestamps=False,
            has_speaker_labels=False,
        )

    @staticmethod
    def _pick_transcript(transcript_list, preferred: list[str]):
        from youtube_transcript_api._errors import NoTranscriptFound

        langs = [*preferred, "en"]
        try:
            return transcript_list.find_manually_created_transcript(langs)
        except NoTranscriptFound:
            pass
        try:
            return transcript_list.find_generated_transcript(langs)
        except NoTranscriptFound:
            pass
        # Fall back to whatever exists, translating to the first preferred language.
        for transcript in transcript_list:
            if transcript.is_translatable and preferred:
                try:
                    return transcript.translate(preferred[0])
                except Exception:  # noqa: BLE001
                    return transcript
            return transcript
        raise NoTranscriptFound(transcript_list.video_id, langs, transcript_list)
