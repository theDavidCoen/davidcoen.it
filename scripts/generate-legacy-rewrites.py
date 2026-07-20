#!/usr/bin/env python3
"""Print Apache RewriteCond lines for known WordPress post slugs (optional hardening)."""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs" / "wp-url-inventory.json"

SKIP_PREFIXES = (
    "/category/",
    "/tag/",
    "/news/",
    "/feed/",
    "/shop/",
    "/cart/",
    "/checkout/",
    "/legacy/",
    "/wp-",
)


def main() -> int:
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    posts = data["inventory"].get("posts", [])
    slugs = []
    for url in sorted(posts):
        path = urlparse(url).path
        if path.count("/") != 2 or any(path.startswith(p) for p in SKIP_PREFIXES):
            continue
        slug = path.strip("/")
        if slug:
            slugs.append(slug)

    print(f"# {len(slugs)} post slugs from {INVENTORY.name}")
    print("# Optional: use if you prefer explicit routing instead of catch-all legacy rewrite")
    for slug in slugs:
        print(f"RewriteRule ^{slug}/?$ legacy/{slug}/ [L,QSA]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
