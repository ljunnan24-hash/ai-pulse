# AI Pulse Agent Skill / API 待办

## 目标

未来支持用户的 Agent / AI 工具安装 `AIPulse.skill`，让 Agent 可以读取 AI Pulse 的部分公开数据，包括：

- 今日 AI 榜单
- 近 7 天榜单
- 近 30 天榜单
- 事件详情
- 最新周报
- 事件搜索
- 分类列表

## 产品价值

AI Pulse 不只是一个网页，也可以成为 Agent 工作流中的 AI 行业信息源。

用户可以在自己的 Agent 中使用 AI Pulse 数据完成：

- 获取今日重要 AI 动态
- 总结近 7 天 AI 行业变化
- 查询某个 AI 事件详情
- 生成内容选题
- 辅助产品、创业、研究判断
- 生成周报、月报或趋势分析

## 未来可能实现

### 1. 公开只读 API

计划接口（仅为规划，**尚未实现**）：

- `GET /api/v1/rankings`
- `GET /api/v1/events/{id}`
- `GET /api/v1/weekly/latest`
- `GET /api/v1/weekly/{date}`
- `GET /api/v1/search`
- `GET /api/v1/categories`

### 2. AIPulse.skill 文件包

未来目录结构可能是：

```
skills/aipulse/
  SKILL.md
  references/api.md
  references/schema.md
  references/examples.md
  scripts/aipulse_client.py
```

### 3. Skill 使用场景

Agent 可以在以下场景调用 AI Pulse：

- 用户询问最近 AI 行业动态
- 用户想了解某个 AI 事件
- 用户想生成基于 AI 动态的内容选题
- 用户想总结本周 / 本月 AI 趋势
- 用户想把 AI Pulse 数据嵌入自己的工作流

### 4. 安全边界

未来开放的 API 只允许读取公开数据，不开放：

- 后台管理数据
- 用户反馈
- 访问统计
- 邮箱或联系方式
- 内部任务日志
- 管理接口
- 私有评分调试字段

### 5. 暂不实现

当前阶段先不开发该功能，原因：

- 产品还在验证；
- 公开 API 的字段协议需要稳定；
- 需要先观察网站数据和用户需求；
- 不希望过早引入 API Key、限流、开放平台维护成本。

## 本轮范围说明（文档记录）

本仓库当前阶段：

- **不**新增 `/api/v1` 路由；
- **不**新增面向第三方的开放 API 实现；
- **不**新增 API Key、MCP Server、skill zip 下载；
- **不**因此改动现有对外接口或前端页面。

本文件仅作为**产品与技术规划备忘**。

## 后续触发条件

当满足以下条件时，再启动该功能：

- AI Pulse 榜单和周报数据结构稳定；
- 事件详情字段稳定；
- 有用户明确希望在 Agent 中调用 AI Pulse；
- 网站已有稳定访问和反馈；
- 有精力维护 API 文档和版本兼容。
