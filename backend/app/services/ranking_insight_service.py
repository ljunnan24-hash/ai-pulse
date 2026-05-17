"""
Phase 2.5：对高价值 global_events 批量调用 LLM，补齐排行榜/详情判断字段。
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import GlobalEvent
from app.utils.time_windows import get_yesterday_window_utc
from app.services.llm_json_client import LlmJsonClient
from app.services.ranking_score import stable_pulse_score_for_global_event
from app.services.global_event_service import recalculate_global_event

_log = logging.getLogger("uvicorn.error")

_USER_PROMPT_PREFIX = (
    "请为下列事件分别生成 insights 数组元素（insights 长度与事件条数一致，且 event_id 对应）：\n"
)

CAPABILITY_KEYS = (
    "reasoning",
    "coding",
    "multimodal",
    "long_context",
    "realtime",
    "safety",
)

ACTION_CHOICES = frozenset({"现在试用", "先观望", "可以忽略"})

_BANNED_SUBSTR = ("可能", "或许", "可尝试", "值得一看")

# 入库或兜底文案：视为「尚未真实 enrich」，须优先进入 Insight 候选
_PLACEHOLDER_MARKERS: tuple[str, ...] = (
    "若与你的场景相关",
    "建议安排短时间跟进",
    "该事件仍在分析中",
)


def _text_has_placeholder(text: str | None) -> bool:
    t = text or ""
    return any(m in t for m in _PLACEHOLDER_MARKERS)


def needs_ranking_insight_refresh(ge: GlobalEvent) -> bool:
    """
    是否需要纳入 Ranking Insight（占位文案一律视为未 enrich；
    metrics_json.ranking_insight.applied=true 且无占位则视为已处理）。
    """
    if _text_has_placeholder(ge.what_happened) or _text_has_placeholder(ge.why_important) or _text_has_placeholder(
        ge.what_it_means_for_you
    ):
        return True
    try:
        m = json.loads(ge.metrics_json or "{}")
        ri = m.get("ranking_insight") if isinstance(m, dict) else None
        if isinstance(ri, dict) and ri.get("applied") is True:
            return False
    except Exception:
        pass
    if not (ge.what_happened or "").strip():
        return True
    if not (ge.what_it_means_for_you or "").strip():
        return True
    if not (ge.action_suggestion or "").strip():
        return True
    return False


def _today_effective_top_ids(db: Session, top_n: int) -> list[int]:
    """与公开排行榜 today 范围一致：昨日上海自然日窗口内按 pulse_score 取 Top N。"""
    start_utc, end_utc, _ = get_yesterday_window_utc("Asia/Shanghai")
    q = select(GlobalEvent).where(GlobalEvent.status == "active")
    q = q.where(
        GlobalEvent.published_at.isnot(None),
        GlobalEvent.published_at >= start_utc,
        GlobalEvent.published_at < end_utc,
    )
    rows = db.scalars(q.limit(800)).all()
    scored: list[tuple[float, int]] = []
    for ge in rows:
        scored.append((stable_pulse_score_for_global_event(ge), ge.id))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [x[1] for x in scored[:top_n]]


def _priority_needs_insight_ids(db: Session, *, cap: int, scan_limit: int = 4000) -> list[int]:
    """
    占位 / 未 applied / 关键字段为空 — 优先纳入。
    先用 SQL 拉出含占位关键词的行（避免低分占位落在扫描窗口之外），再扫榜补「未 applied」等。
    """
    like_conds: list = []
    for m in _PLACEHOLDER_MARKERS:
        pat = f"%{m}%"
        like_conds.extend(
            [
                GlobalEvent.what_happened.like(pat),
                GlobalEvent.why_important.like(pat),
                GlobalEvent.what_it_means_for_you.like(pat),
            ]
        )
    ph_ids: list[int] = []
    if like_conds:
        ph_ids = list(
            db.scalars(
                select(GlobalEvent.id)
                .where(GlobalEvent.status == "active", or_(*like_conds))
                .order_by(GlobalEvent.ranking_score.desc(), GlobalEvent.heat_score.desc())
                .limit(cap)
            ).all()
        )
    seen: set[int] = set(ph_ids)
    out: list[int] = list(ph_ids)
    if len(out) >= cap:
        return out[:cap]

    rows = db.scalars(
        select(GlobalEvent)
        .where(GlobalEvent.status == "active")
        .order_by(GlobalEvent.ranking_score.desc(), GlobalEvent.heat_score.desc())
        .limit(max(200, min(scan_limit, 8000)))
    ).all()
    for ge in rows:
        if ge.id in seen:
            continue
        if needs_ranking_insight_refresh(ge):
            out.append(ge.id)
            seen.add(ge.id)
            if len(out) >= cap:
                break
    return out


def _collect_candidate_ids(db: Session, *, limit: int, force: bool = False) -> list[int]:
    """
    候选顺序（去重）：
    1. 须刷新 Insight 的事件（含占位文案、未 applied、关键字段空）— **先于** Top30；
    2. 今日有效分 Top30；
    3. ranking_score>=70；
    4. ranking_score>=65 且（字段空 **或** 占位）— 捕获 <70 但仅占位的条目。

    force=True 时：在前述合并后若仍不足 limit，再按分数从高到低补足（用于批量覆盖旧兜底文案）。
    """
    top30 = _today_effective_top_ids(db, 30)
    s70 = list(
        db.scalars(
            select(GlobalEvent.id)
            .where(GlobalEvent.status == "active", GlobalEvent.ranking_score >= 70.0)
            .order_by(GlobalEvent.ranking_score.desc())
        ).all()
    )
    s65_need = list(
        db.scalars(
            select(GlobalEvent.id)
            .where(
                GlobalEvent.status == "active",
                GlobalEvent.ranking_score >= 65.0,
                GlobalEvent.ranking_score < 70.0,
                or_(
                    GlobalEvent.what_happened == "",
                    GlobalEvent.what_it_means_for_you == "",
                    GlobalEvent.action_suggestion == "",
                ),
            )
            .order_by(GlobalEvent.ranking_score.desc())
        ).all()
    )
    priority = _priority_needs_insight_ids(db, cap=limit)

    fill_top_score: list[int] = []
    if force:
        fill_top_score = list(
            db.scalars(
                select(GlobalEvent.id)
                .where(GlobalEvent.status == "active")
                .order_by(GlobalEvent.ranking_score.desc(), GlobalEvent.heat_score.desc())
                .limit(limit * 3)
            ).all()
        )

    out: list[int] = []
    seen: set[int] = set()

    def extend(bucket: list[int]) -> None:
        for gid in bucket:
            if gid in seen:
                continue
            seen.add(gid)
            out.append(gid)
            if len(out) >= limit:
                return

    extend(priority)
    if len(out) >= limit:
        return out[:limit]
    extend(top30)
    if len(out) >= limit:
        return out[:limit]
    extend(s70)
    if len(out) >= limit:
        return out[:limit]
    extend(s65_need)
    if len(out) >= limit:
        return out[:limit]
    if force:
        extend(fill_top_score)
    return out[:limit]


def _chunks(xs: list[int], n: int) -> Iterable[list[int]]:
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def _strip_banned(text: str) -> str:
    t = (text or "").strip()
    for b in _BANNED_SUBSTR:
        t = t.replace(b, "")
    return t.strip()


_ONE_LINER_FILLERS = (
    "这表明",
    "这意味着",
    "这说明",
    "可以说",
    "总而言之",
    "需要注意的是",
    "可以看到",
    "总体来说",
    "事实上",
    "实际上",
    "不难发现",
    "不难看出",
    "换句话说",
    "简单来说",
    "总的来说",
)

# 句首弱化主体（循环剥离）
_WEAK_SUBJECT_PREFIXES: tuple[str, ...] = (
    "该事件",
    "这一事件",
    "该举措",
    "这一举措",
    "此举",
    "该产品",
    "这一产品",
    "该公司",
    "该企业",
    "此次",
    "本次",
    "这一动态",
    "这一消息",
    "这一方面",
)

# 判断感语义锚点（用于从长文中挑选更像判断的句子）
_JUDGMENT_HINTS: frozenset[str] = frozenset(
    {
        "趋势",
        "影响",
        "变化",
        "机会",
        "风险",
        "挑战",
        "格局",
        "重塑",
        "加速",
        "倒逼",
        "渗透",
        "走向",
        "落地",
        "商用",
        "规模化",
        "窗口",
        "赛道",
        "分化",
        "收紧",
        "红利",
        "拐点",
        "浪潮",
        "正在",
        "或将",
        "难免",
    }
)

# 典型「纯资讯」动词短语（短句命中则倾向改用 why 中的判断句）
_NEWS_FACT_MARKERS: tuple[str, ...] = (
    "发布了",
    "宣布了",
    "推出了",
    "上线了",
    "公布了",
    "正式启动",
    "正式发布",
    "发布新",
    "宣布推出",
    "首度公开",
    "刊发",
)


def _is_han(ch: str) -> bool:
    return len(ch) == 1 and "\u4e00" <= ch <= "\u9fff"


def _truncate_max_han(s: str, max_han: int = 35) -> str:
    """保留至多 max_han 个汉字；标点仅允许紧跟已输出汉字之后。"""
    out: list[str] = []
    n = 0
    for ch in s:
        if _is_han(ch):
            if n >= max_han:
                break
            n += 1
            out.append(ch)
        else:
            if 0 < n <= max_han and ch in "，、；：,.!?！？… \u3000":
                out.append(ch)
            elif n >= max_han:
                break
    return "".join(out).strip(" ，、；：,.!?！？")


def _smooth_truncate_tail(s: str) -> str:
    """避免在「的、和、与」等连接成分处生硬截断。"""
    t = (s or "").rstrip()
    if not t:
        return ""
    bad_endings = ("的", "和", "与", "及", "或", "对", "在", "将", "被", "把", "从", "以")
    if len(t) >= 2 and t[-1] in bad_endings:
        cut = max(t.rfind("，"), t.rfind("、"))
        if cut > 0:
            return t[:cut].strip(" ，、；")
    return t


def _strip_one_liner_fillers(text: str) -> str:
    t = (text or "").strip()
    for ph in _ONE_LINER_FILLERS:
        t = t.replace(ph, "")
    return t.strip()


def _strip_weak_subject_prefix(text: str) -> str:
    """去掉「该事件」「此次」等弱化主体开头。"""
    t = (text or "").strip()
    changed = True
    while changed and t:
        changed = False
        for p in sorted(_WEAK_SUBJECT_PREFIXES, key=len, reverse=True):
            if t.startswith(p):
                t = t[len(p) :].lstrip("，：:；、 ").strip()
                changed = True
                break
    return t


def _sentence_split_candidates(text: str) -> list[str]:
    """拆成候选短句（保留语义单元）。"""
    t = (text or "").strip()
    if not t:
        return []
    parts = re.split(r"[。！？\n；]+", t)
    return [p.strip() for p in parts if p.strip()]


def _sentence_judgment_score(sentence: str) -> float:
    """越高越像判断句，越低越像资讯事实句。"""
    s = sentence.strip()
    if not s:
        return -100.0
    score = 0.0
    for h in _JUDGMENT_HINTS:
        if h in s:
            score += 3.0
    for m in _NEWS_FACT_MARKERS:
        if m in s:
            score -= 4.5
    # 英语品牌 + 发布类短句倾向资讯
    if len([c for c in s if _is_han(c)]) <= 18:
        if any(x in s for x in ("发布", "宣布", "推出", "上线")):
            score -= 2.0
    return score


def pick_best_judgment_sentence(long_text: str) -> str:
    """从较长正文选判断感最强的一句；单句则返回去空话后整句。"""
    t = _strip_one_liner_fillers(long_text)
    if not t:
        return ""
    candidates = _sentence_split_candidates(t)
    if not candidates:
        return _strip_weak_subject_prefix(t)
    if len(candidates) == 1:
        return _strip_weak_subject_prefix(_strip_one_liner_fillers(candidates[0]))
    best = max(candidates, key=lambda x: _sentence_judgment_score(x))
    return _strip_weak_subject_prefix(_strip_one_liner_fillers(best))


def _looks_like_news_fact_clip(s: str) -> bool:
    """偏「短资讯」而非立场判断（用于触发从 why 升级）。"""
    raw = (s or "").strip()
    if not raw:
        return True
    t = _strip_weak_subject_prefix(_strip_one_liner_fillers(raw))
    if not t:
        return True
    han_n = sum(1 for c in t if _is_han(c))
    # 含判断锚点则不算纯资讯短句
    if any(h in t for h in _JUDGMENT_HINTS):
        return False
    for m in _NEWS_FACT_MARKERS:
        if m in t:
            return True
    if han_n <= 22 and any(x in t for x in ("发布", "宣布", "推出", "上线", "公布")):
        return True
    return False


def derive_one_liner_fallback(long_text: str) -> str:
    """从较长正文提炼一句话判断（优先判断感较强的一句）。"""
    best = pick_best_judgment_sentence(long_text)
    if best:
        return best
    t = _strip_one_liner_fillers(long_text)
    if not t:
        return ""
    for sep in ("。", "！", "？", "\n", "；"):
        if sep in t:
            t = t.split(sep)[0].strip()
            break
    return _strip_weak_subject_prefix(_strip_one_liner_fillers(t))


def _normalize_one_liner_core(text: str, *, max_han: int = 35) -> str:
    """内部：填空话、弱主体、截断与尾部修整；返回纯 str，永不为 None。"""
    if text is None:
        return ""
    t = str(text).strip()
    if not t:
        return ""
    t = _strip_one_liner_fillers(t)
    t = _strip_weak_subject_prefix(t)
    t = _truncate_max_han(t, max_han)
    t = _smooth_truncate_tail(t)
    return (t or "").strip()


def normalize_one_liner(text: str | None, *, max_han: int = 35) -> str:
    """对外：去空话与弱主体，限制汉字数量；保证返回 str（永不为 None）。"""
    return _normalize_one_liner_core(text, max_han=max_han)


def finalize_one_liner_for_event(
    *,
    llm_one_liner: str | None,
    why_important: str,
    what_happened: str,
    title: str,
) -> str:
    """
    Insight 入库与 API 共用：合并 LLM one_liner 与兜底，弱化「纯新闻短句」。
    """
    wi = (why_important or "").strip()
    wh = (what_happened or "").strip()
    tit = (title or "").strip()

    cand = ""
    if isinstance(llm_one_liner, str) and llm_one_liner.strip():
        cand = _normalize_one_liner_core(llm_one_liner.strip())
    if not cand:
        cand = _normalize_one_liner_core(derive_one_liner_fallback(wi))
    if not cand:
        cand = _normalize_one_liner_core(derive_one_liner_fallback(wh))

    if _looks_like_news_fact_clip(cand):
        alt = _normalize_one_liner_core(derive_one_liner_fallback(wi))
        if alt and not _looks_like_news_fact_clip(alt):
            cand = alt
        elif wi:
            alt2 = _normalize_one_liner_core(pick_best_judgment_sentence(wi))
            if alt2 and not _looks_like_news_fact_clip(alt2):
                cand = alt2

    if _looks_like_news_fact_clip(cand) and tit and cand.strip() == tit.strip():
        cand = _normalize_one_liner_core(derive_one_liner_fallback(wi)) or cand

    out = _normalize_one_liner_core(cand)
    if _looks_like_news_fact_clip(out) and wi:
        bumped = _normalize_one_liner_core(pick_best_judgment_sentence(wi))
        if bumped and not _looks_like_news_fact_clip(bumped):
            out = bumped
    return _normalize_one_liner_core(out)


def resolve_one_liner_for_api(ge: GlobalEvent) -> str:
    """
    榜单 API 用：优先 metrics_json.one_liner；否则从 why_important / what_happened 提炼。
    无可用内容时返回空字符串（前端自行兜底）。
    """
    wi = (ge.why_important or "").strip()
    wh = (ge.what_happened or "").strip()
    tit = (ge.canonical_title or "").strip()
    try:
        m = json.loads(ge.metrics_json or "{}")
        if isinstance(m, dict):
            ol = m.get("one_liner")
            llm_part: str | None = ol.strip() if isinstance(ol, str) and ol.strip() else None
            if llm_part is not None:
                return finalize_one_liner_for_event(
                    llm_one_liner=llm_part,
                    why_important=wi,
                    what_happened=wh,
                    title=tit,
                )
    except Exception:
        pass
    return finalize_one_liner_for_event(
        llm_one_liner=None,
        why_important=wi,
        what_happened=wh,
        title=tit,
    )


def _normalize_action(v: Any) -> str:
    s = str(v or "").strip()
    if s in ACTION_CHOICES:
        return s
    return "先观望"


def _normalize_capability_tags(raw: Any) -> dict[str, float]:
    out: dict[str, float] = {k: 0.0 for k in CAPABILITY_KEYS}
    if not isinstance(raw, dict):
        return out
    for k in CAPABILITY_KEYS:
        try:
            x = float(raw.get(k, 0.0))
            out[k] = float(max(0.0, min(1.0, x)))
        except (TypeError, ValueError):
            out[k] = 0.0
    return out


def _cap_field(s: str, max_len: int) -> str:
    """按数据库字段长度截断，不追加省略号（详情页需展示完整可读正文）。"""
    t = (s or "").strip()
    return t[:max_len]


def _build_user_payload(ge: GlobalEvent) -> dict[str, Any]:
    """构造发往 LLM 的单条事件 JSON（控制长度，降低 batch 超时概率）。"""
    try:
        sources = json.loads(ge.sources_json or "[]")
    except json.JSONDecodeError:
        sources = []
    if not isinstance(sources, list):
        sources = []
    slim_sources: list[dict[str, Any]] = []
    for s in sources[:5]:
        if not isinstance(s, dict):
            continue
        slim_sources.append(
            {
                "title": str(s.get("title", ""))[:200],
                "url": str(s.get("url", ""))[:300],
                "source": str(s.get("source", ""))[:80],
            }
        )
    return {
        "event_id": ge.id,
        "title": (ge.canonical_title or "")[:300],
        "summary": (ge.summary or "")[:1200],
        "canonical_url": (ge.canonical_url or "")[:800],
        "category": (ge.category or "")[:64],
        "sources_json": slim_sources,
    }


_INSIGHT_SYSTEM = """你是 AI 行业情报编辑，面向非技术职场人与创业者。
你只能根据用户给出的每条事件的 title、summary、canonical_url、sources_json 生成判断；禁止编造事实；不确定时保守表述，但不要使用下方禁用词。
输出必须是单一 JSON 对象，顶层键为 "insights"，值为数组；数组元素格式：
{
  "event_id": <整数>,
  "one_liner": "一句话判断（必须是中文；不超过35个汉字；判断句，不是摘要句；禁止「这表明」「这意味着」等空话套话）",
  "what_happened": "陈述已发生的事实，建议约 80～220 字，信息完整、不要用省略号收尾",
  "why_important": "行业层面意义，建议约 80～320 字，不要用省略号收尾",
  "what_it_means_for_you": "对读者工作/创业的影响与行动提示，建议约 80～320 字，不要用省略号收尾",
  "action_suggestion": "现在试用 | 先观望 | 可以忽略",
  "user_value_score": <0到100的整数>,
  "capability_tags": {
    "reasoning": 0.0,
    "coding": 0.0,
    "multimodal": 0.0,
    "long_context": 0.0,
    "realtime": 0.0,
    "safety": 0.0
  }
}
one_liner 要求（务必遵守）：
- 每条事件必须输出 one_liner；
- 必须是中文（勿夹杂英文品牌当整句主体；可用「头部厂商」「主流模型」等泛指）；
- 不超过 35 个汉字；
- 必须是判断句：写趋势、影响、格局变化、机会窗口或风险，不要写资讯报道；
- 禁止复述标题原句；禁止把 one_liner 写成「发生了什么」；
- 禁止使用「发布了」「宣布了」「推出了」「正式上线了」等纯新闻句式；
- 禁止以「这表明」「这意味着」「该事件」「这一举措」等空话或弱化主体开头；
- 尽量包含「趋势 / 影响 / 变化 / 机会 / 风险」之一（可用不同措辞表达）；
- 格式示例（不可照抄，需按本条事件独立写）：
  「AI 办公正在进入真正可用阶段」
  「企业 AI Agent 开始从演示走向落地」
  「普通白领的重复办公任务正在被压缩」
