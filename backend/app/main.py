"""EventLoop API — FastAPI entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import init_db, close_db
from app.routers import account, events, match, teammates
from app.utils.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()          # connect to MongoDB + Beanie on startup
    yield
    await close_db()         # clean up on shutdown


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Rate limiter (per-user; see app/utils/rate_limit.py). Handler translates a
# blown limit into a clean 429 with a friendly message.
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


def _rate_limit_handler(_request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=429,
        content={"detail": f"You've hit today's posting limit ({exc.detail}). Try again tomorrow."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

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
app.include_router(account.router)
app.include_router(teammates.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


@app.get("/", tags=["health"])
def root():
    return {"message": "EventLoop API is running. See /docs for the API explorer."}
