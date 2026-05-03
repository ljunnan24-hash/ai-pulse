"""
部署/运维自检：确认依赖与 FastAPI 应用可导入。
用法: cd backend && python scripts/smoke_check.py
"""
from __future__ import annotations

import sys


def main() -> int:
    try:
        from app.config import get_settings  # noqa: F401
        from app.main import app  # noqa: F401

        s = get_settings()
        _ = s.database_url
        print("OK: backend imports and settings load.")
        return 0
    except Exception as exc:
        print("FAIL:", exc)
        print("Install deps: pip install -r requirements.txt")
        return 1


if __name__ == "__main__":
    sys.exit(main())
