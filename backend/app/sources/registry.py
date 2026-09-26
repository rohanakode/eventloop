"""The list of active event sources the pipeline pulls from.

Add a new source by importing it and adding an instance here - nothing else
in the pipeline needs to change.
"""
from app.sources.base import EventSource
from app.sources.devfolio.scraper import DevfolioSource
from app.sources.meetup.scraper import MeetupSource
from app.sources.unstop.scraper import UnstopSource


def get_sources() -> list[EventSource]:
    return [
        DevfolioSource(),
        MeetupSource(location="in--Hyderabad", keywords="tech", city_label="Hyderabad"),
        # Unstop yields fewer per page after strict date-accuracy filtering, so
        # we fetch a bit deeper to keep a healthy count of trustworthy events.
        UnstopSource(pages=4, per_page=50, city_label="Hyderabad"),
    ]
