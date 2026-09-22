"""Text embeddings.

Uses the Jina API when JINA_API_KEY is set (better quality, long context),
otherwise falls back to a local fastembed model. The SAME model must embed
events, search queries and resumes so their vectors are comparable.

Jina v3 supports asymmetric retrieval: documents use the "retrieval.passage"
task, queries/resumes use "retrieval.query".
"""
import httpx

from app.config import settings

JINA_URL = "https://api.jina.ai/v1/embeddings"
JINA_MODEL = "jina-embeddings-v3"
_JINA_DIM = 1024
_LOCAL_MODEL = "BAAI/bge-small-en-v1.5"
_LOCAL_DIM = 384

_use_jina = bool(settings.jina_api_key)
EMBED_DIM = _JINA_DIM if _use_jina else _LOCAL_DIM

_local = None


def _local_model():
    global _local
    if _local is None:
        from fastembed import TextEmbedding
        _local = TextEmbedding(model_name=_LOCAL_MODEL)
    return _local


def _jina(texts: list[str], task: str) -> list[list[float]]:
    resp = httpx.post(
        JINA_URL,
        headers={"Authorization": f"Bearer {settings.jina_api_key}"},
        json={"model": JINA_MODEL, "task": task, "input": texts},
        timeout=60,
    )
    resp.raise_for_status()
    return [d["embedding"] for d in resp.json()["data"]]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed documents (events)."""
    if _use_jina:
        return _jina(texts, "retrieval.passage")
    return [v.tolist() for v in _local_model().embed(texts)]


def embed_query(text: str) -> list[float]:
    """Embed a query or resume."""
    if _use_jina:
        return _jina([text], "retrieval.query")[0]
    return [v.tolist() for v in _local_model().embed([text])][0]
