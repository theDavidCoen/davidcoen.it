#!/usr/bin/env python3
"""Check internal resource links and purge duplicate files on resources.davidcoen.it FTP."""

from __future__ import annotations

import argparse
import base64
import ftplib
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "resources"
SUBDOMAIN_HTACCESS = ROOT / "deploy" / "resources-subdomain.htaccess"
SUBDOMAIN_REMOTE = "/resources.davidcoen.it"
BASE_URL = "https://davidcoen.it/resources/"
SKIP_PARTS = {".git", "__pycache__", "node_modules"}

ATTR_RE = re.compile(r'(?:href|src)=["\']([^"\']+)["\']', re.IGNORECASE)
CATALOG_HREF_RE = re.compile(r"href:\s*['\"]([^'\"]+)['\"]")

LAN_TRIGGER_CHECKS = [
    (re.compile(r"""src=["']https?://btcpay\.davidcoen\.it/""", re.I), "btcpay asset loaded via src= (use /assets/ locally)"),
    (re.compile(r"btcpay\.davidcoen\.it/modal/btcpay\.js", re.I), "btcpay.js loaded on page load"),
    (re.compile(r"btcpay\.davidcoen\.it/.*/openpatron/badge", re.I), "OpenPatron badge fetched from BTCPay"),
]

EXTRA_HTML_ROOTS = [
    Path(__file__).resolve().parents[2] / "resources" / "nostredirect.davidcoen.it",
]


def ftp_connect() -> ftplib.FTP:
    tree = ET.parse(Path.home() / ".config/filezilla/sitemanager.xml")
    srv = tree.getroot().find(".//Server")
    host = srv.find("Host").text
    port = int(srv.find("Port").text)
    user = srv.find("User").text
    passwd = base64.b64decode(srv.find("Pass").text).decode("utf-8")
    ftp = ftplib.FTP()
    ftp.connect(host, port, timeout=120)
    ftp.login(user, passwd)
    ftp.set_pasv(True)
    return ftp


def cwd(ftp: ftplib.FTP, path: str) -> None:
    ftp.cwd("/")
    for part in [p for p in path.strip("/").split("/") if p]:
        ftp.cwd(part)


def collect_links() -> list[tuple[str, str, str]]:
    links: list[tuple[str, str, str]] = []
    for path in sorted(RESOURCES.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix not in {".html", ".js"}:
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
        rel = path.relative_to(RESOURCES).as_posix()
        for match in ATTR_RE.finditer(text):
            href = match.group(1)
            if "${" in href:
                continue
            links.append((rel, href, "attr"))
        if path.name == "catalog.js":
            for match in CATALOG_HREF_RE.finditer(text):
                links.append((rel, match.group(1), "catalog"))
    return links


def check_lan_triggers() -> list[str]:
    issues: list[str] = []
    roots = [RESOURCES, *[p for p in EXTRA_HTML_ROOTS if p.is_dir()]]
    seen: set[Path] = set()
    for root in roots:
        for path in sorted(root.rglob("*.html")):
            if path in seen:
                continue
            seen.add(path)
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            rel = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
            label = f"{root.name}/{rel}" if root != RESOURCES else rel
            for pattern, message in LAN_TRIGGER_CHECKS:
                if pattern.search(text):
                    issues.append(f"{label}: {message}")
                    break
    return issues


def resolve_local(href: str, source: str) -> Path | None:
    if href.startswith(("http://", "https://", "//", "mailto:", "tel:", "nostr:", "lightning:", "data:", "javascript:", "#")):
        return None
    if href.startswith("/resources/"):
        rel = href.removeprefix("/resources/").split("?", 1)[0].split("#", 1)[0]
        if not rel:
            return RESOURCES / "index.html"
        candidate = RESOURCES / rel
        if candidate.is_file():
            return candidate
        if (candidate / "index.html").is_file():
            return candidate / "index.html"
        return candidate
    if href.startswith("/"):
        return None
    base = RESOURCES / Path(source).parent
    target = (base / href.split("?", 1)[0].split("#", 1)[0]).resolve()
    try:
        target.relative_to(RESOURCES.resolve())
    except ValueError:
        return None
    if target.is_file():
        return target
    if (target / "index.html").is_file():
        return target / "index.html"
    return target


def check_links(live: bool) -> list[str]:
    errors: list[str] = []
    checked_http: dict[str, int | str] = {}

    for source, href, kind in collect_links():
        local = resolve_local(href, source)
        if local is not None:
            if not local.exists():
                errors.append(f"MISSING local [{source}] {href} -> {local}")
            continue
        if href.startswith(("mailto:", "tel:", "nostr:", "lightning:", "data:", "javascript:", "#")):
            continue
        if not live:
            continue
        if href.startswith("/") and not href.startswith("/resources/"):
            errors.append(f"ROOT-ABS (not /resources/) [{source}] {href}")
            continue
        url = href if href.startswith("http") else urljoin(BASE_URL, href)
        if url in checked_http:
            status = checked_http[url]
        else:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "davidcoen-link-check/1.0"})
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    status = resp.status
            except urllib.error.HTTPError as exc:
                status = exc.code
            except Exception as exc:  # noqa: BLE001
                status = str(exc)
            checked_http[url] = status
        if status != 200:
            errors.append(f"HTTP {status} [{source}] {href}")

    return errors


def ftp_list(ftp: ftplib.FTP) -> list[tuple[str, str]]:
    """Return (name, type) where type is 'dir' or 'file'."""
    items: list[tuple[str, str]] = []
    for name, facts in ftp.mlsd():
        if name in (".", ".."):
            continue
        typ = facts.get("type", "file")
        items.append((name, "dir" if typ == "dir" else "file"))
    return items


def ftp_delete_tree(ftp: ftplib.FTP, keep: set[str]) -> list[str]:
    removed: list[str] = []

    def walk() -> None:
        for name, typ in ftp_list(ftp):
            if name in keep:
                continue
            if typ == "dir":
                ftp.cwd(name)
                walk()
                ftp.cwd("..")
                ftp.rmd(name)
                removed.append(f"dir {name}")
            else:
                ftp.delete(name)
                removed.append(f"file {name}")

    walk()
    return removed


def purge_subdomain(ftp: ftplib.FTP) -> None:
    cwd(ftp, SUBDOMAIN_REMOTE)
    removed = ftp_delete_tree(ftp, keep={".htaccess", ".well-known"})
    cwd(ftp, SUBDOMAIN_REMOTE)
    upload = SUBDOMAIN_HTACCESS.read_bytes()
    ftp.storbinary("STOR .htaccess", __import__("io").BytesIO(upload))
    print(f"Purged {len(removed)} items from {SUBDOMAIN_REMOTE}; kept .htaccess (+ .well-known if present)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="HEAD-check external and /resources URLs")
    parser.add_argument("--purge-subdomain", action="store_true")
    args = parser.parse_args()

    errors = check_links(live=args.live)
    lan_errors = check_lan_triggers()
    if lan_errors:
        print("LAN permission triggers (load-time BTCPay assets):")
        for err in lan_errors:
            print(f"  {err}")
        errors.extend(lan_errors)
    if errors:
        print("Link issues:")
        for err in errors:
            print(f"  {err}")
    else:
        print("No link issues found" + (" (local)" if not args.live else " (local + live)"))

    if args.purge_subdomain:
        ftp = ftp_connect()
        try:
            purge_subdomain(ftp)
        finally:
            ftp.quit()

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
