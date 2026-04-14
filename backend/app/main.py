from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import api, manage_page
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

app.include_router(api.router)
app.include_router(manage_page.router)
app.include_router(admin_router.router)


@app.get("/health")
def health():
    return {"ok": True}


# Convenience alias when proxying under /api on same host.
@app.get("/api/health")
def api_health():
    return {"ok": True}
