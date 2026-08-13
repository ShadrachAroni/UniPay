#!/usr/bin/env python3
"""Search the Loop reference corpus and print matches with context.

Loading whole reference files to find one field name burns context for no reason.
This narrows to the passages that actually mention the term, with the source URL
attached so the answer stays citable.

    python scripts/search_docs.py "access token"
    python scripts/search_docs.py --regex "40[13]" --context 4
    python scripts/search_docs.py --list
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REFERENCES = Path(__file__).resolve().parent.parent / "references"


def source_url(text: str) -> str:
    match = re.search(r"<!-- source: (.+?) -->", text)
    return match.group(1) if match else ""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("query", nargs="?", help="text to find (case-insensitive)")
    ap.add_argument("--regex", help="treat the pattern as a regular expression")
    ap.add_argument("--context", type=int, default=2, help="lines of context around each hit")
    ap.add_argument("--list", action="store_true", help="list available reference files")
    ap.add_argument("--max-hits", type=int, default=40)
    args = ap.parse_args()

    if not REFERENCES.exists():
        print(
            "No references/ directory yet — the skill has not been populated.\n"
            "Run: python tools/ingest_docs.py   (add --render for client-rendered portals)",
            file=sys.stderr,
        )
        return 2

    # INDEX.md and README.md are navigation scaffolding; searching them just returns
    # duplicate hits and inflates the "N files searched" count.
    files = sorted(p for p in REFERENCES.glob("*.md") if p.name not in {"INDEX.md", "README.md"})
    if args.list or not (args.query or args.regex):
        if not files:
            print("references/ is empty. Run tools/ingest_docs.py first.", file=sys.stderr)
            return 2
        print(f"{len(files)} reference file(s):")
        for path in files:
            print(f"  {path.name}")
        return 0

    pattern = re.compile(args.regex if args.regex else re.escape(args.query), re.IGNORECASE)

    hits = 0
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        matched = [i for i, line in enumerate(lines) if pattern.search(line)]
        if not matched:
            continue

        print(f"\n=== {path.name} ===")
        url = source_url(text)
        if url:
            print(f"    source: {url}")

        shown: set[int] = set()
        for idx in matched:
            if hits >= args.max_hits:
                print("\n... more matches truncated; narrow the query.")
                return 0
            lo, hi = max(0, idx - args.context), min(len(lines), idx + args.context + 1)
            block = range(lo, hi)
            if all(i in shown for i in block):
                continue
            print(f"  --- line {idx + 1} ---")
            for i in block:
                marker = ">" if i == idx else " "
                print(f"  {marker} {lines[i]}")
                shown.add(i)
            hits += 1

    if hits == 0:
        print(f"No matches for {args.regex or args.query!r} in {len(files)} reference file(s).")
        print("The documentation may not cover this — say so rather than guessing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
