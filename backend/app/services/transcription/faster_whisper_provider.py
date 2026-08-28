"""Provider: download audio with yt-dlp, transcribe locally with faster-whisper.

Gives word-level timestamps. Disabled unless ``ENABLE_AUDIO_FALLBACK=true`` and
the optional dependencies (``faster-whisper``, ``yt-dlp``) plus ``ffmpeg`` are
installed. Only use on media you are authorized to process.
"""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from app.config.settings import settings
from app.services.transcription.base import (
    ProviderUnavailable,
    Segment,
    TranscriptionProvider,
    TranscriptionRequest,
    TranscriptionResult,
    Word,
)

logger = logging.getLogger(__name__)


class FasterWhisperProvider(TranscriptionProvider):
    name = "faster_whisper"

    def is_available(self) -> bool:
        if not settings.enable_audio_fallback:
            return False
        try:
            import faster_whisper  # noqa: F401
            import yt_dlp  # noqa: F401

            return True
        except ImportError:
            return False

    def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        if not settings.enable_audio_fallback:
            raise ProviderUnavailable(
                "Audio transcription is disabled. Set ENABLE_AUDIO_FALLBACK=true to enable it."
            )
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover
            raise ProviderUnavailable(
                "faster-whisper is not installed (pip install -r requirements-optional.txt)."
            ) from exc

        with tempfile.TemporaryDirectory(dir=settings.media_dir) as tmp:
            audio_path = self._download_audio(request.canonical_url, Path(tmp))
            model = WhisperModel(
                settings.whisper_model,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
            seg_iter, info = model.transcribe(
                str(audio_path),
                word_timestamps=True,
                vad_filter=True,
                language=(request.preferred_languages or [None])[0] or None,
            )

            segments: list[Segment] = []
            for order, s in enumerate(seg_iter):
                words = [
                    Word(text=w.word.strip(), start=float(w.start), end=float(w.end),
                         confidence=getattr(w, "probability", None))
                    for w in (s.words or [])
                    if w.word and w.word.strip()
                ]
                segments.append(
                    Segment(
                        start=float(s.start),
                        end=float(s.end),
                        text=s.text.strip(),
                        confidence=_avg([w.confidence for w in words]),
                        words=words,
                    )
                )

        if not segments:
            raise ProviderUnavailable("Whisper produced no speech segments for this audio.")

        return TranscriptionResult(
            segments=segments,
            language=info.language,
            language_confidence=float(getattr(info, "language_probability", 0.0)) or None,
            provider=self.name,
            source="audio_whisper",
            has_word_timestamps=True,
            has_speaker_labels=False,
        )

    @staticmethod
    def _download_audio(url: str, out_dir: Path) -> Path:
        import yt_dlp

        target = out_dir / "audio.%(ext)s"
        opts = {
            "format": "bestaudio/best",
            "outtmpl": str(target),
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "postprocessors": [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "128"}
            ],
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
        except Exception as exc:  # noqa: BLE001
            raise ProviderUnavailable(
                "Could not retrieve a permitted media source for this video."
            ) from exc

        for candidate in out_dir.glob("audio.*"):
            return candidate
        raise ProviderUnavailable("Audio download did not produce a file.")


def _avg(values: list[float | None]) -> float | None:
    nums = [v for v in values if v is not None]
    return sum(nums) / len(nums) if nums else None
