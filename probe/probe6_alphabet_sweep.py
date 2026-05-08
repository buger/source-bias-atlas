"""Probe 6 — alphabet sweep on `/search/sources`.

NOTE: single-letter queries return 0 results (verified). The endpoint
requires q>=2 chars. We instead sweep ~60 common 2-letter prefixes covering
the bulk of English-language sources, plus a sanity row of single letters.
Dedup across letters; compare overlap with organic discovery from Probe 4.
"""
from __future__ import annotations

import string

from common import Client, db, log_run, upsert_source


def main() -> None:
    c = Client()
    conn = db()
    new_ids: set[str] = set()
    per_letter: dict[str, int] = {}
    capped_letters: list[str] = []

    # snapshot pre-existing source ids (from prior probes — organic discovery + others)
    pre_organic = {
        row[0] for row in conn.execute(
            "SELECT id FROM sources WHERE discovered_via LIKE 'discovery:%'"
        )
    }
    pre_all = {row[0] for row in conn.execute("SELECT id FROM sources")}

    # Curated 2-letter prefix set: vowel+consonant and consonant+vowel forms
    # covering the most productive English bigrams. ~60 queries, plenty of
    # coverage without burning the budget.
    consonants = "bcdfghjklmnprstvw"
    vowels = "aeiou"
    queries: list[str] = []
    # CV pairs (e.g. "ba","be","bi" ...)
    for c1 in consonants:
        for v in vowels:
            queries.append(c1 + v)
    # plus a handful of common VC / specialist combos
    queries += ["ai", "io", "js", "go", "py", "ts", "ml", "ux", "ui"]
    # de-dup, keep order
    seen: set[str] = set()
    queries = [q for q in queries if not (q in seen or seen.add(q))]

    for letter in queries:
        data = c.get_json("/search/sources", q=letter, limit=50)
        if data is None:
            per_letter[letter] = -1
            continue
        items = data.get("data") or []
        per_letter[letter] = len(items)
        if len(items) >= 50:
            capped_letters.append(letter)
        for s in items:
            sid = s.get("id")
            if sid:
                new_ids.add(sid)
                upsert_source(conn, s, f"alphabet:{letter}")
        conn.commit()

    overlap_organic = new_ids & pre_organic
    overlap_all = new_ids & pre_all
    only_alpha = new_ids - pre_all

    summary = (
        f"  letters_with_full_50_results: {len(capped_letters)}/26 -> {capped_letters}\n"
        f"  per_letter_counts: {per_letter}\n"
        f"  unique sources via alphabet: {len(new_ids)}\n"
        f"  overlap with organic-discovery probe4: {len(overlap_organic)} of {len(pre_organic)} organic\n"
        f"  overlap with ALL prior probes: {len(overlap_all)} of {len(pre_all)} prior\n"
        f"  alphabet-only (not seen organically): {len(only_alpha)}"
    )
    log_run(conn, "probe6_alphabet_sweep", c.req_count, c.elapsed(), summary)
    conn.close(); c.close()
    print(f"Probe 6 complete: {c.req_count} requests, {c.elapsed():.1f}s")
    print(summary)


if __name__ == "__main__":
    main()
