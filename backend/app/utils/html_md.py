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
