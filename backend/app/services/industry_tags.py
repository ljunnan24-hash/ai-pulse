"""
领域 / 场景补充标签（metrics_json.industry_tags）：全大类通用，规则关键词匹配，不写 LLM。

字段名仍为 industry_tags，兼容搜索与既有接口；语义上涵盖「相关领域、适用行业、场景」。
"""

from __future__ import annotations

import json
import re
from typing import Any

# (slug, label_zh, keywords) — 关键词大小写不敏感；中文按子串匹配
_INDUSTRY_DEFS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        "education",
        "教育",
        (
            "教育",
            "学校",
            "课程",
            "学习",
            "教培",
            "教师",
            "学生",
            "高校",
            "mooc",
            "tutor",
            "school",
            "education",
            "university",
            "teaching",
            "course",
            "learning",
            "老师",
        ),
    ),
    (
        "healthcare",
        "医疗",
        (
            "医疗",
            "临床",
            "医院",
            "诊断",
            "药物",
            "患者",
            "医保",
            "hospital",
            "fda",
            "healthcare",
            "medical",
            "clinical",
            "pharma",
            "health",
            "diagnostics",
        ),
    ),
    (
        "finance",
        "金融",
        (
            "金融",
            "银行",
            "交易",
            "投研",
            "风控",
            "证券",
            "基金",
            "支付",
            "finance",
            "banking",
            "trading",
            "investment",
            "fintech",
        ),
    ),
    (
        "ecommerce",
        "电商",
        (
            "电商",
            "零售",
            "跨境",
            "购物",
            "商品",
            "店铺",
            "亚马逊",
            "淘宝",
            "京东",
            "ecommerce",
            "shopify",
            "amazon",
            "retail",
            "commerce",
            "seller",
        ),
    ),
    (
        "content_creation",
        "内容创作",
        (
            "短视频",
            "创作者",
            "内容",
            "营销",
            "直播",
            "自媒体",
            "文案",
            "广告",
            "图像生成",
            "视频生成",
            "creator",
            "content",
            "ugc",
            "influencer",
            "video",
            "image",
            "marketing",
        ),
    ),
    (
        "gaming",
        "游戏",
        (
            "游戏",
            "玩家",
            "手游",
            "端游",
            "steam",
            "工作室",
            "npc",
            "gaming",
            "game",
            "esports",
            "studio",
        ),
    ),
    (
        "legal",
        "法律",
        (
            "法律",
            "合规",
            "诉讼",
            "版权",
            "律师",
            "合同",
            "legal",
            "compliance",
            "lawsuit",
            "copyright",
        ),
    ),
    (
        "manufacturing",
        "制造业",
        (
            "制造",
            "工厂",
            "供应链",
            "工业",
            "车间",
            "manufacturing",
            "factory",
            "supply chain",
            "industrial",
        ),
    ),
    (
        "automotive",
        "汽车",
        (
            "汽车",
            "车企",
            "车载",
            "自动驾驶",
            "整车",
            "automotive",
            "vehicle",
        ),
    ),
    (
        "robotics",
        "机器人",
        (
            "机器人",
            "具身智能",
            "具身",
            "机械臂",
            "自动驾驶机器人",
            "robotics",
            "robot",
            "embodied",
        ),
    ),
    (
        "real_estate",
        "房地产",
        (
            "房地产",
            "楼市",
            "物业",
            "租房",
            "real estate",
            "property",
        ),
    ),
    (
        "enterprise",
        "企业服务",
        (
            "企业",
            "b2b",
            "saas",
            "crm",
            "erp",
            "客户",
            "业务流程",
            "workflow",
            "enterprise",
            "business",
            "企业服务",
            "数字化",
        ),
    ),
    (
        "office",
        "办公协作",
        (
            "办公",
            "协作",
            "文档",
            "表格",
            "会议",
            "邮件",
            "知识库",
            "workspace",
            "collaboration",
            "document",
            "meeting",
            "slack",
            "zoom",
        ),
    ),
    (
        "design",
        "设计",
        (
            "设计",
            "ui",
            "ux",
            "创意",
            "视觉",
            "design",
            "figma",
        ),
    ),
    (
        "developer_tools",
        "开发者工具",
        (
            "代码",
            "编程",
            "开发者",
            "ide",
            "sdk",
            "github",
            "api",
            "developer",
            "coding",
            "programming",
            "claude code",
            "cursor",
            "copilot",
        ),
    ),
    (
        "cybersecurity",
        "网络安全",
        (
            "安全",
            "漏洞",
            "攻防",
            "零信任",
            "隐私",
            "数据泄露",
            "cyber",
            "security",
            "ransomware",
            "cybersecurity",
            "privacy",
        ),
    ),
    (
        "research",
        "科研",
        (
            "科研",
            "论文",
            "实验室",
            "学术",
            "研究",
            "benchmark",
            "评测",
            "research",
            "lab",
            "arxiv",
            "dataset",
            "paper",
            "academic",
        ),
    ),
    (
        "hr_recruiting",
        "招聘人力",
        (
            "招聘",
            "求职",
            "hr",
            "人才",
            "猎头",
            "hiring",
            "recruit",
        ),
    ),
    (
        "travel_hotel",
        "旅游酒店",
        (
            "旅游",
            "酒店",
            "出行",
            "机票",
            "travel",
            "hotel",
            "trip",
        ),
    ),
    (
        "local_services",
        "本地生活",
        (
            "本地生活",
            "同城",
            "到店",
            "外卖",
            "团购",
            "local",
        ),
    ),
    (
        "government",
        "政务",
        (
            "政务",
            "政府",
            "公共部门",
            "智慧城市",
            "government",
            "public sector",
        ),
    ),
    (
        "media_publishing",
        "媒体出版",
        (
            "媒体",
            "出版",
            "新闻",
            "报社",
            "media",
            "publishing",
            "journalism",
        ),
    ),
)


