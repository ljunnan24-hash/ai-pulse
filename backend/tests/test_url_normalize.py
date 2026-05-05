from app.services.url_normalize import normalize_event_source_url, source_type_trust_rank


def test_normalize_strips_tracking_and_fragment():
    u = "HTTPS://Example.COM/foo/bar/?utm_source=x&ref=y&keep=1#frag"
    out = normalize_event_source_url(u)
    assert "utm_" not in out
    assert "#" not in out
    assert out.endswith("keep=1") or "keep=1" in out
    assert out.startswith("https://example.com")


def test_normalize_empty():
    assert normalize_event_source_url("") == ""
    assert normalize_event_source_url(None) == ""


def test_trust_rank_order():
    assert source_type_trust_rank("official") > source_type_trust_rank("rss")
    assert source_type_trust_rank("unknown") == 0
