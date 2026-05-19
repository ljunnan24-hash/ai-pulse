"""
【已停用】Legacy 全量多 Agent 周刊生成。

请改用：
  cd backend && python -m app.jobs.generate_weekly

说明见 docs/archive/LEGACY_WEEKLY_MULTI_AGENT.md
"""

from __future__ import annotations

import sys


def main() -> None:
    print(
        "build_weekly_multi_agent 已停用（Legacy MultiAgentOrchestrator）。\n"
        "生产请运行: python -m app.jobs.generate_weekly\n"
        "（需 WEEKLY_SOURCE=global_events，见 docs/MULTI_AGENT_V1.md）\n"
        "旧方案说明: docs/archive/LEGACY_WEEKLY_MULTI_AGENT.md",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
