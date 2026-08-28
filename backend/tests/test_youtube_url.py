import pytest

from app.utils.youtube_url import (
    InvalidYouTubeURL,
    extract_video_id,
    is_valid_youtube_url,
)

VALID = [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"),
    ("http://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc", "dQw4w9WgXcQ"),
    ("youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
]

INVALID = [
    "",
    "   ",
    "not a url",
    "https://vimeo.com/12345",
    "https://www.youtube.com/watch?v=",
    "https://www.youtube.com/watch?x=abc",
    "https://youtu.be/",
    "https://www.youtube.com/watch?v=short",
    "https://example.com/watch?v=dQw4w9WgXcQ",
]


@pytest.mark.parametrize("url,expected", VALID)
def test_extract_valid(url, expected):
    assert extract_video_id(url) == expected
    assert is_valid_youtube_url(url)


@pytest.mark.parametrize("url", INVALID)
def test_extract_invalid(url):
    with pytest.raises(InvalidYouTubeURL):
        extract_video_id(url)
    assert not is_valid_youtube_url(url)
