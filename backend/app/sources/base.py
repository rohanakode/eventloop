"""Common contract every event source (scraper or API) must follow.

Add a new source by creating a folder under `sources/` with a class that
subclasses `EventSource` and implements `fetch()`. The ingestion pipeline
treats all sources the same way through this interface — nothing else needs
to change.
"""
from abc import ABC, abstractmethod

from app.schemas.event import EventBase


class EventSource(ABC):
    """Base class for a single event source."""

    #: Unique, lowercase key for this source, e.g. "devfolio".
    name: str

    @abstractmethod
    def fetch(self) -> list[EventBase]:
        """Fetch events from the source and return them normalized.

        Each source is responsible ONLY for getting its raw data and mapping
        it into `EventBase` objects. Filtering (career-only, Hyderabad+online,
        expiry), de-duplication and storage happen later in the pipeline — not
        here — so every source stays small and single-purpose.
        """
        raise NotImplementedError
