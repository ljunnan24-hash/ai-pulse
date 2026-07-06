from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import admin_deploy, admin_site_ops, admin_sources, analytics_public, api, feedback_public, manage_page, rankings_public, seo, tracking, weekly_json, weekly_public
from app.routers import admin as admin_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="AI Pulse API", lifespan=lifespan)

_settings = get_settings()
_origins = [
    _settings.frontend_url.rstrip("/"),
    _settings.admin_frontend_url.rstrip("/") if _settings.admin_frontend_url else "",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in list(dict.fromkeys(_origins)) if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weekly_public.router)
app.include_router(seo.router)
app.include_router(tracking.router)
app.include_router(analytics_public.router)
app.include_router(feedback_public.router)
app.include_router(rankings_public.router)
app.include_router(weekly_json.router)
app.include_router(api.router)
app.include_router(manage_page.router)
app.include_router(admin_router.router)
# 运营统计 / 反馈 API 放在 /api/admin/*，避免与前端 SPA 路由 /admin/* 在生产环境争路径
app.include_router(admin_site_ops.router, prefix="/api/admin")
app.include_router(admin_sources.router, prefix="/api/admin")
app.include_router(admin_deploy.router, prefix="/api/admin")


@app.get("/health")
def health():
    return {"ok": True}


# Convenience alias when proxying under /api on same host.
@app.get("/api/health")
def api_health():
    return {"ok": True}
