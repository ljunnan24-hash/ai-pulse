"""排行榜 q 参数与 LIKE 模式辅助逻辑测试。"""

from app.services.rankings_search_utils import normalize_rankings_q, sql_like_pattern


def test_normalize_q_trim_and_cap():
    assert normalize_rankings_q(None) is None
    assert normalize_rankings_q("") is None
    assert normalize_rankings_q("   ") is None
    assert normalize_rankings_q(" 教育 ") == "教育"
    long_q = "a" * 100
    assert len(normalize_rankings_q(long_q) or "") == 60


def test_sql_like_pattern_escapes():
    p = sql_like_pattern("100%")
    assert "\\%" in p
    p2 = sql_like_pattern("a_b")
    assert "\\_" in p2
