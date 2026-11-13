from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, ask, context, datasets, runs, view
from app.core.config import settings

app = FastAPI(title=settings.app_name, version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(analysis.router)
app.include_router(context.router)
app.include_router(ask.router)
app.include_router(view.router)
app.include_router(runs.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}