"""EventLoop API - FastAPI entry point."""
import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import init_db, close_db
from app.routers import account, events, match, teammates
from app.utils.rate_limit import limiter

# Named logger so every error line is clearly ours in the uvicorn output.
logger = logging.getLogger("eventloop")
logger.setLevel(logging.INFO)


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


async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Log every 4xx/5xx (except 401 flood from tokens) with the route it hit."""
    if exc.status_code >= 500 or exc.status_code == 400 or exc.status_code == 403:
        logger.warning(
            "[eventloop] %s %s -> %s: %s",
            request.method, request.url.path, exc.status_code, exc.detail,
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


async def _unhandled_exception_handler(request: Request, exc: Exception):
    """Anything the code didn't catch itself. Print a full traceback to the
    uvicorn terminal, then return a clean JSON 500 to the client."""
    tb = traceback.format_exc()
    logger.error(
        "[eventloop] UNHANDLED %s %s\n%s",
        request.method, request.url.path, tb,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on the server. Check the backend terminal for details."},
    )


app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
app.add_exception_handler(Exception, _unhandled_exception_handler)

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
