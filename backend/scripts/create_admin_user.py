from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models import AdminUser  # noqa: E402
from app.routers.admin import _hash_password  # noqa: E402


def main() -> int:
    username = (os.getenv("ADMIN_USERNAME") or "").strip()
    password = os.getenv("ADMIN_PASSWORD") or ""
    if not username or not password:
        print("ERROR: set ADMIN_USERNAME and ADMIN_PASSWORD env vars", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        exists = db.query(AdminUser).filter(AdminUser.username == username).first()
        if exists:
            print("OK: admin user already exists")
            return 0

        u = AdminUser(username=username, password_hash=_hash_password(password), is_active=1)
        db.add(u)
        db.commit()
        print("OK: admin user created")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

