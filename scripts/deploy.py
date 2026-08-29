#!/usr/bin/env python3
"""Deploy static davidcoen.it to clearnet (FTP) and Tor copy on homelab portable.

Clearnet hosting stays on shared hosting. The portable only gets a static mirror
served via Tor (see deploy/portable-tor/).

Credentials: FileZilla sitemanager (same as scripts/migrate-deploy.py).
Onion address: deploy/onion-hostname (one line, no scheme) after first Tor setup.
Portable target: PORTABLE_HOST and PORTABLE_DIR environment variables.
"""

from __future__ import annotations

import argparse
import base64
import ftplib
import io
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REMOTE_ROOT = "/public_html"
PORTABLE_HOST = os.environ.get("PORTABLE_HOST", "david@homelab-portable")
PORTABLE_DIR = os.environ.get("PORTABLE_DIR", "~/davidcoen-tor")
ONION_FILE = ROOT / "deploy" / "onion-hostname"

STATIC_PATHS = [
    "index.html",
    "accept-bitcoin.html",
    "privacy.html",
    "robots.txt",
    "sitemap.xml",
    "favicon.ico",
    "css/style.css",
    "css/satoshi-snake.css",
    "js/cookie-consent.js",
    "js/theme-toggle.js",
    "js/satoshi-snake.js",
    "assets/og-social.jpg",
    "assets/og-social.webp",
    "assets/david-coen.jpg",
    "assets/david-coen.webp",
    "assets/apple-touch-icon.png",
    "assets/favicon.ico",
    "assets/favicon-theme.png",
    "assets/logo-light.png",
]


def onion_host() -> str | None:
    if not ONION_FILE.is_file():
        return None
    lines = ONION_FILE.read_text(encoding="utf-8").strip().splitlines()
    if not lines:
        return None
    host = lines[0].strip().lower()
    if "://" in host:
        host = host.split("://", 1)[1]
    host = host.strip().strip("/")
    return host or None


def ftp_connect() -> ftplib.FTP:
    tree = ET.parse(Path.home() / ".config/filezilla/sitemanager.xml")
    srv = tree.getroot().find(".//Server")
    if srv is None:
        raise RuntimeError("No FileZilla Server entry found")
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


def ensure_dir(ftp: ftplib.FTP, rel_dir: str) -> None:
    cwd(ftp, REMOTE_ROOT)
    for part in rel_dir.strip("/").split("/"):
        if not part:
            continue
        try:
            ftp.mkd(part)
        except ftplib.error_perm:
            pass
        ftp.cwd(part)


def upload_bytes(ftp: ftplib.FTP, name: str, data: bytes) -> None:
    ftp.storbinary(f"STOR {name}", io.BytesIO(data))


def upload_static(ftp: ftplib.FTP) -> None:
    for rel in STATIC_PATHS:
        local = ROOT / rel
        if not local.is_file():
            raise FileNotFoundError(local)
        parent = str(Path(rel).parent)
        if parent in (".", ""):
            cwd(ftp, REMOTE_ROOT)
        else:
            ensure_dir(ftp, parent)
        print(f"  FTP {rel}")
        upload_bytes(ftp, Path(rel).name, local.read_bytes())


def build_htaccess(onion: str | None) -> bytes:
    base = (ROOT / "deploy" / "root.htaccess.example").read_text(encoding="utf-8")
    if onion:
        base = base.replace("ONION_HOST_PLACEHOLDER", onion)
    else:
        # Do not publish a broken Onion-Location header
        lines = []
        for line in base.splitlines(keepends=True):
            if "Onion-Location" in line or "ONION_HOST_PLACEHOLDER" in line:
                continue
            if "Tor Browser suggestion" in line:
                continue
            lines.append(line)
        base = "".join(lines)
    return base.encode("utf-8")


def upload_htaccess(ftp: ftplib.FTP, onion: str | None) -> None:
    cwd(ftp, REMOTE_ROOT)
    print("  FTP .htaccess" + (" (Onion-Location)" if onion else ""))
    upload_bytes(ftp, ".htaccess", build_htaccess(onion))


def rsync_portable() -> None:
    remote = f"{PORTABLE_HOST}:{PORTABLE_DIR}/html/"
    subprocess.run(
        ["ssh", PORTABLE_HOST, f"mkdir -p {PORTABLE_DIR}/html && rm -rf {PORTABLE_DIR}/html/*"],
        check=True,
    )
    # Explicit file list — avoids pulling .git/backups via include=*/
    list_file = ROOT / "deploy" / "portable-tor" / ".rsync-files"
    list_file.write_text("\n".join(STATIC_PATHS) + "\n", encoding="utf-8")
    cmd = [
        "rsync",
        "-av",
        "--files-from",
        str(list_file),
        f"{ROOT}/",
        remote,
    ]
    print(f"  rsync → {remote}")
    subprocess.run(cmd, check=True)


def sync_compose_stack() -> None:
    src = ROOT / "deploy" / "portable-tor"
    subprocess.run(
        ["ssh", PORTABLE_HOST, f"mkdir -p {PORTABLE_DIR}"],
        check=True,
    )
    subprocess.run(
        [
            "rsync",
            "-av",
            "--exclude",
            "html/",
            f"{src}/",
            f"{PORTABLE_HOST}:{PORTABLE_DIR}/",
        ],
        check=True,
    )


def fetch_onion_from_portable() -> str | None:
    cmd = (
        f"cd {PORTABLE_DIR} && docker compose exec -T tor "
        "cat /var/lib/tor/davidcoen/hostname 2>/dev/null || true"
    )
    proc = subprocess.run(
        ["ssh", PORTABLE_HOST, cmd],
        check=False,
        capture_output=True,
        text=True,
    )
    lines = (proc.stdout or "").strip().splitlines()
    return lines[0].strip() if lines else None


def ensure_onion_file() -> str | None:
    existing = onion_host()
    if existing:
        return existing
    fetched = fetch_onion_from_portable()
    if fetched:
        ONION_FILE.write_text(fetched + "\n", encoding="utf-8")
        print(f"  wrote {ONION_FILE.relative_to(ROOT)} ← {fetched}")
        return fetched
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clearnet-only", action="store_true")
    parser.add_argument("--portable-only", action="store_true")
    parser.add_argument(
        "--stack",
        action="store_true",
        help="Also sync docker compose files to portable",
    )
    parser.add_argument("--skip-htaccess", action="store_true")
    args = parser.parse_args()

    do_clearnet = not args.portable_only
    do_portable = not args.clearnet_only

    onion = ensure_onion_file()
    if not onion:
        print(
            "NOTE: deploy/onion-hostname missing — Onion-Location skipped "
            "until Tor HS is up (setup portable, then re-deploy).",
            file=sys.stderr,
        )

    if do_portable:
        print(f"=== portable Tor copy ({PORTABLE_HOST}) ===")
        if args.stack:
            sync_compose_stack()
        rsync_portable()

    if do_clearnet:
        print("=== clearnet FTP ===")
        ftp = ftp_connect()
        try:
            upload_static(ftp)
            if not args.skip_htaccess:
                upload_htaccess(ftp, onion)
        finally:
            ftp.quit()

    if onion:
        print(f"\nOnion: http://{onion}/")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
