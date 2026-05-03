from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Any


WEIGHTS = {
    "practical": 30,
    "accessible": 20,
    "impact": 20,
    "opportunity": 15,
    "maturity": 10,
    "trend": 5,
}


@dataclass(frozen=True)
class ScoreBreakdown:
    practical: int
    accessible: int
    impact: int
    opportunity: int
    maturity: int
    trend: int
    total: int
    notes: list[str]

    def to_json(self) -> str:
        return json.dumps(
            {
                "weights": WEIGHTS,
                "scores": {
                    "practical": self.practical,
                    "accessible": self.accessible,
                    "impact": self.impact,
                    "opportunity": self.opportunity,
                    "maturity": self.maturity,
                    "trend": self.trend,
                    "total": self.total,
                },
                "notes": self.notes,
            },
            ensure_ascii=False,
        )


def _clip(v: float, lo: int, hi: int) -> int:
    return int(max(lo, min(hi, round(v))))


def _sigmoid(x: float) -> float:
    # stable sigmoid for scoring curves
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    z = math.exp(x)
    return z / (1 + z)


def _contains_any(text: str, keywords: list[str]) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in keywords)


def score_item(item: dict[str, Any]) -> ScoreBreakdown:
    """
    Deterministic 6-dim scoring aligned to PRD weights.

    Inputs:
      - item: normalized dict from crawler layer; may include:
        - source_type: official|media|github|community|social|rss（爬虫输出以 PRD 为准）
        - title/summary/link/published_at/heat_score
        - github: { stars, stars_growth, language }

    Output:
      - Each dimension is 0..weight, total is 0..100.
    """
    title = str(item.get("title") or "")
    summary = str(item.get("summary") or "")
    source_type = str(item.get("source_type") or "rss")
    heat = int(item.get("heat_score") or 0)
    text = f"{title}\n{summary}"

    notes: list[str] = []

    # PRD §七：来源可信度（P0 最小 tier 数字）。缺失时按 RSS 默认 tier≈2。
    try:
        tier_raw = item.get("source_tier")
        tier = int(tier_raw) if tier_raw is not None else 2
    except (TypeError, ValueError):
        tier = 2
    tier = max(0, min(4, tier))
    trust_bonus = (4 - tier) * 2
    if trust_bonus:
        notes.append(f"source_tier_{tier}_trust")

    # 1) Practical (0..30)
    practical = 10
    if _contains_any(text, ["release", "推出", "发布", "上线", "开放", "开放商用", "可用", "available", "launch"]):
        practical += 8
        notes.append("release_signal")
    if _contains_any(text, ["workflow", "办公", "效率", "product", "tool", "助手", "copilot", "agent"]):
        practical += 6
        notes.append("workflow_signal")
    if source_type == "github":
        practical += 6
        notes.append("github_practical_proxy")
    practical = _clip(practical, 0, WEIGHTS["practical"])

    # 2) Accessible (0..20)
    accessible = 8
    if _contains_any(text, ["no login", "无需登录", "无需注册", "free", "开源", "open-source", "open source"]):
        accessible += 6
        notes.append("low_friction")
    if _contains_any(text, ["api", "sdk", "部署", "self-host", "训练", "fine-tune", "finetune"]):
        accessible -= 4
        notes.append("requires_tech")
    if source_type == "github":
        accessible += 2
    accessible = _clip(accessible, 0, WEIGHTS["accessible"])

    # 3) Impact (0..20): use heat and GitHub stars as proxy
    impact = 6
    if heat > 0:
        # Map heat to 0..14 via sigmoid; RSS heat is ~0..1000, GitHub heat can be 5k+
        scale = 5000 if source_type == "github" else 800
        impact += 14 * _sigmoid((heat - scale * 0.6) / (scale * 0.2))
        notes.append("heat_proxy")
    impact = _clip(impact, 0, WEIGHTS["impact"])

    # 4) Opportunity (0..15)
    opportunity = 5
    if _contains_any(text, ["monetize", "商业", "商用", "enterprise", "b2b", "赚钱", "机会"]):
        opportunity += 6
        notes.append("commercial_signal")
    if source_type == "github":
        opportunity += 4
    opportunity = _clip(opportunity, 0, WEIGHTS["opportunity"])

    # 5) Maturity (0..10)
    maturity = 4
    if _contains_any(text, ["beta", "preview", "实验", "paper", "论文", "research", "benchmark"]):
        maturity -= 2
        notes.append("research_stage")
    if _contains_any(text, ["ga", "general availability", "已上线", "production", "商用", "可商用"]):
        maturity += 4
        notes.append("production_stage")
    if source_type == "github":
        gh = item.get("github") if isinstance(item.get("github"), dict) else {}
        stars = int((gh or {}).get("stars") or 0)
        # More stars -> more maturity proxy
        maturity += 4 * _sigmoid((stars - 8000) / 2500)
        notes.append("stars_maturity_proxy")
    maturity = _clip(maturity, 0, WEIGHTS["maturity"])

    # 6) Trend (0..5): "practicalization / lightweight" direction proxy
    trend = 2
    if _contains_any(text, ["轻量", "轻量化", "efficient", "成本", "latency", "speed", "实用化", "落地"]):
        trend += 2
        notes.append("practical_trend")
    if _contains_any(text, ["agent", "自动化", "workflow", "tool", "copilot", "assistant", "助手"]):
        trend += 1
    trend = _clip(trend, 0, WEIGHTS["trend"])

    total = int(practical + accessible + impact + opportunity + maturity + trend + trust_bonus)
    total = _clip(total, 0, 100)

    return ScoreBreakdown(
        practical=int(practical),
        accessible=int(accessible),
        impact=int(impact),
        opportunity=int(opportunity),
        maturity=int(maturity),
        trend=int(trend),
        total=int(total),
        notes=sorted(set(notes)),
    )

