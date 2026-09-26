"""Convert source HTML into lightweight Markdown.

Scraped event descriptions come as HTML with real structure -- headings
(`<p><strong>…</strong></p>`), bullet lists (`<ul><li>…</li></ul>`) and
paragraphs. Flattening that to plain text turns a readable, sectioned
description into one wall of text. This keeps the structure as a small, safe
Markdown subset (bold, bullets, paragraphs, links) that the frontend renders
back into headings and lists.

Uses html.parser (stdlib) so it also survives the malformed HTML some
organizers paste in (e.g. tags whose attributes contain '>').
"""
from __future__ import annotations

import html as _html
import re
from html.parser import HTMLParser

_HEADING_TAG = re.compile(r"h[1-6]$")

# Pictographic emoji / icon blocks to strip from descriptions. Deliberately
# EXCLUDES the arrows block (U+2190-U+21FF) so semantic arrows like "→" survive.
_EMOJI_RE = re.compile(
    "["
    "\U0001F1E6-\U0001F1FF"   # regional indicator flags
    "\U0001F300-\U0001FAFF"   # symbols, emoticons, transport, supplemental
    "\U00002600-\U000027BF"   # misc symbols + dingbats
    "\U00002B00-\U00002BFF"   # misc symbols and arrows (stars, etc.)
    "\U0000FE00-\U0000FE0F"   # variation selectors
    "\U0000200D"              # zero-width joiner
    "\U0000231A-\U0000231B"   # watch, hourglass
    "\U000023E9-\U000023FA"   # media/clock controls (⏰ ⏱ ⏳ …)
    "\U00002B50\U00002B55"    # star, circle
    "]+",
    flags=re.UNICODE,
)
_URL = r"https?://\S+"
# A line whose point is a registration CTA carrying a link (redundant with our
# Register button): "Register now: <url>", "RSVP - <url>", "- Sign up: <url>", …
_REG_CTA_LINE = re.compile(
    rf"(?im)^[ \t>*-]*(?:to\s+)?(?:register(?:\s+now)?|registration|rsvp|sign\s*up|apply|book\s+(?:your\s+)?(?:seat|slot|ticket))\b[^\n]*?{_URL}[^\n]*$"
)
_ASTERISK_RUN = re.compile(r"(?:\\?\*){3,}")   # decorative *** or \*\*\* (keeps **bold**)


def clean_description(md: str, source_url: str | None = None) -> str:
    """Tidy a scraped Markdown description for display:

    - strip emojis/icons (they read as AI-generated filler)
    - normalize em/en dashes to a plain hyphen
    - drop decorative triple-asterisk runs (keeps real **bold**)
    - remove registration CTA lines that carry a link (we already show a
      Register button), and the event's own registration URL if pasted inline
    """
    if not md:
        return ""
    text = _EMOJI_RE.sub("", md)
    text = text.replace("—", " - ").replace("–", " - ")   # em / en dash
    text = _ASTERISK_RUN.sub("", text)
    text = _REG_CTA_LINE.sub("", text)
    if source_url:
        for variant in {source_url, source_url.rstrip("/")}:
            text = text.replace(variant, "")
    # tidy whitespace (keep line structure)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"(?m)^[ \t>*-]+$", "", text)   # lines left with only punctuation
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class _MarkdownExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._out: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in ("p", "div"):
            self._nl(2)
        elif tag == "br":
            self._nl(1)
        elif tag in ("ul", "ol"):
            self._nl(1)
        elif tag == "li":
            self._out.append("\n- ")
        elif tag in ("strong", "b"):
            self._out.append("**")
        elif tag in ("em", "i"):
            self._out.append("*")
        elif _HEADING_TAG.match(tag):
            self._nl(2)
            self._out.append("### ")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("strong", "b"):
            self._out.append("**")
        elif tag in ("em", "i"):
            self._out.append("*")
        elif tag in ("p", "div", "ul", "ol") or _HEADING_TAG.match(tag):
            self._nl(1)
        # Note: no newline for </li> -- the next <li> adds its own, so list
        # items stay tight (single line each) instead of double-spaced.

    def handle_data(self, data: str) -> None:
        self._out.append(data)

    def _nl(self, count: int) -> None:
        self._out.append("\n" * count)

    def get_markdown(self) -> str:
        md = "".join(self._out)
        md = re.sub(r"[ \t]+", " ", md)          # collapse runs of spaces
        md = re.sub(r" *\n *", "\n", md)          # trim spaces around newlines
        md = re.sub(r"\*\*\s*\*\*", "", md)       # drop empty bold from stray tags
        md = re.sub(r"\n{3,}", "\n\n", md)        # at most one blank line
        return md.strip()


def html_to_markdown(source: str | None, limit: int = 1400) -> str:
    """HTML fragment -> clean Markdown, capped at `limit` chars on a line break."""
    if not source:
        return ""
    parser = _MarkdownExtractor()
    try:
        parser.feed(source)
        md = parser.get_markdown()
    except Exception:
        md = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", _html.unescape(source))).strip()
    if len(md) > limit:
        md = md[:limit].rsplit("\n", 1)[0].rstrip() + "\n\n…"
    return md
