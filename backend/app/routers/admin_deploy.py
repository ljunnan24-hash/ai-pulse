"""后台：受限的一键部署入口。"""

from __future__ import annotations

import os
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.routers.admin import require_admin

router = APIRouter(tags=["admin-deploy"])

_deploy_lock = threading.Lock()
_last_result: dict[str, Any] | None = None


def _deploy_config() -> dict[str, Any]:
    settings = get_settings()
    script = (settings.admin_deploy_script_path or "").strip()
    workdir = (settings.admin_deploy_workdir or "").strip()
    timeout = max(10, min(int(settings.admin_deploy_timeout_seconds or 180), 900))
    configured = bool(settings.admin_deploy_enabled and script and Path(script).is_absolute())
    available = bool(configured and Path(script).is_file() and os.access(script, os.X_OK))
    return {
        "enabled": bool(settings.admin_deploy_enabled),
        "configured": configured,
        "available": available,
        "script_path": script,
        "workdir": workdir,
        "timeout_seconds": timeout,
    }


@router.get("/deploy/status")
def admin_deploy_status(_: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    cfg = _deploy_config()
    return {
        **cfg,
        "running": _deploy_lock.locked(),
        "last_result": _last_result,
    }


@router.post("/deploy/run")
def admin_deploy_run(_: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    global _last_result
    cfg = _deploy_config()
    if not cfg["enabled"]:
        raise HTTPException(status_code=403, detail="Admin deploy is disabled.")
    if not cfg["configured"]:
        raise HTTPException(status_code=503, detail="ADMIN_DEPLOY_SCRIPT_PATH must be an absolute script path.")
    if not cfg["available"]:
        raise HTTPException(status_code=503, detail="Deploy script does not exist or is not executable.")
    if not _deploy_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Deploy is already running.")

    started_at = datetime.now(timezone.utc)
    try:
        workdir = cfg["workdir"] or str(Path(cfg["script_path"]).parent)
        result = subprocess.run(
            [cfg["script_path"]],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=int(cfg["timeout_seconds"]),
            check=False,
        )
        finished_at = datetime.now(timezone.utc)
        out = {
            "ok": result.returncode == 0,
            "exit_code": result.returncode,
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "stdout": (result.stdout or "")[-20000:],
            "stderr": (result.stderr or "")[-20000:],
        }
        _last_result = out
        return out
    except subprocess.TimeoutExpired as exc:
        finished_at = datetime.now(timezone.utc)
        out = {
            "ok": False,
            "exit_code": None,
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "stdout": (exc.stdout or "")[-20000:] if isinstance(exc.stdout, str) else "",
            "stderr": "deploy timed out",
        }
        _last_result = out
        return out
    finally:
        _deploy_lock.release()
