from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse

import httpx


def _alias(base_email: str, i: int) -> str:
    """
    Gmail-style alias:
      name@gmail.com -> name+001@gmail.com
    """
    if "@" not in base_email:
        raise ValueError("base_email must contain '@'")
    name, domain = base_email.split("@", 1)
    return f"{name}+{i:03d}@{domain}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-email", required=True, help="e.g. ljunnan23@gmail.com")
    ap.add_argument("--count", type=int, default=100)
    ap.add_argument("--api-base", required=True, help="e.g. https://www.aipulse.asia")
    ap.add_argument("--mode", default="normal", choices=["simple", "normal"])
    ap.add_argument("--keywords", default="", help="comma-separated, up to 3")
    ap.add_argument("--sleep-ms", type=int, default=80)
    args = ap.parse_args()

    kws = [k.strip() for k in args.keywords.split(",") if k.strip()][:3]
    api_base = args.api_base.rstrip("/")

    ok_sub = 0
    ok_confirm = 0
    fail_sub: list[str] = []
    fail_confirm: list[str] = []

    with httpx.Client(timeout=30.0, follow_redirects=False) as client:
        for i in range(1, args.count + 1):
            email = _alias(args.base_email, i)
            try:
                r = client.post(
                    f"{api_base}/api/subscribe",
                    json={"email": email, "mode": args.mode, "keywords": kws},
                    headers={"Content-Type": "application/json"},
                )
                if r.status_code == 200:
                    ok_sub += 1
                else:
                    fail_sub.append(f"{email} status={r.status_code} body={r.text[:200]}")
                    continue
            except Exception as e:
                fail_sub.append(f"{email} exc={type(e).__name__}:{e}")
                continue

            # We cannot read confirm_token from API response, so for a pure black-box test we
            # ask the operator to confirm via logs. Here we still hit /api/confirm with an
            # explicit token if provided by operator; otherwise skip.
            #
            # Practical workflow:
            # - Run this script with MAIL_DRY_RUN=1 so emails aren't sent.
            # - Observe confirm links/tokens by querying DB, OR implement a DB-backed runner separately.
            #
            # For now we only validate subscribe endpoint at scale.
            time.sleep(args.sleep_ms / 1000.0)

    summary = {
        "count": args.count,
        "subscribe_ok": ok_sub,
        "subscribe_fail": len(fail_sub),
        "confirm_ok": ok_confirm,
        "confirm_fail": len(fail_confirm),
        "fail_sub_samples": fail_sub[:5],
        "fail_confirm_samples": fail_confirm[:5],
        "note": "This runner validates /api/subscribe at scale. Confirm requires token access (DB) or inbox.",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

