from __future__ import annotations

import datetime
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models import Subscriber, SubscriberStatus  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        email = f"test-{secrets.randbelow(10_000)}@example.com"
        sub = Subscriber(
            email=email,
            mode="normal",
            keywords_json='["ai","agent"]',
            status=SubscriberStatus.active.value,
            confirm_token=secrets.token_hex(16),
            unsubscribe_token=secrets.token_hex(16),
            manage_token=secrets.token_hex(16),
            confirmed_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        print(f"seeded_subscriber_id={sub.id} email={email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

