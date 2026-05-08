"""Cadence features: posts/week, firehose flag, recency skew."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _parse_ts(s: str | None) -> datetime | None:
    if not s:
        return None
    # Accept both "2025-01-15T12:34:56.789Z" and "2025-01-15T12:34:56+00:00".
    try:
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _post_times(posts) -> list[datetime]:
    out = []
    for p in posts:
        dt = _parse_ts(p.created_at) or _parse_ts(p.published_at)
        if dt is not None:
            out.append(dt)
    return out


def cadence(posts) -> tuple[float, float, bool]:
    """Return (posts_per_week, span_days, cadence_unreliable)."""
    times = _post_times(posts)
    if len(times) < 2:
        return 0.0, 0.0, True
    span = (max(times) - min(times)).total_seconds() / 86400.0
    if span <= 0:
        return 0.0, span, True
    pw = len(times) / span * 7.0
    unreliable = span < 7.0
    return pw, span, unreliable


def firehose_flag(posts_per_week: float, median_upvotes: float) -> bool:
    return posts_per_week > 20 and median_upvotes < 5


def recency_skew(posts, now: datetime | None = None) -> float:
    """Ratio of posts in last 90 days to older. Uses max(post_time) as reference,
    not wall-clock, so this is deterministic across runs."""
    times = _post_times(posts)
    if not times:
        return 0.0
    ref = now if now is not None else max(times)
    cutoff = ref - timedelta(days=90)
    recent = sum(1 for t in times if t >= cutoff)
    older = len(times) - recent
    if older == 0:
        # All recent — saturate at a large value but avoid inf.
        return float(recent)
    return recent / older