_WS = re.compile(r"\s+")


def _norm_blob(s: str) -> str:
    return _WS.sub(" ", (s or "").strip()).lower()


def build_text_blob_for_tags(ge: Any, metrics_preview: dict[str, Any] | None) -> str:
    """合并标题、摘要、来源标题、metrics 文案用于关键词匹配。"""
    parts: list[str] = []
    parts.append(ge.canonical_title or "")
    parts.append(ge.title_zh or "")
    parts.append(ge.summary or "")
    parts.append(ge.what_happened or "")
    parts.append(ge.why_important or "")
    parts.append(ge.what_it_means_for_you or "")

    try:
        arr = json.loads(ge.sources_json or "[]")
        if isinstance(arr, list):
            for row in arr:
                if isinstance(row, dict):
                    parts.append(str(row.get("title") or ""))
                    parts.append(str(row.get("source") or row.get("source_name") or ""))
    except json.JSONDecodeError:
        pass

    if isinstance(metrics_preview, dict):
        ol = metrics_preview.get("one_liner")
        if isinstance(ol, str):
            parts.append(ol)
        ri = metrics_preview.get("ranking_insight")
        if isinstance(ri, dict):
            parts.append(json.dumps(ri, ensure_ascii=False))
        parts.append(json.dumps(metrics_preview, ensure_ascii=False))

    return "\n".join(parts)


def infer_industry_tags(text_blob: str) -> list[dict[str, str]]:
    """根据全文推断领域/场景标签（可多标签）。不含 category 判断。"""
    blob = _norm_blob(text_blob)
    if not blob:
        return []

    seen: set[str] = set()
    out: list[dict[str, str]] = []

    for slug, label, kws in _INDUSTRY_DEFS:
        if slug in seen:
            continue
        hit = False
        for kw in kws:
            k = kw.strip().lower()
            if not k:
                continue
            if k in blob:
                hit = True
                break
        if hit:
            seen.add(slug)
            out.append({"slug": slug, "label": label})

    return out


def infer_industry_tags_for_global_event(
    ge: Any,
    metrics_preview: dict[str, Any] | None,
) -> list[dict[str, str]]:
    """对所有大类推断标签；未命中返回 []。推断时忽略 metrics 中旧的 industry_tags，避免回填自引用。"""
    mp: dict[str, Any] = dict(metrics_preview or {})
    mp.pop("industry_tags", None)
    blob = build_text_blob_for_tags(ge, mp)
    return infer_industry_tags(blob)
