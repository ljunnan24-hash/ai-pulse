/** 周报 payload 解析与展示辅助（不改 API，仅前端容错） */

import {
  extractChineseEventHeadlineFromWhatHappened,
  gatherWeeklyTopThreeCandidateRaws,
  pickMergedWeeklyTopThree,
} from '../../lib/weeklyTopThreeDedupe';

export function fmtBoundaryField(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join('；');
  return String(v);
}

export function linesFromBoundaryField(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = fmtBoundaryField(v);
  if (!s) return [];
  return s
    .split(/[；;\n\u2028]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export type GlossaryRow = { term: string; explain: string };

export function normalizeGlossary(payload: Record<string, unknown>, normal: Record<string, unknown>): GlossaryRow[] {
  const raw = (payload.glossary ?? normal.glossary) as unknown;
  if (!Array.isArray(raw)) return [];
  const rows: GlossaryRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const term = String(o.term ?? o.word ?? o.name ?? '').trim();
    const explain = String(o.explanation ?? o.definition ?? o.desc ?? o.explain ?? '').trim();
    if (!term && !explain) continue;
    rows.push({ term, explain });
    if (rows.length >= 6) break;
  }
  return rows;
}

/** 粗略估算中文阅读分钟数（字符数 / 每分钟阅读量） */
export function estimateReadingMinutes(payload: Record<string, unknown>): number {
  const blob = JSON.stringify(payload);
  const minutes = Math.ceil(blob.length / 420);
  return Math.max(3, Math.min(30, minutes || 6));
}

/** 周报条目（沿用后端已有字段名，不改 API） */
export type WeeklyLooseRow = Record<string, string>;

const WEEKLY_OPTIONAL_KEYS = [
  'title_zh',
  'zh_title',
  'event_title_zh',
  'headline_zh',
  'summary_title',
  'title_en',
  'source_title',
  'original_title',
  'raw_title',
  'user_value',
  'meaning_for_user',
  'what_it_means',
  'why_it_matters',
  'why_it_matters_to_you',
  'summary',
  'cluster_id',
  'topic_id',
  'event_group_id',
  'canonical_url',
  'source_url',
  'category_slug',
  'tag',
  'type',
] as const;

/** 分类取值优先级（与后端补全一致） */
export function pickCategoryFromRawObject(o: Record<string, unknown>): string {
  for (const k of ['category_slug', 'category', 'theme', 'tag', 'type'] as const) {
    const v = String(o[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

/** 归一化行上的分类原始串（用于解析 pill） */
export function pickWeeklyCategoryRaw(row: WeeklyLooseRow): string {
  const r = row as Record<string, string>;
  for (const k of ['category_slug', 'category', 'theme', 'tag', 'type']) {
    const v = (r[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

export function normalizeWeeklyRow(raw: unknown): WeeklyLooseRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? o.headline ?? o.event_title ?? o.name ?? '').trim();
  if (!title) return null;
  const cat = pickCategoryFromRawObject(o);
  const base: WeeklyLooseRow = {
    title: title.slice(0, 400),
    url: String(o.url ?? (o as { link?: unknown }).link ?? '').trim(),
    what_happened: String(o.what_happened ?? '').trim(),
    why_important: String(o.why_important ?? o.why_it_matters ?? '').trim(),
    what_it_means_for_you: String(o.what_it_means_for_you ?? '').trim(),
    pulse_score: String(
      o.pulse_score ??
        o.score_total ??
        o.ranking_score ??
        (o as { _score_total?: unknown })._score_total ??
        '',
    ),
    category: cat,
    theme: String(o.theme ?? o.category ?? '').trim() || cat,
    event_id: String(o.event_id ?? (o as { global_event_id?: unknown }).global_event_id ?? '').trim(),
    source_name: String(o.source_name ?? '').trim(),
  };
  const su = o.source_urls;
  if (Array.isArray(su) && su.length > 0) {
    base.source_urls = su.map((x) => String(x).trim()).filter(Boolean).join('\n');
  } else if (typeof su === 'string' && su.trim()) {
    base.source_urls = su.trim();
  }
  for (const k of WEEKLY_OPTIONAL_KEYS) {
    const v = o[k];
    if (v != null && String(v).trim()) base[k] = String(v).trim();
  }
  const rel = o.related_event_ids;
  if (Array.isArray(rel) && rel.length > 0) {
    base.related_event_ids = rel.map((x) => String(x)).join(',');
  } else if (rel != null && String(rel).trim()) {
    base.related_event_ids = String(rel).trim();
  }
  return base;
}

/**
 * 周报主标题：优先中文客观事件标题；what_happened 仅取可提炼的首句，不用全文。
 */
export function weeklyPulseTitleZh(row: WeeklyLooseRow): string {
  for (const k of ['title_zh', 'zh_title', 'event_title_zh', 'headline_zh']) {
    const v = (row[k] ?? '').trim();
    if (v) return v;
  }
  const head = extractChineseEventHeadlineFromWhatHappened(row.what_happened ?? '');
  if (head) return head;
  for (const k of ['title', 'source_title', 'original_title']) {
    const v = (row[k] ?? '').trim();
    if (v) return v;
  }
  return '—';
}

export function weeklyPulseTitleEn(row: WeeklyLooseRow): string | undefined {
  const te = (row.title_en ?? '').trim();
  if (te) return te;
  const display = weeklyPulseTitleZh(row);
  const t = (row.title ?? '').trim();
  if (t && display !== t && !/[\u4e00-\u9fff]/.test(t)) return t;
  const st = (row.source_title ?? '').trim();
  if (st && display !== st && !/[\u4e00-\u9fff]/.test(st)) return st;
  const ot = (row.original_title ?? '').trim();
  if (ot && display !== ot && !/[\u4e00-\u9fff]/.test(ot)) return ot;
  const rt = (row.raw_title ?? '').trim();
  if (rt && display !== rt && !/[\u4e00-\u9fff]/.test(rt)) return rt;
  return undefined;
}

export function weeklyPulseMeaning(row: WeeklyLooseRow): string {
  for (const k of [
    'what_it_means_for_you',
    'why_it_matters',
    'user_value',
    'meaning_for_user',
    'what_it_means',
    'why_it_matters_to_you',
    'summary',
    'why_important',
    'what_happened',
  ]) {
    const v = (row[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

/** Top3 表格 Score 列：兼容 pulse_score / ranking_score / score_total（后端 orchestrator 常用） */
export function weeklyPulseDisplayScore(row: WeeklyLooseRow): number {
  const r = row as Record<string, string>;
  const raw = (row.pulse_score ?? row.ranking_score ?? r.score_total ?? r._score_total ?? '').trim();
  if (!raw) return 0;
  const p = Number(raw);
  if (!Number.isFinite(p)) return 0;
  const v = p >= 0 && p <= 1 ? p * 100 : p;
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

/** 分类原始串（小写）用于旧逻辑；周报展示请用 {@link pickWeeklyCategoryRaw} + resolveWeeklyCategoryDisplay */
export function weeklyRowCategorySlug(row: WeeklyLooseRow): string {
  const raw = pickWeeklyCategoryRaw(row);
  return raw.toLowerCase();
}

/**
 * 组装「本周最重要的若干条信息」（最多 5 条）：优先显式 top5_information；否则合并 top3 与分类条目补足。
 */
export function collectWeeklyTopInformation(normal: Record<string, unknown>): WeeklyLooseRow[] {
  const explicit = normal.top5_information;
  if (Array.isArray(explicit) && explicit.length > 0) {
    const rows: WeeklyLooseRow[] = [];
    for (const x of explicit) {
      const r = normalizeWeeklyRow(x);
      if (r) rows.push(r);
      if (rows.length >= 5) break;
    }
    if (rows.length > 0) return rows;
  }

  const t3j = (normal.top3_judgments as WeeklyLooseRow[] | undefined) || [];
  const leg = (normal.top3 as WeeklyLooseRow[] | undefined) || [];
  const primary = t3j.length > 0 ? t3j : leg;
  const out: WeeklyLooseRow[] = [];

  for (const row of primary) {
    const r = normalizeWeeklyRow(row);
    if (r) out.push(r);
    if (out.length >= 5) return out.slice(0, 5);
  }

  const sections = (normal.sections as Array<{ items?: unknown[] }> | undefined) || [];
  outer: for (const sec of sections) {
    for (const it of sec.items || []) {
      if (out.length >= 5) break outer;
      const r = normalizeWeeklyRow(it);
      if (!r) continue;
      if (out.some((x) => x.title === r.title)) continue;
      out.push(r);
    }
  }

  return out.slice(0, 5);
}

/**
 * `top3_judgments` 往往不带 category/url；同序的 legacy `normal.top3` 已由后端合并选题信息时常带有分类与链接。
 * 仅在 judgment 侧对应字段为空时写入，不覆盖已有值。
 */
export function enrichWeeklyTopThreeWithLegacyTop3(rows: WeeklyLooseRow[], legacyTop3: unknown): WeeklyLooseRow[] {
  if (!Array.isArray(legacyTop3) || legacyTop3.length === 0) return rows;
  return rows.map((row, i) => {
    const leg = legacyTop3[i];
    if (!leg || typeof leg !== 'object') return row;
    const o = leg as Record<string, unknown>;
    const out: WeeklyLooseRow = { ...row };

    if (!pickWeeklyCategoryRaw(out)) {
      const cat = pickCategoryFromRawObject(o);
      if (cat) {
        out.category = cat;
        out.theme = cat;
      }
    }

    if (!(out.event_id ?? '').trim()) {
      const eid = String(o.event_id ?? '').trim();
      if (eid) out.event_id = eid;
    }

    if (!(out.url ?? '').trim()) {
      const u = String(o.url ?? '').trim();
      if (u) out.url = u;
      else {
        const su = o.source_urls;
        if (Array.isArray(su) && su.length > 0) {
          const first = String(su[0] ?? '').trim();
          if (first) out.url = first;
        }
      }
    }

    if (!(out.source_urls ?? '').trim()) {
      const su = o.source_urls;
      if (Array.isArray(su) && su.length > 0) {
        out.source_urls = su.map((x) => String(x).trim()).filter(Boolean).join('\n');
      } else if (typeof su === 'string' && su.trim()) {
        out.source_urls = su.trim();
      }
    }

    if (!(out.related_event_ids ?? '').trim()) {
      const rel = o.related_event_ids;
      if (Array.isArray(rel) && rel.length > 0) {
        out.related_event_ids = rel.map((x) => String(x)).join(',');
      }
    }

    return out;
  });
}

/**
 * 本周最重要的三件事：
 * - 候选来自 top3_judgments → top3 → weekly_judgments → top5_information → sections.items → simple.lines；
 * - 若 normal 含 deduped_events / canonical_events 等后端去重列表则优先仅用该列表；
 * - 同簇条目合并进保留项（择优中文标题、合并摘要与来源）；独立主题最多 3 条，不足不重复补位。
 */
export function getWeeklyTopThreeJudgments(payload: Record<string, unknown>): WeeklyLooseRow[] {
  const normal = (payload.normal as Record<string, unknown> | undefined) || {};
  const raws = gatherWeeklyTopThreeCandidateRaws(payload, normal);
  const normalized: WeeklyLooseRow[] = [];
  for (const raw of raws) {
    const r = normalizeWeeklyRow(raw);
    if (r) normalized.push(r);
  }
  return pickMergedWeeklyTopThree(normalized);
}

export function isAffirmativeNoise(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === 'yes' || t === 'y' || t === '是' || t === 'true';
}
