"""
确定性 Top3 筛选：重要 + 可信 + 不重复 + 类型分散（不依赖 LLM 选 Top3）。
在 EventCards 之后、Composer 之前调用；Composer 仅润色文案，顺序与 URL 由本模块锁定。
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse
from urllib.parse import urlencode as urlencode_query

from app.services.digest_builder import classify_item_section

_SECTION_CN_TO_SLUG = {
    "大模型更新": "model_update",
    "工具/产品": "tool_product",
    "行业动态": "industry",
}

_SOURCE_TRUST_SCORE: dict[str, float] = {
    "official": 92.0,
    "media": 78.0,
    "github": 72.0,
    "community": 58.0,
    "social": 42.0,
    "rss": 68.0,
    "event": 65.0,
}

# Impact Analyst：用户价值（非技术读者）
_AUDIENCE_TYPES = frozenset(
    {"general_user", "founder", "manager", "student", "developer", "enterprise"}
)
_ACTIONABILITY_TYPES = frozenset({"now_try", "watch", "ignore", "not_for_general_user"})

_USER_VALUE_GATE_MIN = 55.0

_TECH_LIB_PAT = re.compile(
    r"(benchmark|基准测试|开源框架|\blibrary\b|\bsdk\b|pytorch|tensorflow|cuda|kernel|npm i\b|pip install|git clone|"
    r"纯技术|论文复现)",
    re.I,
)
_FUNDING_NO_ACTION_PAT = re.compile(r"(融资|亿元|万美元|轮融资|估值|IPO|并购)", re.I)
_USER_VALUE_SIGNAL_PAT = re.compile(
    r"(可试用|免费|注册|下载|App|小程序|网页版|开放体验|立即使用|节省|提效|替代人工|办公|写作|画图|普通用户|无需代码)",
    re.I,
)
_PRODUCT_USER_PAT = re.compile(
    r"(发布|上线|推出|新版|开放注册|ChatGPT|Claude|Gemini|豆包|通义|文心)", re.I,
)


def normalize_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    blocked_params = {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
        "source",
    }
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k.lower() not in blocked_params]
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc.lower(),
            parsed.path.rstrip("/"),
            "",
            urlencode_query(query),
            "",
        )
    )


def title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


# ----- Weekly Top3：主题签名去重（弱化「仅标题 ≥0.82」导致的同源多稿占满 Top3）-----

_TITLE_SIM_HIGH = 0.82
_TITLE_SIM_MED = 0.62

_PUB_WINDOW_HOURS = 7 * 24  # time_window：默认 7 天

# 公司 / 平台实体（小写归一）
_ENTITY_PATTERN = re.compile(
    r"\b(openai|chatgpt|anthropic|claude|gemini|google|deepmind|meta|llama|aws|bedrock|azure|microsoft|"
    r"copilot|nvidia|github)\b",
    re.I,
)

# 模型 / 产品线
_GPT_NUMERIC_RE = re.compile(r"gpt[\s\-]*5[\.\s]*5(?:\s+instant\b)?|gpt[\s\-]*5[\.\s]*5\b", re.I)
_INSTANT_RE = re.compile(r"\binstant\b", re.I)
_AGENT_RE = re.compile(r"\bagents?\b|\bworkflow\b|\bmcp\b", re.I)

# action_family：同一稿件可命中多个标签（用于冲突与兼容判断）
_ACTION_FAMILY_RULES: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"release|launch|announce|ships?|rolls?\s+out|默认模型|模型发布|模型升级|default\s+model|new\s+default|"
            r"发布\s*gpt",
            re.I,
        ),
        "model_release_default",
    ),
    (
        re.compile(
            r"hallucin|幻觉|准确率|accura|smarter|clearer|personalized|capabilities?|推理能力|多模态能力|"
            r"reasoning|multimodal",
            re.I,
        ),
        "quality_capability",
    ),
    (
        re.compile(
            r"API\s*价格|价格变化|定价|降价|pricing|\bcost\b|\$\d|美元\/百万|per\s+million|调价",
            re.I,
        ),
        "pricing_cost",
    ),
    (
        re.compile(
            r"\bagent\b|智能体|工作流|workflow|automation|企业\s*agent|工具更新|\bmcp\b",
            re.I,
        ),
        "agent_workflow",
    ),
    (re.compile(r"监管|政策|合规|regulation|compliance", re.I), "policy_regulation"),
    (re.compile(r"版权|诉讼|训练数据|lawsuit|copyright", re.I), "legal_copyright"),
    (re.compile(r"open\s*source|开源", re.I), "open_source"),
    (re.compile(r"benchmark|评测|基准测试", re.I), "benchmark_eval"),
]

# 明确冲突：命中任意无序对即禁止合并（即使标题相似）
_ACTION_CONFLICT_PAIRS: frozenset[frozenset[str]] = frozenset(
    {
        frozenset({"model_release_default", "pricing_cost"}),
        frozenset({"model_release_default", "agent_workflow"}),
        frozenset({"pricing_cost", "agent_workflow"}),
        frozenset({"legal_copyright", "model_release_default"}),
        frozenset({"policy_regulation", "model_release_default"}),
    }
)

_GPT55_STRONG_PRODUCT_TOKENS: frozenset[str] = frozenset(
    {"gpt55", "gpt55_line", "gpt_instant", "chatgpt"}
)
_GPT55_NARRATIVE_ACTIONS: frozenset[str] = frozenset({"model_release_default", "quality_capability"})


def normalize_text(s: str) -> str:
    t = (s or "").lower()
    t = re.sub(r"[^\w\u4e00-\u9fff\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _event_blob(ev: dict[str, Any]) -> str:
    return " ".join(
        [
            str(ev.get("title") or ""),
            str(ev.get("one_liner") or ""),
            str(ev.get("_text_blob") or ""),
            str(ev.get("summary") or ""),
        ]
    )


def extract_company_entities(text: str) -> set[str]:
    """company_entities：公司 / 平台标签（小写）。"""
    raw = text or ""
    out: set[str] = set()
    for m in _ENTITY_PATTERN.finditer(raw):
        out.add(m.group(1).lower())
    low = raw.lower()
    if "openai" in low:
        out.add("openai")
    if "anthropic" in low:
        out.add("anthropic")
    if "google" in low or "gemini" in low:
        out.add("google")
    if "meta" in low and "metadata" not in low:
        out.add("meta")
    if "amazon" in low or "aws" in low:
        out.add("aws")
    if "microsoft" in low or "azure" in low:
        out.add("microsoft")
    return out


def extract_product_tokens(text: str) -> set[str]:
    """product_tokens：产品线 / 模型名 / 接口类线索。"""
    raw = text or ""
    t = raw.lower()
    out: set[str] = set()
    if _GPT_NUMERIC_RE.search(raw):
        out.add("gpt55_line")
    if re.search(r"gpt[\s\-]*5[\.\s]*5", t):
        out.add("gpt55")
    if _INSTANT_RE.search(t) and ("gpt" in t or "chatgpt" in t or "5.5" in raw):
        out.add("gpt_instant")
    if "chatgpt" in t:
        out.add("chatgpt")
    if "openai" in t:
        out.add("openai_brand")
    if re.search(r"\bapi\b", raw, re.I) or "API" in raw:
        out.add("api")
    if _AGENT_RE.search(t):
        out.add("agent_stack")
    if "bedrock" in t:
        out.add("bedrock")
    if "claude" in t:
        out.add("claude")
    if "gemini" in t:
        out.add("gemini")
    if "copilot" in t:
        out.add("copilot")
    return out


def extract_action_families(text: str) -> set[str]:
    """action_family：事件动作轴（一条可对应多个 family）。"""
    raw = text or ""
    out: set[str] = set()
    for rx, tag in _ACTION_FAMILY_RULES:
        if rx.search(raw):
            out.add(tag)
    return out


def build_topic_axis(ev: dict[str, Any]) -> dict[str, Any]:
    """事件签名：company_entities / product_tokens / action_families + time_window（小时由调用方用 published_at 计算）。"""
    blob = _event_blob(ev)
    return {
        "company_entities": extract_company_entities(blob),
        "product_tokens": extract_product_tokens(blob),
        "action_families": extract_action_families(blob),
    }


def build_event_signature(ev: dict[str, Any]) -> tuple[set[str], set[str], set[str]]:
    """兼容旧调用：返回 (entities, products, actions)。"""
    axis = build_topic_axis(ev)
    return axis["company_entities"], axis["product_tokens"], axis["action_families"]


def extract_entities(text: str) -> set[str]:
    """别名：与 extract_company_entities 相同。"""
    return extract_company_entities(text)


def extract_event_action_tokens(text: str) -> set[str]:
    """别名：与 extract_action_families 相同。"""
    return extract_action_families(text)


def _parse_event_datetime(ev: dict[str, Any]) -> datetime | None:
    v = ev.get("published_at")
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str) and v.strip():
        try:
            dt = datetime.fromisoformat(v.strip().replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _within_publication_window(a: dict[str, Any], b: dict[str, Any], *, hours: float = _PUB_WINDOW_HOURS) -> bool:
    """二者均无发布时间时视为同期周报候选，不阻断签名合并。"""
    da = _parse_event_datetime(a)
    db = _parse_event_datetime(b)
    if da is None or db is None:
        return True
    dh = abs((da - db).total_seconds()) / 3600.0
    return dh <= hours


def _openai_chatgpt_ecosystem(entities: set[str], products: set[str]) -> bool:
    """同属 OpenAI / ChatGPT 产品线话语场（允许标题只有产品线没有公司名）。"""
    ent_hit = bool(entities & {"openai", "chatgpt"})
    prod_hit = bool(products & {"openai_brand", "chatgpt", "gpt55", "gpt55_line", "gpt_instant"})
    return ent_hit or prod_hit


def _action_families_conflict(fa: set[str], fb: set[str]) -> bool:
    if not fa or not fb:
        return False
    for x in fa:
        for y in fb:
            if frozenset({x, y}) in _ACTION_CONFLICT_PAIRS:
                return True
    return False


def _gpt55_model_narrative_cluster(
    a: dict[str, Any], b: dict[str, Any], blob_a: str, blob_b: str
) -> bool:
    """
    GPT-5.5 / Instant / ChatGPT 模型发布叙事特例：仅当强产品线信号 + 允许的动作轴 + 7 天窗口。
    不泛化为「所有 OpenAI 新闻」。
    """
    if not _within_publication_window(a, b):
        return False
    ea, eb = extract_company_entities(blob_a), extract_company_entities(blob_b)
    pa, pb = extract_product_tokens(blob_a), extract_product_tokens(blob_b)
    fa, fb = extract_action_families(blob_a), extract_action_families(blob_b)
    if not (_openai_chatgpt_ecosystem(ea, pa) and _openai_chatgpt_ecosystem(eb, pb)):
        return False
    if len((pa | pb) & _GPT55_STRONG_PRODUCT_TOKENS) < 2:
        return False
    if not fa or not fb:
        return False
    if not fa.issubset(_GPT55_NARRATIVE_ACTIONS) or not fb.issubset(_GPT55_NARRATIVE_ACTIONS):
        return False
    return True


def _aws_bedrock_agent_cluster(
    a: dict[str, Any],
    b: dict[str, Any],
    blob_a: str,
    blob_b: str,
    title_sim: float,
) -> bool:
    """Bedrock / Agent 垂直簇：仍需实体与产品线对齐且动作轴不冲突。"""
    if not _within_publication_window(a, b):
        return False
    ea, eb = extract_company_entities(blob_a), extract_company_entities(blob_b)
    pa, pb = extract_product_tokens(blob_a), extract_product_tokens(blob_b)
    fa, fb = extract_action_families(blob_a), extract_action_families(blob_b)
    if _action_families_conflict(fa, fb):
        return False
    if not (ea & eb & {"aws"}):
        return False
    if not (pa & pb & {"bedrock"}):
        return False
    if "agent_stack" not in pa and "agent_stack" not in pb:
        return False
    return bool(fa & fb) or title_sim >= 0.42


def is_same_topic_by_signature(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """
    签名级「同主题」：GPT-5.5 叙事特例、AWS Bedrock 簇、或实体∩产品线∩动作（动作须相交且不冲突）。
    """
    blob_a = _event_blob(a)
    blob_b = _event_blob(b)
    ts = title_similarity(str(a.get("title", "")), str(b.get("title", "")))

    if _gpt55_model_narrative_cluster(a, b, blob_a, blob_b):
        return True
    if _aws_bedrock_agent_cluster(a, b, blob_a, blob_b, ts):
        return True

    ea, eb = extract_company_entities(blob_a), extract_company_entities(blob_b)
    pa, pb = extract_product_tokens(blob_a), extract_product_tokens(blob_b)
    fa, fb = extract_action_families(blob_a), extract_action_families(blob_b)
    if not _within_publication_window(a, b):
        return False
    if _action_families_conflict(fa, fb):
        return False
    if ea & eb and pa & pb and fa & fb:
        return True
    return False


def is_duplicate_event(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """分层判重：stable_key / URL → 高标题相似 → GPT-5.5 叙事特例 → 保守中档相似 + 签名交集。"""
    sk_a = str(a.get("stable_key") or "").strip()
    sk_b = str(b.get("stable_key") or "").strip()
    if sk_a and sk_b and sk_a == sk_b:
        return True

    url_a = normalize_url(str(a.get("url", "")))
    url_b = normalize_url(str(b.get("url", "")))
    if url_a and url_b and url_a == url_b:
        return True

    cu_a = normalize_url(str(a.get("canonical_url") or ""))
    cu_b = normalize_url(str(b.get("canonical_url") or ""))
    if cu_a and cu_b and cu_a == cu_b:
        return True

    title_a = str(a.get("title", ""))
    title_b = str(b.get("title", ""))
    ts = title_similarity(title_a, title_b)

    blob_a = _event_blob(a)
    blob_b = _event_blob(b)
    fa = extract_action_families(blob_a)
    fb = extract_action_families(blob_b)

    if ts >= _TITLE_SIM_HIGH:
        return True

    if _action_families_conflict(fa, fb):
        return False

    if _gpt55_model_narrative_cluster(a, b, blob_a, blob_b):
        return True

    if is_same_topic_by_signature(a, b):
        return True

    ea = extract_company_entities(blob_a)
    eb = extract_company_entities(blob_b)
    pa = extract_product_tokens(blob_a)
    pb = extract_product_tokens(blob_b)
    ent_ov = ea & eb
    prod_ov = pa & pb

    if ts >= _TITLE_SIM_MED and ent_ov and prod_ov and fa and fb and not _action_families_conflict(fa, fb) and (fa & fb):
        return True

    if _aws_bedrock_agent_cluster(a, b, blob_a, blob_b, ts):
        return True

    return False


def merge_top3_duplicate_into(keeper: dict[str, Any], dup: dict[str, Any]) -> None:
    """将重复候选合并进已入选条目：多 URL / event_id，择优中文标题。"""
    ku = normalize_url(str(keeper.get("url") or ""))
    du = str(dup.get("url") or "").strip()
    if du:
        nu = normalize_url(du)
        merged_urls = keeper.setdefault("_top3_merged_urls", [])
        if nu != ku and du not in merged_urls:
            merged_urls.append(du[:2048])

    keid = str(keeper.get("event_id") or "").strip()
    deid = str(dup.get("event_id") or "").strip()
    if deid and deid != keid:
        mids = keeper.setdefault("_top3_merged_event_ids", [])
        if deid not in mids:
            mids.append(deid)

    sk = str(dup.get("stable_key") or "").strip()
    if sk:
        sks = keeper.setdefault("_top3_merged_stable_keys", [])
        if sk not in sks:
            sks.append(sk)

    kt = str(keeper.get("title") or "")
    dt = str(dup.get("title") or "")

    def _cjk_n(s: str) -> int:
        return len(re.findall(r"[\u4e00-\u9fff]", s))

    if _cjk_n(dt) > _cjk_n(kt) and _cjk_n(dt) >= 4:
        keeper["title"] = dt[:512]
    elif _cjk_n(dt) >= _cjk_n(kt) and len(dt) > len(kt) + 6:
        keeper["title"] = dt[:512]

    ko = str(keeper.get("one_liner") or "")
    d_o = str(dup.get("one_liner") or "")
    if len(d_o) > len(ko) + 20:
        keeper["one_liner"] = d_o[:800]

    kb = str(keeper.get("_text_blob") or "")
    db = str(dup.get("_text_blob") or "")
    if len(db) > len(kb) + 40:
        keeper["_text_blob"] = db[:1200]


_CJK_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")


def contains_cjk(text: str | None) -> bool:
    """标题/文案是否含中日韩统一表意文字（用于中文标题优先）。"""
    return bool(_CJK_CHAR_RE.search(text or ""))


def _dedupe_urls_ordered(primary: str | None, extras: list[str], *, max_n: int = 8) -> list[str]:
    """主 URL 在前；按 normalize_url 去重；过滤空值。"""
    seen: set[str] = set()
    out: list[str] = []

    def consider(raw: str) -> None:
        raw = raw.strip()
        if not raw:
            return
        nu = normalize_url(raw)
        if not nu or nu in seen:
            return
        seen.add(nu)
        out.append(raw[:2048])

    if primary:
        consider(str(primary))
    for x in extras:
        consider(str(x))
    return out[:max_n]


def _dedupe_ids_ordered(primary: str | None, extras: list[str], *, max_n: int = 12) -> list[str]:
    """主 id 在前（若存在）；字符串去重。"""
    seen: set[str] = set()
    out: list[str] = []

    def consider(raw: str) -> None:
        s = raw.strip()
        if not s or s in seen:
            return
        seen.add(s)
        out.append(s[:512])

    if primary:
        consider(str(primary))
    for x in extras:
        consider(str(x))
    return out[:max_n]


def _finalize_top3_public_identity(row: dict[str, Any]) -> None:
    """
    幂等：保留顶层 event_id；related_event_ids = [event_id, ...其余] 去重；
    source_urls = [url, ...其余] 主 URL 在前。
    """
    eid = str(row.get("event_id") or "").strip()
    rel_in = row.get("related_event_ids") if isinstance(row.get("related_event_ids"), list) else []
    extras_r = [str(x).strip() for x in rel_in if str(x).strip()]
    row["related_event_ids"] = _dedupe_ids_ordered(eid or None, extras_r, max_n=12)

    primary_u = str(row.get("url") or "").strip()
    su_in = row.get("source_urls") if isinstance(row.get("source_urls"), list) else []
    extras_u = [str(x).strip() for x in su_in if str(x).strip()]
    row["source_urls"] = _dedupe_urls_ordered(primary_u or None, extras_u, max_n=8)


def materialize_top3_public_fields(row: dict[str, Any]) -> None:
    """
    将 merge_top3_duplicate_into 写入的内部字段转为稳定 payload 字段，并移除 _top3_merged_*。
    幂等：已存在 source_urls 且无待合并内部字段时仍会做 identity 收口（主 id / 主 URL 在首位）。
    """
    has_pending_merge = any(
        k in row for k in ("_top3_merged_urls", "_top3_merged_event_ids", "_top3_merged_stable_keys")
    )
    if not has_pending_merge and "source_urls" in row:
        _finalize_top3_public_identity(row)
        return

    merged_urls = row.pop("_top3_merged_urls", None)
    if merged_urls is None:
        merged_urls = []
    if not isinstance(merged_urls, list):
        merged_urls = []

    primary_url = str(row.get("url") or "").strip()
    row["source_urls"] = _dedupe_urls_ordered(primary_url or None, [str(u) for u in merged_urls])

    merged_eids = row.pop("_top3_merged_event_ids", None)
    if merged_eids is None:
        merged_eids = []
    if not isinstance(merged_eids, list):
        merged_eids = []
    keid = str(row.get("event_id") or "").strip()
    row["related_event_ids"] = _dedupe_ids_ordered(
        keid or None, [str(x) for x in merged_eids], max_n=12
    )

    merged_sks = row.pop("_top3_merged_stable_keys", None)
    if merged_sks is None:
        merged_sks = []
    if not isinstance(merged_sks, list):
        merged_sks = []
    psk = str(row.get("stable_key") or "").strip()
    row["related_stable_keys"] = _dedupe_ids_ordered(
        psk or None, [str(x) for x in merged_sks], max_n=12
    )

    _finalize_top3_public_identity(row)


def resolve_top3_display_title_vs_locked(old: dict[str, Any], lk: dict[str, Any]) -> str:
    """normal.top3：Composer 已有中文标题时不要被英文 locked.title 覆盖。"""
    ot = str(old.get("title") or "").strip()
    lt = str(lk.get("title") or "").strip()
    if contains_cjk(ot):
        return ot[:200]
    if contains_cjk(lt):
        return lt[:200]
    if lt:
        return lt[:200]
    return ot[:200]


def get_num(event: dict[str, Any], key: str, default: float = 0) -> float:
    try:
        return float(event.get(key, default) or default)
    except Exception:
        return default


def _attention_bucket(score_total: float, pool_scores: list[float]) -> str:
    if not pool_scores:
        return "Medium"
    mx = max(pool_scores)
    if mx <= 0:
        return "Medium"
    r = score_total / mx
    if r >= 0.85:
        return "High"
    if r >= 0.5:
        return "Medium"
    return "Low"


def _clamp_user_value(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        v = float(raw)
    except Exception:
        return None
    return max(0.0, min(100.0, v))


def normalize_audience_type(raw: Any) -> str:
    s = str(raw or "").strip().lower()
    return s if s in _AUDIENCE_TYPES else "general_user"


def normalize_actionability(raw: Any) -> str:
    s = str(raw or "").strip().lower()
    return s if s in _ACTIONABILITY_TYPES else "watch"


def estimate_user_value_fallback(event: dict[str, Any]) -> tuple[float, str]:
    """
    Impact Analyst 未给出 user_value_score 时的确定性估算（P0 兜底）。
    区间对齐产品：非技术读者的直接价值。
    """
    blob = " ".join(
        [
            str(event.get("title") or ""),
            str(event.get("one_liner") or ""),
            str(event.get("_text_blob") or ""),
        ]
    )
    st = str(event.get("source_type") or "").lower()

    if _TECH_LIB_PAT.search(blob):
        return 47.0, "规则兜底：偏技术库/基准/框架类，对一般读者直接价值有限。"
    if _PRODUCT_USER_PAT.search(blob) and _USER_VALUE_SIGNAL_PAT.search(blob):
        return 78.0, "规则兜底：产品化或可用性信号强，偏「现在可试」。"
    if _PRODUCT_USER_PAT.search(blob):
        return 74.0, "规则兜底：偏新产品/能力发布，普通用户可关注。"
    if _FUNDING_NO_ACTION_PAT.search(blob) and not _USER_VALUE_SIGNAL_PAT.search(blob):
        return 58.0, "规则兜底：融资/商业叙事为主，缺少明确用户行动点。"
    if _USER_VALUE_SIGNAL_PAT.search(blob):
        return 72.0, "规则兜底：可见提效/试用/替代人工类表述。"
    if st == "github":
        return 50.0, "规则兜底：GitHub 来源默认偏开发者向，保守评分。"
    return 62.0, "规则兜底：缺少 Impact 用户价值字段，中性估计。"


def heat_score_for_top3(event: dict[str, Any]) -> float:
    """GitHub 来源时对 heat 输入封顶，避免 stars 统治排序。"""
    h = get_num(event, "heat_score")
    st = str(event.get("source_type", "")).lower()
    if st == "github":
        return min(h, 55.0)
    return h


def calculate_top3_score_legacy_for_audit(event: dict[str, Any]) -> float:
    """改版前 Top3 综合分（仅对比日志用）：热度/来源权重较高。"""
    base_score = get_num(event, "base_score")
    heat_score = get_num(event, "heat_score")
    freshness_score = get_num(event, "freshness_score")
    source_trust_score = get_num(event, "source_trust_score")
    relevance_score = get_num(event, "relevance_score")
    confidence = get_num(event, "confidence")

    score = (
        base_score * 0.35
        + heat_score * 0.20
        + source_trust_score * 0.20
        + freshness_score * 0.15
        + relevance_score * 0.10
    )

    source_type = str(event.get("source_type", "")).lower()
    attention_level = str(event.get("attention_level", "")).lower()
    fact_status = str(event.get("fact_status", "") or "").lower()

    if confidence >= 0.85:
        score += 8

    if source_type == "official":
        score += 6

    if attention_level == "high":
        score += 5

    if source_type == "social":
        score -= 8

    if confidence < 0.65:
        score -= 20

    if fact_status in ("uncertain", "reject"):
        score -= 50

    return round(score, 2)


def calculate_top3_score(event: dict[str, Any]) -> float:
    """
    Top3 综合分（P0）：用户价值优先，其次基础分与可信源，热度弱化且 GitHub heat 封顶。
    """
    uv = get_num(event, "user_value_score")
    base_score = get_num(event, "base_score")
    source_trust_score = get_num(event, "source_trust_score")
    freshness_score = get_num(event, "freshness_score")
    heat_eff = heat_score_for_top3(event)

    score = (
        uv * 0.45
        + base_score * 0.20
        + source_trust_score * 0.15
        + freshness_score * 0.10
        + heat_eff * 0.10
    )
    return round(score, 2)


def passes_user_value_hard_gates(event: dict[str, Any]) -> bool:
    if get_num(event, "user_value_score") < _USER_VALUE_GATE_MIN:
        return False
    if normalize_actionability(event.get("actionability")) == "not_for_general_user":
        return False
    return True


def is_valid_top3_candidate(event: dict[str, Any]) -> bool:
    confidence = get_num(event, "confidence")
    url = str(event.get("url", "") or "")
    category = str(event.get("category", "") or "")
    fact_status = str(event.get("fact_status", "") or "").lower()

    if not url:
        return False

    if confidence < 0.65:
        return False

    if fact_status in ("uncertain", "reject"):
        return False

    if category not in ("model_update", "tool_product", "industry"):
        return False

    if not passes_user_value_hard_gates(event):
        return False

    return False if event.get("_exclude_top3") else True


def select_top3(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    for event in events:
        if not is_valid_top3_candidate(event):
            continue
        row = dict(event)
        row["top3_score"] = calculate_top3_score(row)
        candidates.append(row)

    candidates.sort(key=lambda x: float(x.get("top3_score") or 0), reverse=True)

    selected: list[dict[str, Any]] = []
    category_count: dict[str, int] = {}

    for event in candidates:
        cat_key = str(event.get("category") or "")

        if category_count.get(cat_key, 0) >= 2:
            continue

        dup_target: dict[str, Any] | None = None
        for s in selected:
            if is_duplicate_event(event, s):
                dup_target = s
                break
        if dup_target is not None:
            merge_top3_duplicate_into(dup_target, event)
            continue

        selected.append(event)
        category_count[cat_key] = category_count.get(cat_key, 0) + 1

        if len(selected) == 3:
            break

    if len(selected) < 3:
        for event in candidates:
            eid = str(event.get("event_id") or "")
            if any(str(s.get("event_id")) == eid for s in selected):
                continue

            dup_target = None
            for s in selected:
                if is_duplicate_event(event, s):
                    dup_target = s
                    break
            if dup_target is not None:
                merge_top3_duplicate_into(dup_target, event)
                continue

            selected.append(event)

            if len(selected) == 3:
                break

    out = selected[:3]
    for row in out:
        materialize_top3_public_fields(row)
    return out


def pool_index_from_event_id(event_id: str | None) -> int | None:
    if not event_id:
        return None
    s = str(event_id).strip()
    if len(s) < 2 or s[0].lower() != "e":
        return None
    try:
        return int(s[1:]) - 1
    except ValueError:
        return None


def _primary_source_type(pool_row: Any) -> str:
    if pool_row is None:
        return "rss"
    sj = getattr(pool_row, "sources_json", None)
    if sj:
        try:
            arr = json.loads(sj)
            if isinstance(arr, list) and arr and isinstance(arr[0], dict):
                st = str(arr[0].get("source_type") or "").strip().lower()
                if st:
                    return st
        except Exception:
            pass
    st = getattr(pool_row, "source_type", None)
    if st:
        return str(st).strip().lower()
    return "rss"


def _freshness_score(pub: datetime | None) -> float:
    if pub is None:
        return 55.0
    try:
        now = datetime.now(timezone.utc)
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        age_days = (now - pub).days
    except Exception:
        return 55.0
    if age_days <= 1:
        return 100.0
    if age_days <= 3:
        return 90.0
    if age_days <= 7:
        return 75.0
    if age_days <= 14:
        return 60.0
    return 45.0


def _verifier_confidence(verifier_row: dict[str, Any] | None) -> float | None:
    if not verifier_row or not isinstance(verifier_row.get("confidence"), dict):
        return None
    lvl = str(verifier_row["confidence"].get("level") or "").lower()
    return {"high": 0.88, "medium": 0.74, "low": 0.58}.get(lvl)


def _parse_card_confidence(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        v = float(raw)
        return v if 0 <= v <= 1 else None
    if isinstance(raw, dict):
        lvl = str(raw.get("level") or "").lower()
        return {"high": 0.88, "medium": 0.74, "low": 0.58}.get(lvl)
    if isinstance(raw, str):
        s = raw.strip().lower()
        if s in ("high", "medium", "low"):
            return _parse_card_confidence({"level": s})
        try:
            v = float(s)
            return v if 0 <= v <= 1 else None
        except ValueError:
            return None
    return None


def _slug_from_issue_event(pool_row: Any) -> str:
    cat_cn = str(getattr(pool_row, "category", "") or "").strip()
    if cat_cn in _SECTION_CN_TO_SLUG:
        return _SECTION_CN_TO_SLUG[cat_cn]
    title = str(getattr(pool_row, "canonical_title", "") or "")
    summary = str(getattr(pool_row, "summary_merged", "") or "")
    mapped = classify_item_section(title, summary)
    return _SECTION_CN_TO_SLUG.get(mapped, "industry")


def _fact_status_from_verifier(verifier_row: dict[str, Any] | None) -> str | None:
    if not verifier_row:
        return None
    conflicts = verifier_row.get("conflicts")
    if isinstance(conflicts, list) and len(conflicts) > 0:
        return "uncertain"
    return None


_OPINION_MARKETING_PAT = re.compile(
    r"(软文|推广稿|PR稿|通稿|个人认为|笔者认为|震惊|标题党)",
    re.I,
)


def build_enriched_event_cards(
    cards_list: list[Any],
    pool: list[Any],
    *,
    verifier: dict[str, Any] | None = None,
    impact: dict[str, Any] | None = None,
    scoring: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    vf_map = _events_by_id(verifier)
    im_map = _events_by_id(impact)
    pool_scores: list[float] = []
    for it in pool:
        try:
            pool_scores.append(float(getattr(it, "score_total", 0) or 0))
        except Exception:
            pool_scores.append(0.0)

    high_noise_ids: set[str] = set()
    if isinstance(scoring, dict):
        for iss in scoring.get("issues") or []:
            if not isinstance(iss, dict):
                continue
            if str(iss.get("severity") or "").lower() != "high":
                continue
            eid = str(iss.get("event_id") or "").strip()
            if eid:
                high_noise_ids.add(eid)

    out: list[dict[str, Any]] = []
    for card in cards_list:
        if not isinstance(card, dict):
            continue
        eid = str(card.get("event_id") or "").strip()
        idx = pool_index_from_event_id(eid)
        pool_row = pool[idx] if idx is not None and 0 <= idx < len(pool) else None

        title = str(card.get("title") or "")
        url = str(card.get("url") or "")
        one_liner = str(card.get("one_liner") or "")
        summary = ""
        if pool_row is not None:
            title = str(getattr(pool_row, "canonical_title", None) or title or "")
            url = str(getattr(pool_row, "canonical_url", None) or url or "")
            summary = str(getattr(pool_row, "summary_merged", "") or "")
        else:
            summary = str(card.get("summary") or "")

        st = _primary_source_type(pool_row)
        if pool_row is not None:
            base_score = float(getattr(pool_row, "score_total", 0) or 0)
            heat_score = float(getattr(pool_row, "heat_score", 0) or 0)
            pub = getattr(pool_row, "published_at", None)
        else:
            try:
                base_score = float(card.get("score") or 0)
            except Exception:
                base_score = 0.0
            heat_score = 0.0
            pub = None

        vf_row = vf_map.get(eid)
        pool_conf = float(getattr(pool_row, "confidence", 0.5) or 0.5) if pool_row else 0.55
        vconf = _verifier_confidence(vf_row)
        cconf = _parse_card_confidence(card.get("confidence"))
        confidence = max(pool_conf, vconf or 0.0, cconf or 0.0)
        if base_score >= 72 and confidence < 0.65:
            confidence = max(confidence, 0.66)

        if pool_row is not None:
            cat_slug = _slug_from_issue_event(pool_row)
        else:
            cat_slug = _SECTION_CN_TO_SLUG.get(classify_item_section(title, summary), "industry")

        fs = str(getattr(pool_row, "fact_status", "") or "").lower() if pool_row else ""
        vfs = _fact_status_from_verifier(vf_row)
        if vfs:
            fs = vfs
        if fs in ("", "unverified"):
            fs = "ok"

        imp_row = im_map.get(eid)
        action = ""
        if isinstance(imp_row, dict):
            action = str(imp_row.get("action") or "").strip()

        _text_blob = re.sub(r"\s+", " ", summary).strip()[:1200] if summary else ""

        uv_reason_imp = ""
        aud_t = "general_user"
        act_b = "watch"
        uv_clamped: float | None = None
        if isinstance(imp_row, dict):
            uv_clamped = _clamp_user_value(imp_row.get("user_value_score"))
            uv_reason_imp = str(imp_row.get("user_value_reason") or "").strip()
            aud_t = normalize_audience_type(imp_row.get("audience_type"))
            act_b = normalize_actionability(imp_row.get("actionability"))

        if uv_clamped is None:
            uv_score_final, fb_reason = estimate_user_value_fallback(
                {
                    "title": title,
                    "one_liner": one_liner,
                    "_text_blob": _text_blob,
                    "source_type": st,
                }
            )
            uv_reason = uv_reason_imp or fb_reason
            user_value_from_impact = False
        else:
            uv_score_final = uv_clamped
            uv_reason = uv_reason_imp or "Impact Analyst 输出。"
            user_value_from_impact = True

        attention_level = _attention_bucket(base_score, pool_scores)

        row: dict[str, Any] = {
            "event_id": eid,
            "title": title,
            "category": cat_slug,
            "source_type": st,
            "confidence": confidence,
            "base_score": base_score,
            "heat_score": heat_score,
            "freshness_score": _freshness_score(pub if isinstance(pub, datetime) else None),
            "source_trust_score": float(_SOURCE_TRUST_SCORE.get(st, 65.0)),
            "relevance_score": min(100.0, max(0.0, base_score * 0.85 + heat_score * 0.15)),
            "attention_level": attention_level,
            "url": url,
            "fact_status": fs,
            "one_liner": one_liner,
            "action": action,
            "user_value_score": uv_score_final,
            "user_value_reason": uv_reason,
            "audience_type": aud_t,
            "actionability": act_b,
            "user_value_from_impact": user_value_from_impact,
            "_text_blob": _text_blob,
        }

        if high_noise_ids and eid in high_noise_ids:
            row["_exclude_top3"] = True

        if title and _OPINION_MARKETING_PAT.search(title + "\n" + summary):
            row["_exclude_top3"] = True

        out.append(row)

    return out


def _events_by_id(pack: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(pack, dict):
        return out
    for ev in pack.get("events") or []:
        if isinstance(ev, dict) and ev.get("event_id"):
            out[str(ev["event_id"])] = ev
    return out


def compact_for_section_prompt(enriched: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": enriched.get("event_id"),
        "title": enriched.get("title"),
        "url": enriched.get("url"),
        "one_liner": enriched.get("one_liner"),
        "see_top3": False,
    }


def compact_for_top3_prompt(enriched: dict[str, Any]) -> dict[str, Any]:
    materialize_top3_public_fields(enriched)
    return {
        "event_id": enriched.get("event_id"),
        "title": enriched.get("title"),
        "url": enriched.get("url"),
        "category": enriched.get("category"),
        "one_liner": enriched.get("one_liner"),
        "action": enriched.get("action"),
        "top3_score": enriched.get("top3_score"),
        "user_value_score": enriched.get("user_value_score"),
        "actionability": enriched.get("actionability"),
        "source_urls": list(enriched.get("source_urls") or []),
        "related_event_ids": list(enriched.get("related_event_ids") or []),
        "related_stable_keys": list(enriched.get("related_stable_keys") or []),
    }


def build_top3_selection_audit(
    enriched_events: list[dict[str, Any]],
    selected: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """供 audit_report_json / 运维排查：每条事件的 Top3 分、用户价值门槛命中情况。"""
    sel_ids = {str(x.get("event_id")) for x in selected if x.get("event_id")}
    out: list[dict[str, Any]] = []
    for ev in enriched_events:
        eid = str(ev.get("event_id") or "")
        raw_score = calculate_top3_score(ev)
        uv = get_num(ev, "user_value_score")
        blocked_uv = uv < _USER_VALUE_GATE_MIN
        blocked_action = normalize_actionability(ev.get("actionability")) == "not_for_general_user"
        excluded_low_user_value = blocked_uv or blocked_action
        reasons: list[str] = []
        if blocked_uv:
            reasons.append("user_value_below_55")
        if blocked_action:
            reasons.append("actionability_not_for_general_user")

        out.append(
            {
                "event_id": eid,
                "top3_score": raw_score,
                "user_value_score": uv,
                "user_value_reason": str(ev.get("user_value_reason") or ""),
                "audience_type": ev.get("audience_type"),
                "actionability": ev.get("actionability"),
                "user_value_from_impact": bool(ev.get("user_value_from_impact")),
                "excluded_low_user_value": excluded_low_user_value,
                "selected_for_top3": eid in sel_ids,
                "low_user_value_gate_notes": reasons,
            }
        )
    return out


def count_candidates_passing_user_value_gate(events: list[dict[str, Any]]) -> int:
    """仅统计通过 user_value 硬门槛（不含置信度/板块等）的候选数，用于 insufficient 判定。"""
    return sum(1 for e in events if passes_user_value_hard_gates(e))


def build_top3_comparison_log(
    enriched_events: list[dict[str, Any]],
    final_top3: list[dict[str, Any]],
    *,
    heat_high_percentile: float = 0.75,
    heat_floor: float = 55.0,
) -> dict[str, Any]:
    """
    P0 验证日志：旧版热度导向排序 vs 用户价值排序 vs 最终 Top3 vs 高热度但被 UV 拦截。
    """
    rows = list(enriched_events)
    legacy_ranked = sorted(
        rows,
        key=lambda e: calculate_top3_score_legacy_for_audit(e),
        reverse=True,
    )[:10]
    old_score_rank_top10 = [
        {
            "rank": i + 1,
            "event_id": str(e.get("event_id") or ""),
            "title": str(e.get("title") or "")[:120],
            "legacy_top3_score": calculate_top3_score_legacy_for_audit(e),
            "heat_score": get_num(e, "heat_score"),
            "source_type": str(e.get("source_type") or ""),
        }
        for i, e in enumerate(legacy_ranked)
    ]

    uv_ranked = sorted(rows, key=lambda e: get_num(e, "user_value_score"), reverse=True)[:10]
    new_user_value_rank_top10 = [
        {
            "rank": i + 1,
            "event_id": str(e.get("event_id") or ""),
            "title": str(e.get("title") or "")[:120],
            "user_value_score": get_num(e, "user_value_score"),
            "new_top3_score": calculate_top3_score(e),
            "actionability": str(e.get("actionability") or ""),
        }
        for i, e in enumerate(uv_ranked)
    ]

    final_top3_summary = [
        {
            "rank": i + 1,
            "event_id": str(x.get("event_id") or ""),
            "title": str(x.get("title") or "")[:120],
            "user_value_score": get_num(x, "user_value_score"),
            "top3_score": calculate_top3_score(x),
        }
        for i, x in enumerate(final_top3[:3])
    ]

    heats_sorted = sorted([get_num(e, "heat_score") for e in rows])
    if heats_sorted:
        idx = min(len(heats_sorted) - 1, int(len(heats_sorted) * heat_high_percentile))
        heat_threshold = max(heat_floor, heats_sorted[idx])
    else:
        heat_threshold = heat_floor

    high_heat_blocked_by_user_value: list[dict[str, Any]] = []
    for e in rows:
        if get_num(e, "heat_score") < heat_threshold:
            continue
        if passes_user_value_hard_gates(e):
            continue
        high_heat_blocked_by_user_value.append(
            {
                "event_id": str(e.get("event_id") or ""),
                "title": str(e.get("title") or "")[:120],
                "heat_score": get_num(e, "heat_score"),
                "user_value_score": get_num(e, "user_value_score"),
                "actionability": str(e.get("actionability") or ""),
                "block_reason": (
                    "actionability_not_for_general_user"
                    if normalize_actionability(e.get("actionability")) == "not_for_general_user"
                    else "user_value_below_55"
                ),
            }
        )

    return {
        "heat_threshold_used": heat_threshold,
        "old_score_rank_top10": old_score_rank_top10,
        "new_user_value_rank_top10": new_user_value_rank_top10,
        "final_top3": final_top3_summary,
        "high_heat_blocked_by_user_value": high_heat_blocked_by_user_value,
        "candidates_passing_user_value_gate_count": count_candidates_passing_user_value_gate(rows),
    }


def attention_level_to_digit(att: str | None) -> str:
    t = (att or "").strip().lower()
    if t == "high":
        return "5"
    if t == "low":
        return "2"
    return "3"


def apply_locked_top3_merge(payload: dict[str, Any], locked: list[dict[str, Any]]) -> None:
    """将算法选定的 Top3 固定到 payload.normal.top3（保留 Composer 已生成的中文段落字段）。"""
    if not isinstance(payload, dict):
        return
    normal = payload.get("normal")
    if not isinstance(normal, dict):
        return
    if not locked:
        normal["top3"] = []
        return
    old_t3 = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    new_t3: list[dict[str, Any]] = []
    for i, lk in enumerate(locked[:3]):
        old = old_t3[i] if i < len(old_t3) and isinstance(old_t3[i], dict) else {}
        att = attention_level_to_digit(str(lk.get("attention_level") or ""))
        materialize_top3_public_fields(lk)
        leid = str(lk.get("event_id") or "").strip()
        row: dict[str, Any] = {
            "title": resolve_top3_display_title_vs_locked(old, lk),
            "url": str(lk.get("url") or old.get("url") or "")[:2048],
            "what_happened": str(old.get("what_happened") or lk.get("one_liner") or "")[:800],
            "why_important": str(old.get("why_important") or "")[:800],
            "what_it_means_for_you": str(old.get("what_it_means_for_you") or lk.get("action") or "")[:800],
            "attention_level": att,
            "event_id": leid,
            "source_urls": list(lk.get("source_urls") or []),
            "related_event_ids": list(lk.get("related_event_ids") or []),
            "related_stable_keys": list(lk.get("related_stable_keys") or []),
        }
        pu = str(row.get("url") or "").strip()
        if pu and (not row["source_urls"]):
            row["source_urls"] = _dedupe_urls_ordered(pu, [])
        new_t3.append(row)
    if new_t3:
        normal["top3"] = new_t3
