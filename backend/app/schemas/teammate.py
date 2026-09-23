"""Teammate-interest request / response shapes."""
from __future__ import annotations

from datetime import date
from typing import Annotated, Optional

from pydantic import BaseModel, Field


class TeammateCreate(BaseModel):
    event_id: str
    pitch: Annotated[str, Field(min_length=10, max_length=500)]
    contact: Annotated[str, Field(min_length=3, max_length=200)]


class TeammateOut(BaseModel):
    id: str
    user_id: str
    user_name: str
    event_id: str
    event_title: str
    event_type: str
    event_date: date
    event_city: Optional[str] = None
    event_online: bool
    pitch: str
    contact: str
