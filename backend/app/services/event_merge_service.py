from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any


def _canonical_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return ""
    u = re.sub(r"[?#].*$", "", u)
    return u


def _norm_title(title: str) -> str:
    t = (title or "").strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t


def _stable_event_key(cluster_key: str) -> str:
    """同一聚类键的稳定短哈希，用作 DB event_key / 去重。"""
    base = (cluster_key or "").strip()
    if not base:
        return "0000000000000000"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:16]


@dataclass
class EventEntity:
    event_key: str
    display_id: str
    title: str
    url: str
    items: list[dict[str, Any]]

    def merged_item(self) -> dict[str, Any]:
        """
        合并为一条「代表条目」，供评分摘要或多 Agent 使用。
        """
        best = max(self.items, key=lambda x: int(x.get("heat_score") or 0))
        title = (best.get("title") or self.title or "")[:500]
        url = (best.get("link") or best.get("url") or self.url or "")[:1000]
        summary_parts: list[str] = []
        for it in self.items[:5]:
            s = str(it.get("summary") or "").strip()
            if s:
                summary_parts.append(s[:600])
        merged = dict(best)
        merged["title"] = title
        merged["link"] = url
        merged["summary"] = " / ".join(summary_parts)[:4000]
        merged["_sources"] = sorted(
            {str(it.get("source_type") or it.get("source") or "") for it in self.items if it}
        )
        merged["_event_key"] = self.event_key
        merged["_display_id"] = self.display_id
        merged["_raw_item_ids"] = [it.get("id") for it in self.items if it.get("id") is not None]
        scores = [int(it.get("score_total") or it.get("_score_total") or 0) for it in self.items]
        merged["_score_total"] = max(scores) if scores else int(merged.get("_score_total") or 0)
        return merged


def merge_items_to_events(items: list[dict[str, Any]], *, max_events: int = 120) -> list[EventEntity]:
    """
    确定性合并 v1：
    - 优先 canonical URL 作为聚类键
    - 否则用规范化标题
    - event_key 为聚类键的稳定哈希，便于落库去重
    """
    by_key: dict[str, list[dict[str, Any]]] = {}
    for it in items:
        url = _canonical_url(str(it.get("link") or it.get("url") or ""))
        title = _norm_title(str(it.get("title") or ""))
        key = url if url else title
        if not key:
            continue
        by_key.setdefault(key, []).append(it)

    events: list[EventEntity] = []
    for idx, (k, group) in enumerate(by_key.items(), 1):
        best = max(group, key=lambda x: int(x.get("heat_score") or 0))
        ek = _stable_event_key(str(k))
        events.append(
            EventEntity(
                event_key=ek,
                display_id=f"e{idx:04d}",
                title=str(best.get("title") or ""),
                url=str(best.get("link") or best.get("url") or ""),
                items=sorted(group, key=lambda x: int(x.get("heat_score") or 0), reverse=True),
            )
        )

    events.sort(
        key=lambda e: int(max((int(it.get("heat_score") or 0) for it in e.items), default=0)),
        reverse=True,
    )
    return events[:max_events]
