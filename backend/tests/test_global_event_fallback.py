from app.services.global_event_service import _cap_plain


def test_cap_plain_removes_rss_html_and_decodes_entities() -> None:
    raw = '<p>NVIDIA &amp; partners ship tools.</p><p>More [&#8230;]</p>'
    assert _cap_plain(raw, 200) == "NVIDIA & partners ship tools. More […]"
