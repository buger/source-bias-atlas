"""Heuristic filter for distinguishing user Squads from curated publishers.

Returns 1 (likely squad) or 0 (curated). Sources are flagged, never deleted —
the atlas may want to toggle Squad visibility.
"""
from __future__ import annotations

import re

# 20+ chars of [A-Za-z0-9_-] — matches UUIDs and 21-char nanoid-style Squad IDs.
SQUAD_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{20,}$")

# Names like "Alice's public Squad"
PUBLIC_SQUAD_NAME_RE = re.compile(r"'s public Squad$", re.IGNORECASE)


def is_squad(src: dict) -> int:
    """Heuristic squad detector. Returns 1 if any rule matches, else 0."""
    if not src:
        return 0
    sid = src.get("id") or ""
    handle = src.get("handle") or ""
    name = src.get("name") or ""
    description = (src.get("description") or "").strip()

    # Curated publishers always have a short slug-style id (e.g. "hn", "netflix").
    if SQUAD_ID_RE.match(sid):
        # Belt-and-braces: also check if handle is missing or equals id.
        if not handle or handle == sid:
            return 1
        # Even with handle, a 20+ char random id is overwhelmingly a Squad.
        return 1

    # Name patterns
    if PUBLIC_SQUAD_NAME_RE.search(name):
        return 1
    if "Squad" in name and len(description) < 40:
        return 1

    # Handle missing or equal to id (additional signal)
    if not handle or handle == sid:
        # If id is short slug AND no handle, still likely curated; keep as 0.
        return 0

    return 0
