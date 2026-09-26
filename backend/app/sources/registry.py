"""The list of active event sources the pipeline pulls from.

Add a new source by importing it and adding an instance here - nothing else
in the pipeline needs to change.
"""
from app.sources.base import EventSource
from app.sources.devfolio.scraper import DevfolioSource
from app.sources.meetup.scraper import MeetupSource


def get_sources() -> list[EventSource]:
    return [
        DevfolioSource(),
        MeetupSource(location="in--Hyderabad", keywords="tech", city_label="Hyderabad"),
    ]
