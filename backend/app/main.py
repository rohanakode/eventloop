"""EventLoop API — FastAPI entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.routers import events, match


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()          # connect to MongoDB + Beanie on startup
    yield
    await close_db()         # clean up on shutdown


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Allow the React frontend to call this API during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(match.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


@app.get("/", tags=["health"])
def root():
    return {"message": "EventLoop API is running. See /docs for the API explorer."}
