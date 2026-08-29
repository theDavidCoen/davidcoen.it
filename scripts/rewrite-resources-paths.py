#!/usr/bin/env python3
"""Rewrite absolute root paths for resources served under /resources/."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "resources"
PREFIX = "/resources"
SKIP_PARTS = {".git", "__pycache__"}

# href="/foo" or src="/foo" — not already /resources/, not protocol-relative or absolute URL
ATTR_RE = re.compile(
    r'(?P<attr>href|src)="/(?!(?:resources/|https?:|//))(?P<path>[^"]*)"'
)


def rewrite_text(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        path = match.group("path")
        return f'{match.group("attr")}="{PREFIX}/{path}"'

    return ATTR_RE.sub(repl, text)


def rewrite_catalog(text: str) -> str:
    out = []
    for line in text.splitlines(keepends=True):
        if "href: '" in line or 'href: "' in line:
            line = re.sub(
                r"href:\s*'(/(?!resources/)[^']*)'",
                lambda m: f"href: '{PREFIX}{m.group(1)}'",
                line,
            )
            line = re.sub(
                r'href:\s*"(/(?!resources/)[^"]*)"',
                lambda m: f'href: "{PREFIX}{m.group(1)}"',
                line,
            )
        out.append(line)
    return "".join(out)


def main() -> int:
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        if path.suffix not in {".html", ".js", ".css"}:
            continue
        original = path.read_text(encoding="utf-8")
        updated = rewrite_catalog(original) if path.name == "catalog.js" else rewrite_text(original)
        if path.name == "index.html" and path.parent == ROOT:
            updated = updated.replace(
                'href="https://resources.davidcoen.it/"',
                'href="https://davidcoen.it/resources/"',
            )
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            print(path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
