from app.services.ai.rule_based import RuleBasedFormatter
from app.services.transcription.base import Segment


def _segs():
    return [
        Segment(0.0, 3.0, "hello everyone welcome back to the channel"),
        Segment(3.0, 6.0, "today  we we are going to talk about i think ai"),
    ]


def test_exact_mode_preserves_words():
    r = RuleBasedFormatter().format(_segs(), mode="exact", language="en")
    assert r.segments[0].text == "hello everyone welcome back to the channel"


def test_clean_mode_capitalizes_and_punctuates():
    r = RuleBasedFormatter().format(_segs(), mode="clean", language="en")
    assert r.segments[0].text.startswith("Hello everyone")
    assert r.segments[0].text.endswith(".")
    # wording preserved (same words, order)
    assert r.segments[0].text.lower().rstrip(".") == _segs()[0].text


def test_readable_mode_dedupes_immediate_repeats():
    r = RuleBasedFormatter().format(_segs(), mode="readable", language="en")
    assert "we we" not in r.segments[1].text.lower()
    assert " I " in f" {r.segments[1].text} "


def test_raw_text_is_captured():
    r = RuleBasedFormatter().format(_segs(), mode="clean", language="en")
    assert r.segments[0].raw_text == _segs()[0].text
