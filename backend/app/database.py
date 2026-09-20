"""MongoDB connection + Beanie initialization."""
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import settings
from app.models.event import Event

_client: AsyncIOMotorClient | None = None


async def init_db() -> None:
    """Connect to MongoDB Atlas and register document models."""
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(database=_client[settings.mongodb_db], document_models=[Event])


async def close_db() -> None:
    if _client is not None:
        _client.close()