capability_tags 各值为 0~1。
禁用词（禁止出现在任意字符串字段）：可能、或许、可尝试、值得一看。
action_suggestion 必须是三者之一：现在试用、先观望、可以忽略。
不要 markdown，不要代码围栏。"""


def _parse_insights_response(data: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    arr = data.get("insights")
    if not isinstance(arr, list):
        # 兼容扁平 {"items": [...]}
        arr = data.get("items")
    if not isinstance(arr, list):
        return []
    out: list[dict[str, Any]] = []
    for row in arr:
        if isinstance(row, dict) and row.get("event_id") is not None:
            out.append(row)
    return out


def _user_prompt_for_events(ges: list[GlobalEvent]) -> str:
    user_lines = [_build_user_payload(g) for g in ges]
    return _USER_PROMPT_PREFIX + json.dumps(user_lines, ensure_ascii=False)


def _by_id_from_raw(raw: dict[str, Any]) -> dict[int, dict[str, Any]]:
    rows = _parse_insights_response(raw)
    by_id: dict[int, dict[str, Any]] = {}
    for row in rows:
        try:
            eid = int(row.get("event_id"))
            by_id[eid] = row
        except (TypeError, ValueError):
            continue
    return by_id


def _apply_insights_for_ges(
    ges: list[GlobalEvent],
    by_id: dict[int, dict[str, Any]],
    *,
    now_iso: str,
    force: bool,
) -> list[int]:
    """将 LLM 返回的多条映射写回 ORM；返回成功更新的 event_id 列表。"""
    batch_updated: list[int] = []
    for ge in ges:
        row = by_id.get(ge.id)
        if not row:
            continue
        try:
            wh = _strip_banned(_cap_field(str(row.get("what_happened", "")), 512))
            wi = _strip_banned(_cap_field(str(row.get("why_important", "")), 1024))
            wm = _strip_banned(_cap_field(str(row.get("what_it_means_for_you", "")), 1024))
            act = _normalize_action(row.get("action_suggestion"))
            uv_raw = row.get("user_value_score", 50)
            try:
                uv = float(uv_raw)
            except (TypeError, ValueError):
                uv = 50.0
            uv = max(0.0, min(100.0, uv))
            caps = _normalize_capability_tags(row.get("capability_tags"))

            if not wh:
                wh = _cap_field(ge.canonical_title or "", 512)
            if not wi:
                wi = _cap_field(ge.summary or ge.canonical_title or "", 1024)
            if not wm:
                wm = "结合标题与来源核对是否与你业务相关。"

            ol_raw = row.get("one_liner")
            llm_ol = ol_raw.strip() if isinstance(ol_raw, str) and ol_raw.strip() else None
            one_liner = finalize_one_liner_for_event(
                llm_one_liner=llm_ol,
                why_important=wi,
                what_happened=wh,
                title=(ge.canonical_title or ""),
            )

            if _text_has_placeholder(wh) or _text_has_placeholder(wi) or _text_has_placeholder(wm):
                _log.warning(
                    "ranking_insight: LLM output still contains placeholder-like copy event_id=%s",
                    ge.id,
                )

            ge.what_happened = wh[:512]
            ge.why_important = wi[:1024]
            ge.what_it_means_for_you = wm[:1024]
            ge.action_suggestion = act[:32]
            ge.user_value_score = uv
            ge.capability_tags_json = json.dumps(caps, ensure_ascii=False)

            try:
                m_prev = json.loads(ge.metrics_json or "{}")
            except json.JSONDecodeError:
                m_prev = {}
            if not isinstance(m_prev, dict):
                m_prev = {}
            ri_meta: dict[str, Any] = {
                "applied": True,
                "user_value_score": uv,
                "enriched_at": now_iso,
            }
            if force:
                ri_meta["forced"] = True
            m_prev["ranking_insight"] = ri_meta
            m_prev["one_liner"] = one_liner
            ge.metrics_json = json.dumps(m_prev, ensure_ascii=False)
            batch_updated.append(ge.id)
        except Exception as exc:
            _log.warning("ranking_insight: apply failed event_id=%s: %s", ge.id, exc)
            continue
    return batch_updated


def enrich_ranking_insights(db: Session, limit: int | None = None, *, force: bool = False) -> int:
    """
    对候选 global_events 分批调用 LLM，写入判断字段与 capability_tags；
    批量 HTTP/解析失败时对批内事件逐条重试；成功写入后逐条 recalculate_global_event。
    返回成功写入并参与重算的事件数（近似）。

    force=True：忽略 RANKING_INSIGHT_ENABLED；候选不足时用高分事件补足；成功写入后一律
    metrics_json.ranking_insight.applied=true（覆盖旧兜底）。
    """
    settings = get_settings()
    lim = int(limit if limit is not None else settings.ranking_insight_limit)
    lim = max(1, min(lim, 200))
    batch_size = int(settings.ranking_insight_batch_size or 8)
    batch_size = max(4, min(batch_size, 10))
    timeout_s = float(settings.ranking_insight_timeout_seconds)
    model = settings.doubao_model

    if not force and not settings.ranking_insight_enabled:
        _log.info("ranking_insight: disabled (RANKING_INSIGHT_ENABLED=false)")
        return 0
    if force and not settings.ranking_insight_enabled:
        _log.warning("ranking_insight: force mode bypasses RANKING_INSIGHT_ENABLED=false")

    client = LlmJsonClient()
    if not client.is_configured():
        _log.info("ranking_insight: skipped (DOUBAO_API_KEY / DOUBAO_MODEL not set)")
        return 0

    ids = _collect_candidate_ids(db, limit=lim, force=force)
    if not ids:
        _log.info("ranking_insight: no candidates")
        return 0

    enriched = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for batch in _chunks(ids, batch_size):
        ges = [db.get(GlobalEvent, i) for i in batch]
        ges = [g for g in ges if g and g.status == "active"]
        if not ges:
            continue

        user_prompt = _user_prompt_for_events(ges)
        event_ids = [g.id for g in ges]
        prompt_chars = len(user_prompt)
        t0 = time.monotonic()
        _log.info(
            "ranking_insight: calling LLM batch_size=%s event_ids=%s prompt_chars=%s timeout_s=%s model=%s",
            len(ges),
            event_ids,
            prompt_chars,
            timeout_s,
            model,
        )

        batch_updated: list[int] = []
        try:
            raw = client.complete_json(
                system=_INSIGHT_SYSTEM,
                user=user_prompt,
                temperature=0.15,
                max_tokens=8192,
                json_retries=2,
                timeout_s=timeout_s,
            )
            dur = int((time.monotonic() - t0) * 1000)
            by_id = _by_id_from_raw(raw)
            batch_updated = _apply_insights_for_ges(ges, by_id, now_iso=now_iso, force=force)
            _log.info(
                "ranking_insight: LLM batch success duration_ms=%s updated=%s event_ids=%s",
                dur,
                len(batch_updated),
                batch_updated,
            )
        except Exception as exc:
            dur = int((time.monotonic() - t0) * 1000)
            _log.warning(
                "ranking_insight: LLM batch failed duration_ms=%s error_class=%s event_ids=%s: %s",
                dur,
                type(exc).__name__,
                event_ids,
                exc,
            )
            for ge in ges:
                one_prompt = _user_prompt_for_events([ge])
                t1 = time.monotonic()
                _log.info(
                    "ranking_insight: LLM fallback single event_id=%s prompt_chars=%s timeout_s=%s model=%s",
                    ge.id,
                    len(one_prompt),
                    timeout_s,
                    model,
                )
                try:
                    raw_one = client.complete_json(
                        system=_INSIGHT_SYSTEM,
                        user=one_prompt,
                        temperature=0.15,
                        max_tokens=8192,
                        json_retries=2,
                        timeout_s=timeout_s,
                    )
                    dur1 = int((time.monotonic() - t1) * 1000)
                    by_one = _by_id_from_raw(raw_one)
                    updated_one = _apply_insights_for_ges([ge], by_one, now_iso=now_iso, force=force)
                    if updated_one:
                        batch_updated.extend(updated_one)
                        _log.info(
                            "ranking_insight: LLM single success duration_ms=%s event_id=%s",
                            dur1,
                            ge.id,
                        )
                    else:
                        _log.warning(
                            "ranking_insight: LLM single no row duration_ms=%s event_id=%s",
                            dur1,
                            ge.id,
                        )
                except Exception as exc2:
                    dur1 = int((time.monotonic() - t1) * 1000)
                    _log.warning(
                        "ranking_insight: LLM single failed duration_ms=%s error_class=%s event_id=%s: %s",
                        dur1,
                        type(exc2).__name__,
                        ge.id,
                        exc2,
                    )

        if not batch_updated:
            continue

        try:
            db.commit()
        except Exception as exc:
            _log.exception("ranking_insight: commit failed: %s", exc)
            db.rollback()
            continue

        for gid in batch_updated:
            try:
                recalculate_global_event(db, gid)
            except Exception as exc:
                _log.warning("ranking_insight: recalculate failed id=%s: %s", gid, exc)
        try:
            db.commit()
        except Exception as exc:
            _log.exception("ranking_insight: post-recalc commit failed: %s", exc)
            db.rollback()
            continue

        enriched += len(batch_updated)

    _log.info("ranking_insight: enriched ~%s events (limit=%s)", enriched, lim)
    return enriched
