"""Temporary in-memory sample events.

This lets the API run before MongoDB is connected. Replaced by the database
in the next step.
"""
from datetime import date

SEED_EVENTS = [
    {
        "id": "1",
        "title": "AI Builders Hackathon 2026",
        "description": "48-hour hackathon to build AI-powered products. Beginners welcome.",
        "type": "hackathon",
        "date": date(2026, 10, 18),
        "city": "Hyderabad",
        "online": False,
        "source": "native",
        "source_url": None,
        "tags": ["AI", "beginner-friendly", "hackathon"],
    },
    {
        "id": "2",
        "title": "Startup Founders Networking Night",
        "description": "Meet founders, investors and early-stage builders over coffee.",
        "type": "networking",
        "date": date(2026, 10, 25),
        "city": "Bengaluru",
        "online": False,
        "source": "native",
        "source_url": None,
        "tags": ["startup", "networking", "founders"],
    },
    {
        "id": "3",
        "title": "Intro to System Design (Online Workshop)",
        "description": "Learn the basics of scalable system design for interviews.",
        "type": "workshop",
        "date": date(2026, 11, 2),
        "city": None,
        "online": True,
        "source": "native",
        "source_url": None,
        "tags": ["system-design", "interview-prep", "workshop"],
    },
]
