"""
daily_rankings：过滤已在 raw_items（issue_id NULL）中的条目，避免重复入库。
"""

from __future__ import annotations

from sqlalchemy import inspect as sa_inspect, select
from sqlalchemy.orm import Session

from app.models import RawItem
from app.utils.url_dedupe import attach_raw_dedupe_fields, item_stable_dedupe_key

_CHUNK = 400


def _raw_item_column_names(db: Session) -> set[str]:
    bind = db.get_bind()
    if bind is None:
        return set()
    insp = sa_inspect(bind)
    if not insp.has_table("raw_items"):
        return set()
    return {c["name"] for c in insp.get_columns("raw_items")}


def filter_new_items_for_daily_rankings(db: Session, items: list[dict]) -> list[dict]:
    """
    返回应插入 raw_items 的 items 子集（已附加 _normalized_* 字段）。
    规则：本批次内 item_stable_dedupe_key 去重；库内 normalized_link_hash / link 原文 /
    normalized_link（旧行回填后可命中）任一命中则跳过。
    若物理表尚无 normalized_* 列，则仅按 link 与批次内键查重。
    """
    if not items:
        return []

    cols = _raw_item_column_names(db)
    has_nh = "normalized_link_hash" in cols
    has_nl = "normalized_link" in cols

    for it in items:
        attach_raw_dedupe_fields(it)

    hashes = sorted({it["_normalized_link_hash"] for it in items if it.get("_normalized_link_hash")})
    links = sorted({(it.get("link") or "").strip() for it in items if (it.get("link") or "").strip()})
    norms = sorted({it["_normalized_link"] for it in items if it.get("_normalized_link")})

    existing_hashes: set[str] = set()
    existing_links: set[str] = set()
    existing_norms: set[str] = set()

    def _ingest_hash_rows(rows: list) -> None:
        for row in rows:
            if has_nh and has_nl:
                nh, lk, nl = row[0], row[1], row[2]
            elif has_nh:
                nh, lk, nl = row[0], row[1], None
            else:
                continue
            if nh:
                existing_hashes.add(str(nh).strip())
            if lk:
                existing_links.add(str(lk).strip())
            if nl:
                existing_norms.add(str(nl).strip())

    def _ingest_link_rows(rows: list) -> None:
        for row in rows:
            if has_nh and has_nl:
                nh, lk, nl = row[0], row[1], row[2]
            elif has_nh:
                nh, lk, nl = row[0], row[1], None
            elif has_nl:
                nh, lk, nl = None, row[0], row[1]
            else:
                nh, lk, nl = None, row[0], None
            if nh:
                existing_hashes.add(str(nh).strip())
            if lk:
                existing_links.add(str(lk).strip())
            if nl:
                existing_norms.add(str(nl).strip())

    def _ingest_norm_rows(rows: list) -> None:
        for row in rows:
            if has_nh and has_nl:
                nh, lk, nl = row[0], row[1], row[2]
            elif has_nl:
                nh, lk, nl = None, row[0], row[1]
            else:
                continue
            if nh:
                existing_hashes.add(str(nh).strip())
            if lk:
                existing_links.add(str(lk).strip())
            if nl:
                existing_norms.add(str(nl).strip())

    if has_nh:
        for i in range(0, len(hashes), _CHUNK):
            part = hashes[i : i + _CHUNK]
            if not part:
                continue
            if has_nl:
                stmt = select(
                    RawItem.normalized_link_hash,
                    RawItem.link,
                    RawItem.normalized_link,
                ).where(RawItem.issue_id.is_(None), RawItem.normalized_link_hash.in_(part))
            else:
                stmt = select(RawItem.normalized_link_hash, RawItem.link).where(
                    RawItem.issue_id.is_(None),
                    RawItem.normalized_link_hash.in_(part),
                )
            _ingest_hash_rows(list(db.execute(stmt).all()))

    for i in range(0, len(links), _CHUNK):
        part = links[i : i + _CHUNK]
        if not part:
            continue
        if has_nh and has_nl:
            stmt = select(
                RawItem.normalized_link_hash,
                RawItem.link,
                RawItem.normalized_link,
            ).where(RawItem.issue_id.is_(None), RawItem.link.in_(part))
        elif has_nh:
            stmt = select(RawItem.normalized_link_hash, RawItem.link).where(
                RawItem.issue_id.is_(None),
                RawItem.link.in_(part),
            )
        elif has_nl:
            stmt = select(RawItem.link, RawItem.normalized_link).where(
                RawItem.issue_id.is_(None),
                RawItem.link.in_(part),
            )
        else:
            stmt = select(RawItem.link).where(RawItem.issue_id.is_(None), RawItem.link.in_(part))
        _ingest_link_rows(list(db.execute(stmt).all()))

    if has_nl:
        for i in range(0, len(norms), _CHUNK):
            part = norms[i : i + _CHUNK]
            if not part:
                continue
            if has_nh:
                stmt = select(
                    RawItem.normalized_link_hash,
                    RawItem.link,
                    RawItem.normalized_link,
                ).where(RawItem.issue_id.is_(None), RawItem.normalized_link.in_(part))
            else:
                stmt = select(RawItem.link, RawItem.normalized_link).where(
                    RawItem.issue_id.is_(None),
                    RawItem.normalized_link.in_(part),
                )
            _ingest_norm_rows(list(db.execute(stmt).all()))

    batch_seen: set[str] = set()
    out: list[dict] = []
    for it in items:
        k = item_stable_dedupe_key(it)
        if k in batch_seen:
            continue
        nh = (it.get("_normalized_link_hash") or "").strip()
        lk = (it.get("link") or "").strip()
        norm = (it.get("_normalized_link") or "").strip()
        if has_nh and nh and nh in existing_hashes:
            continue
        if lk and lk in existing_links:
            continue
        if has_nl and norm and norm in existing_norms:
            continue
        batch_seen.add(k)
        out.append(it)
    return out
