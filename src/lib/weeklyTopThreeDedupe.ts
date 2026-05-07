/**
 * 周报 Top3：先按「事件簇」去重再取 3 条，避免同一新闻多标题占满名额。
 * 不依赖后端变更；若 payload 含 deduped_events / canonical_events 等则优先整段使用。
 */

/** 与 WeeklyLooseRow 兼容（避免与 weeklyPayloadUtils 循环依赖） */
type Row = Record<string, string>;

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'of',
  'in',
  'is',
  'it',
  'as',
  'at',
  'on',
  'be',
  'by',
  'with',
  'from',
  'new',
  'way',
  'less',
  'more',
  '的',
  '了',
  '和',
  '与',
  '在',
  '是',
  '为',
  '将',
  '对',
  '等',
]);

/** 大小写统一、去标点、压缩空白，用于相似度与兜底 key */
export function normalizeTopicTitle(raw: string): string {
  const t = (raw ?? '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d'"，。！？、；：（）【】《》]/g, ' ')
    .replace(/[^\w\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function tokenizeForJaccard(normalized: string): Set<string> {
  const parts = normalized.split(' ').filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    if (p.length <= 1 && !/\d/.test(p)) continue;
    if (STOP.has(p)) continue;
    out.add(p);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  return inter / (a.size + b.size - inter);
}

function normalizeUrlKey(u: string): string {
  const s = (u ?? '').trim();
  if (!s) return '';
  try {
    const x = new URL(s.startsWith('http') ? s : `https://${s}`);
    return `${x.hostname}${x.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return s.toLowerCase();
  }
}

/** 英文科技新闻常见实体 / 版本线索，用于「同一发布会多篇稿」合并 */
function extractTopicSignatures(blob: string): Set<string> {
  const t = (blob ?? '').toLowerCase();
  const sig = new Set<string>();
  if (/\bopenai\b/.test(t)) sig.add('openai');
  if (/\bchatgpt\b/.test(t)) sig.add('chatgpt');
  if (/\banthropic\b|\bclaude\b/.test(t)) sig.add('anthropic');
  if (/\bgoogle\b|\bgemini\b/.test(t)) sig.add('google');
  if (/\bmeta\b|\bllama\b/.test(t)) sig.add('meta');
  if (/\baws\b|\bbedrock\b|\bamazon\b/.test(t)) sig.add('aws');
  if (/gpt[\s\-]*[\d.]+\s*(instant|nano|mini|max)?/i.test(t) || /\bgpt[\s\-]*[\d.]+/i.test(t)) {
    sig.add('gpt-line');
  }
  if (/\bdefault\b/.test(t) && /\bmodel\b/.test(t)) sig.add('default-model');
  if (/\bhallucinat/.test(t)) sig.add('hallucination');
  if (/\bpersonaliz/.test(t) || /\bclearer\b|\bsmarter\b/.test(t)) sig.add('quality-claim');
  return sig;
}

function titleBlob(row: Row): string {
  return [
    row.title_zh,
    row.zh_title,
    row.event_title_zh,
    row.headline_zh,
    row.title,
    row.summary_title,
    row.source_title,
    row.original_title,
    row.raw_title,
    row.url,
    row.what_happened,
    row.why_important,
  ]
    .filter(Boolean)
    .join(' ');
}

export function getWeeklyEventDedupeKey(row: Row): string {
  const rawId = [
    row.cluster_id,
    row.topic_id,
    row.event_group_id,
    row.canonical_url,
    row.source_url,
    row.url,
  ]
    .map((x) => (x ?? '').trim())
    .find(Boolean);
  if (rawId) return `id:${rawId}`;
  return `sig:${normalizeTopicTitle(titleBlob(row)).slice(0, 220)}`;
}

function idsMatch(a: string | undefined, b: string | undefined): boolean {
  const x = (a ?? '').trim();
  const y = (b ?? '').trim();
  return Boolean(x && y && x === y);
}

export function isSameWeeklyEvent(a: Row, b: Row): boolean {
  if (idsMatch(a.event_id, b.event_id)) return true;
  if (idsMatch(a.cluster_id, b.cluster_id)) return true;
  if (idsMatch(a.topic_id, b.topic_id)) return true;
  if (idsMatch(a.event_group_id, b.event_group_id)) return true;

  const ua = normalizeUrlKey(a.canonical_url || a.url);
  const ub = normalizeUrlKey(b.canonical_url || b.url);
  if (ua && ub && ua === ub) return true;
  const sa = normalizeUrlKey(a.source_url || '');
  const sb = normalizeUrlKey(b.source_url || '');
  if (sa && sb && sa === sb) return true;

  const blobA = titleBlob(a);
  const blobB = titleBlob(b);
  const na = normalizeTopicTitle(blobA);
  const nb = normalizeTopicTitle(blobB);
  if (na && nb) {
    if (na === nb) return true;
    if (na.length >= 12 && nb.length >= 12 && (na.includes(nb) || nb.includes(na))) return true;
    const ja = jaccard(tokenizeForJaccard(na), tokenizeForJaccard(nb));
    if (ja >= 0.32) return true;
  }

  const sigA = extractTopicSignatures(blobA);
  const sigB = extractTopicSignatures(blobB);
  const overlap = [...sigA].filter((x) => sigB.has(x));
  if (overlap.length >= 2) return true;
  if (sigA.has('gpt-line') && sigB.has('gpt-line') && (sigA.has('openai') || sigA.has('chatgpt')) && (sigB.has('openai') || sigB.has('chatgpt'))) {
    return true;
  }
  /* 同一模型发布：首条可能仅为产品名行，未必含 OpenAI 字样 */
  if (sigA.has('gpt-line') && sigB.has('gpt-line')) {
    const ins = /\binstant\b/i;
    if (ins.test(blobA) && ins.test(blobB)) return true;
    const ja = jaccard(tokenizeForJaccard(na), tokenizeForJaccard(nb));
    if (ja >= 0.2) return true;
  }

  if (getWeeklyEventDedupeKey(a) === getWeeklyEventDedupeKey(b)) return true;

  return false;
}

const BACKEND_DEDUPED_KEYS = [
  'deduped_events',
  'canonical_events',
  'weekly_top_events',
  'grouped_events',
] as const;

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null;
}

/** 若后端已提供去重后列表，整段作为候选（保持顺序） */
export function pickBackendDedupedArray(normal: Record<string, unknown>): unknown[] | null {
  for (const k of BACKEND_DEDUPED_KEYS) {
    const v = normal[k];
    if (isObjectArray(v)) return v;
  }
  const topics = normal.topics;
  if (Array.isArray(topics) && topics.length > 0) {
    const first = topics[0];
    if (typeof first === 'object' && first !== null && ('title' in first || 'items' in first)) {
      return topics as unknown[];
    }
  }
  return null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** 从 section 收集 items（保持栏目顺序） */
function collectSectionItems(normal: Record<string, unknown>): unknown[] {
  const sections = normal.sections;
  if (!Array.isArray(sections)) return [];
  const out: unknown[] = [];
  for (const sec of sections) {
    if (!sec || typeof sec !== 'object') continue;
    const items = (sec as { items?: unknown[] }).items;
    if (!Array.isArray(items)) continue;
    for (const it of items) out.push(it);
  }
  return out;
}

function simpleLines(payload: Record<string, unknown>): unknown[] {
  const simple = payload.simple;
  if (!simple || typeof simple !== 'object') return [];
  const lines = (simple as { lines?: unknown[] }).lines;
  return Array.isArray(lines) ? lines : [];
}

/**
 * 按优先级展开候选 raw 对象（先全局顺序遍历，再由 isSameWeeklyEvent 去重取前 3 个唯一事件）。
 */
export function gatherWeeklyTopThreeCandidateRaws(
  payload: Record<string, unknown>,
  normal: Record<string, unknown>,
): unknown[] {
  const backend = pickBackendDedupedArray(normal);
  if (backend) return backend;

  const out: unknown[] = [];
  const pushAll = (arr: unknown[]) => {
    for (const x of arr) out.push(x);
  };

  pushAll(asArray(normal.top3_judgments));
  pushAll(asArray(normal.top3));
  pushAll(asArray(normal.weekly_judgments));
  pushAll(asArray(normal.top5_information));
  pushAll(collectSectionItems(normal));
  pushAll(simpleLines(payload));

  return out;
}

function cjkCount(s: string): number {
  return (s.match(/[\u4e00-\u9fff]/g) || []).length;
}

/** 从中文「发生了什么」里取首句作为事件标题候选（非全文） */
export function extractChineseEventHeadlineFromWhatHappened(wh: string): string | undefined {
  const t = (wh ?? '').trim();
  if (!/[\u4e00-\u9fff]/.test(t)) return undefined;
  const first = t.split(/(?<=[。！？])/)[0]?.trim() || t.split(/[\n\u2028]/)[0]?.trim() || t;
  const s = first.trim();
  if (s.length < 6) return undefined;
  return s.length > 120 ? `${s.slice(0, 119)}…` : s;
}

function scoreZhTitleCandidate(s: string): number {
  const t = s.trim();
  if (!t) return -1;
  if (t.length > 220) return cjkCount(t) * 2;
  const c = cjkCount(t);
  if (c === 0) return t.length * 0.05;
  return c * 12 + Math.min(t.length, 90);
}

function pickBetterZhTitleField(a: string, b: string): string {
  const ta = a.trim();
  const tb = b.trim();
  if (!ta) return tb;
  if (!tb) return ta;
  return scoreZhTitleCandidate(tb) > scoreZhTitleCandidate(ta) ? tb : ta;
}

function collectZhTitleCandidates(row: Row): string[] {
  const out: string[] = [];
  for (const k of ['title_zh', 'zh_title', 'event_title_zh', 'headline_zh']) {
    const v = (row[k] ?? '').trim();
    if (v) out.push(v);
  }
  const ex = extractChineseEventHeadlineFromWhatHappened(row.what_happened ?? '');
  if (ex) out.push(ex);
  return out;
}

function bestZhHeadlineFromRow(row: Row): string {
  const cands = collectZhTitleCandidates(row);
  if (cands.length === 0) return '';
  return cands.reduce((best, cur) => (scoreZhTitleCandidate(cur) > scoreZhTitleCandidate(best) ? cur : best), '');
}

function mergeParagraphPreferRich(a: string, b: string, maxLen: number): string {
  const x = a.trim();
  const y = b.trim();
  if (!y) return x.slice(0, maxLen);
  if (!x) return y.slice(0, maxLen);
  if (x.includes(y) || y.includes(x)) return (x.length >= y.length ? x : y).slice(0, maxLen);
  if (cjkCount(y) > cjkCount(x) + 4 && y.length > 24) return y.slice(0, maxLen);
  if (cjkCount(x) > cjkCount(y) + 4 && x.length > 24) return x.slice(0, maxLen);
  const merged = `${x}；${y}`;
  return merged.length > maxLen ? `${merged.slice(0, maxLen - 1)}…` : merged;
}

function mergeUrlLines(...chunks: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const addLine = (line: string) => {
    const u = line.trim();
    if (!u) return;
    const key = normalizeUrlKey(u);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(u);
  };
  const addChunk = (chunk: string | undefined) => {
    if (!chunk?.trim()) return;
    for (const line of chunk.split(/\n+/)) addLine(line);
  };
  for (const c of chunks) addChunk(c);
  return out.join('\n');
}

function mergeIdLines(...chunks: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw?.trim()) return;
    for (const id of raw.split(/[,，]/)) {
      const x = id.trim();
      if (x && !seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
  };
  for (const c of chunks) add(c);
  return out.join(',');
}

/**
 * 将同簇后续条目合并进保留项：择优中文标题、合并摘要/来源/关联事件。
 */
export function mergeWeeklyClusterItems<T extends Row>(primary: T, secondary: T): T {
  const p = primary as Record<string, string>;
  const s = secondary as Record<string, string>;
  const out: Record<string, string> = {...p};

  const mergedZh = pickBetterZhTitleField(bestZhHeadlineFromRow(primary), bestZhHeadlineFromRow(secondary));
  if (mergedZh) out.title_zh = mergedZh;

  out.what_happened = mergeParagraphPreferRich(p.what_happened ?? '', s.what_happened ?? '', 900);
  out.why_important = mergeParagraphPreferRich(p.why_important ?? '', s.why_important ?? '', 900);
  out.what_it_means_for_you = mergeParagraphPreferRich(
    p.what_it_means_for_you ?? '',
    s.what_it_means_for_you ?? '',
    900,
  );

  out.source_urls = mergeUrlLines(p.source_urls, s.source_urls, p.url, s.url);

  const pe = (p.event_id ?? '').trim();
  const se = (s.event_id ?? '').trim();
  out.event_id = pe || se;
  out.related_event_ids = mergeIdLines(p.related_event_ids, s.related_event_ids, pe, se);

  return out as T;
}

/**
 * 候选池完整遍历：同簇合并增强 canonical；独立主题最多保留 3 条（不重复补位）。
 * 独立主题不足 3 时仅在开发环境 console.warn。
 */
export function pickMergedWeeklyTopThree<T extends Row>(rowsInOrder: T[]): T[] {
  const picked: T[] = [];
  for (const row of rowsInOrder) {
    const idx = picked.findIndex((p) => isSameWeeklyEvent(p, row));
    if (idx >= 0) {
      picked[idx] = mergeWeeklyClusterItems(picked[idx], row);
      continue;
    }
    if (picked.length < 3) {
      picked.push(row);
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && picked.length < 3) {
    console.warn(
      `[ai-pulse] weekly Top3 independent topics < 3 (got ${picked.length}). Consider expanding backend candidate pool or cluster-level Top3 generation.`,
    );
  }
  return picked;
}

/** @deprecated 仅向后兼容；请使用 pickMergedWeeklyTopThree */
export function pickDedupedWeeklyTopThree<T extends Row>(rowsInOrder: T[]): T[] {
  return pickMergedWeeklyTopThree(rowsInOrder);
}
