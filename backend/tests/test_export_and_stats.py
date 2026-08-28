import json

from app.services.export_service import (
    ExportBundle,
    ExportSegment,
    ExportWord,
    export,
)
from app.services.stats_service import compute_stats
from app.services.transcription.base import Segment


def _bundle():
    segs = [
        ExportSegment(0, 1.0, 4.0, "Hello everyone.", words=[ExportWord("Hello", 1.0, 1.4)]),
        ExportSegment(1, 4.0, 7.5, "Today we discuss AI.", speaker="Speaker 1"),
    ]
    return ExportBundle(
        title="Test Video",
        video_id="abc123DEF45",
        url="https://www.youtube.com/watch?v=abc123DEF45",
        channel="Chan",
        language="en",
        duration_seconds=7.5,
        segments=segs,
        full_text="Hello everyone.\n\nToday we discuss AI.",
        stats={"words": 5},
    )


def test_srt_format():
    out = export(_bundle(), "srt").content.decode()
    assert "1\n00:00:01,000 --> 00:00:04,000\nHello everyone." in out
    assert "Speaker 1: Today we discuss AI." in out


def test_vtt_format():
    out = export(_bundle(), "vtt").content.decode()
    assert out.startswith("WEBVTT")
    assert "00:00:04.000 --> 00:00:07.500" in out


def test_json_format():
    out = json.loads(export(_bundle(), "json").content)
    assert out["video"]["id"] == "abc123DEF45"
    assert len(out["segments"]) == 2
    assert out["words"][0]["word"] == "Hello"


def test_csv_txt_docx_pdf_smoke():
    b = _bundle()
    assert b"index,start,end" in export(b, "csv").content
    assert export(b, "txt", include_timestamps=False).content.strip().endswith(b"AI.")
    assert export(b, "docx").content[:2] == b"PK"  # zip magic
    assert export(b, "pdf").content[:4] == b"%PDF"


def test_stats():
    segs = [
        Segment(0.0, 3.0, "Hello world this is a test."),
        Segment(3.0, 6.0, "Another sentence here!"),
    ]
    full = "Hello world this is a test.\n\nAnother sentence here!"
    s = compute_stats(segs, full, 6.0)
    assert s["words"] == 9
    assert s["sentences"] == 2
    assert s["paragraphs"] == 2
    assert s["speaking_time_seconds"] == 6.0
