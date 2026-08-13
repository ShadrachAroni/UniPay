#!/usr/bin/env python3
"""Validate this skill against the portable SKILL.md conventions.

Run in CI so a bad edit fails the build instead of silently breaking the skill in
every harness that loads it. Checks structure and safety, not prose quality.

    python skills/loop-api/scripts/validate_skill.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Defaults to the skill this script ships inside; accepts a path so CI can validate
# any skill directory built from these conventions.
SKILL_DIR = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SKILL_MD = SKILL_DIR / "SKILL.md"

MAX_BODY_LINES = 500
MAX_DESCRIPTION_CHARS = 1024
NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# Patterns that would mean a real credential got committed. Deliberately narrow:
# the goal is to catch genuine leaks, not to flag every occurrence of the word "key".
SECRET_PATTERNS = [
    (re.compile(r"\b(sk|pk)_(live|test)_[A-Za-z0-9]{16,}"), "hardcoded API key"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "JWT literal"),
    (re.compile(r"(?i)(api[_-]?key|client[_-]?secret|password)\s*[:=]\s*[\"'][^\"'{$<>\s]{12,}[\"']"), "inline secret"),
]

errors: list[str] = []
warnings: list[str] = []


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        errors.append("SKILL.md must begin with a YAML frontmatter block (`---`).")
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        errors.append("SKILL.md frontmatter block is not closed with `---`.")
        return {}, text

    raw, body = parts[1], parts[2]
    data: dict[str, str] = {}
    key = None
    for line in raw.splitlines():
        if not line.strip():
            continue
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
        if match:
            key = match.group(1)
            value = match.group(2).strip()
            data[key] = "" if value in {">-", ">", "|", "|-"} else value
        elif key and line.startswith((" ", "\t")):
            data[key] = (data[key] + " " + line.strip()).strip()
    return data, body


def check_frontmatter(data: dict[str, str]) -> None:
    name = data.get("name", "")
    if not name:
        errors.append("frontmatter is missing required field `name`.")
    elif not NAME_RE.match(name):
        errors.append(f"`name` must be lowercase-hyphenated: got {name!r}.")
    elif name != SKILL_DIR.name:
        errors.append(f"`name` ({name!r}) must match the directory name ({SKILL_DIR.name!r}).")

    description = data.get("description", "")
    if not description:
        errors.append("frontmatter is missing required field `description`.")
        return
    if len(description) > MAX_DESCRIPTION_CHARS:
        errors.append(f"`description` is {len(description)} chars; keep it under {MAX_DESCRIPTION_CHARS}.")
    # The description is the only thing a harness sees when deciding whether to load
    # the skill, so it has to say when to use it, not just what it is.
    if not re.search(r"(?i)\buse (this|it)\b|\bwhen(ever)?\b", description):
        warnings.append("`description` does not say *when* to use the skill; it may under-trigger.")


def check_body(body: str) -> None:
    lines = body.splitlines()
    if len(lines) > MAX_BODY_LINES:
        warnings.append(f"SKILL.md body is {len(lines)} lines; under {MAX_BODY_LINES} keeps it loadable.")

    for path in re.findall(r"\]\((\./[^)]+|references/[^)]+|scripts/[^)]+)\)", body):
        target = (SKILL_DIR / path.lstrip("./")).resolve()
        if not target.exists():
            errors.append(f"SKILL.md links to a missing file: {path}")


def check_secrets() -> None:
    for path in SKILL_DIR.rglob("*"):
        if not path.is_file() or path.suffix in {".png", ".jpg", ".gif", ".pdf"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for pattern, label in SECRET_PATTERNS:
            if pattern.search(text):
                errors.append(f"possible {label} committed in {path.relative_to(SKILL_DIR.parent.parent)}")


def check_references() -> None:
    refs = SKILL_DIR / "references"
    # README.md and INDEX.md are scaffolding, not captured documentation — counting
    # them would hide the "corpus is empty" warning, which is the one case where the
    # skill silently cannot do its job.
    generated = [p for p in refs.glob("*.md") if p.name not in {"INDEX.md", "README.md"}] if refs.exists() else []
    if not generated:
        warnings.append(
            "references/ has no generated pages yet — run tools/ingest_docs.py. "
            "Until then the skill can describe workflows but cannot answer API questions."
        )
        return
    # Provenance is the skill's core safety property: a reference the agent cannot
    # trace back to a published page is indistinguishable from something invented.
    # This runs unconditionally — an earlier version skipped it whenever manifest.json
    # was absent, which meant a hand-written reference file could enter the corpus
    # reported as nothing worse than a warning.
    for path in generated:
        if "<!-- source:" not in path.read_text(encoding="utf-8"):
            errors.append(
                f"{path.name} has no source provenance comment — references must be "
                f"generated by tools/ingest_docs.py, not hand-written."
            )

    manifest = refs / "manifest.json"
    if not manifest.exists():
        warnings.append("references/manifest.json is missing; cannot cross-check the corpus.")
        return
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"references/manifest.json is not valid JSON: {exc}")
        return
    for page in data.get("pages", []):
        if not (refs / f"{page['slug']}.md").exists():
            errors.append(f"manifest lists {page['slug']}.md but the file is missing.")


def main() -> int:
    if not SKILL_MD.exists():
        print(f"FAIL: {SKILL_MD} not found", file=sys.stderr)
        return 1

    text = SKILL_MD.read_text(encoding="utf-8")
    data, body = parse_frontmatter(text)
    check_frontmatter(data)
    check_body(body)
    check_secrets()
    check_references()

    for warning in warnings:
        print(f"WARN  {warning}")
    for error in errors:
        print(f"FAIL  {error}", file=sys.stderr)

    if errors:
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s).", file=sys.stderr)
        return 1
    print(f"\nOK — skill valid ({len(warnings)} warning(s)).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
