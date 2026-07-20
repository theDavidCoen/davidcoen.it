#!/usr/bin/env python3
"""Deploy static site + move WordPress to /legacy/ on davidcoen.it via FTP."""

from __future__ import annotations

import base64
import ftplib
import io
import json
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REMOTE_ROOT = "/public_html"
LEGACY = "legacy"
STAMP = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

WP_ITEMS = [
    "wp-admin",
    "wp-content",
    "wp-includes",
    "index.php",
    "license.txt",
    "readme.html",
    "wp-activate.php",
    "wp-blog-header.php",
    "wp-comments-post.php",
    "wp-config-sample.php",
    "wp-config.php",
    "wp-cron.php",
    "wp-links-opml.php",
    "wp-load.php",
    "wp-login.php",
    "wp-mail.php",
    "wp-settings.php",
    "wp-signup.php",
    "wp-trackback.php",
    "xmlrpc.php",
]

STATIC_PATHS = [
    "index.html",
    "accept-bitcoin.html",
    "privacy.html",
    "robots.txt",
    "sitemap.xml",
    "css/style.css",
    "js/cookie-consent.js",
    "js/theme-toggle.js",
    "assets/david-coen.jpg",
    "assets/david-coen.webp",
    "assets/apple-touch-icon.png",
    "assets/favicon.ico",
    "favicon.ico",
]

TESTS = [
    ("https://davidcoen.it/", "David Coen"),
    ("https://davidcoen.it/privacy.html", "Privacy"),
    ("https://davidcoen.it/accept-bitcoin.html", "Accept Bitcoin"),
    ("https://davidcoen.it/news/", "news"),
    ("https://davidcoen.it/feed/", "rss"),
    ("https://davidcoen.it/category/eventi/", "eventi"),
    ("https://davidcoen.it/shoes-in-bitcoin-23-lightning-network-with-david-coen/", "Shoes in Bitcoin"),
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
    parts = [p for p in path.strip("/").split("/") if p]
    for part in parts:
        ftp.cwd(part)


def exists(ftp: ftplib.FTP, name: str) -> bool:
    try:
        ftp.size(name)
        return True
    except ftplib.error_perm:
        pass
    try:
        ftp.nlst(name)
        return True
    except ftplib.error_perm:
        return False


def download_bytes(ftp: ftplib.FTP, name: str) -> bytes:
    buf: list[bytes] = []
    ftp.retrbinary(f"RETR {name}", buf.append)
    return b"".join(buf)


def upload_bytes(ftp: ftplib.FTP, name: str, data: bytes) -> None:
    ftp.storbinary(f"STOR {name}", io.BytesIO(data))


def ensure_dir(ftp: ftplib.FTP, rel_dir: str) -> None:
    """Create directory relative to REMOTE_ROOT (/public_html)."""
    cwd(ftp, REMOTE_ROOT)
    for part in rel_dir.strip("/").split("/"):
        if not part:
            continue
        try:
            ftp.mkd(part)
        except ftplib.error_perm:
            pass
        ftp.cwd(part)


def backup_remote_files(ftp: ftplib.FTP, backup_dir: Path) -> None:
    backup_dir.mkdir(parents=True, exist_ok=True)
    cwd(ftp, REMOTE_ROOT)
    for name in [".htaccess", "wp-config.php", "index.php"]:
        if not exists(ftp, name):
            continue
        data = download_bytes(ftp, name)
        (backup_dir / name.replace(".", "_")).write_bytes(data)
    meta = {"stamp": STAMP, "files": sorted(p.name for p in backup_dir.iterdir())}
    (backup_dir / "meta.json").write_text(json.dumps(meta, indent=2))


def move_wp_to_legacy(ftp: ftplib.FTP) -> None:
    cwd(ftp, REMOTE_ROOT)
    ensure_dir(ftp, LEGACY)
    cwd(ftp, REMOTE_ROOT)
    for item in WP_ITEMS:
        cwd(ftp, REMOTE_ROOT)
        if not exists(ftp, item):
            print(f"  skip missing: {item}")
            continue
        dest = f"{LEGACY}/{item}"
        print(f"  move {item} -> {dest}")
        ftp.rename(item, dest)


def patch_wp_config(content: str) -> str:
    if "WP_HOME" not in content:
        insert = (
            "\ndefine('WP_HOME', 'https://davidcoen.it');\n"
            "define('WP_SITEURL', 'https://davidcoen.it/legacy');\n"
        )
        content = content.replace("/* That's all, stop editing!", insert + "/* That's all, stop editing!")
    content = re.sub(
        r"define\(\s*'WP_HOME'[^;]*;",
        "define('WP_HOME', 'https://davidcoen.it');",
        content,
    )
    content = re.sub(
        r"define\(\s*'WP_SITEURL'[^;]*;",
        "define('WP_SITEURL', 'https://davidcoen.it/legacy');",
        content,
    )
    return content


def upload_static_site(ftp: ftplib.FTP) -> None:
    cwd(ftp, REMOTE_ROOT)
    for rel in STATIC_PATHS:
        local = ROOT / rel
        if not local.is_file():
            raise FileNotFoundError(local)
        remote_dir = str(Path(rel).parent)
        if remote_dir not in (".", ""):
            ensure_dir(ftp, remote_dir)
            cwd(ftp, REMOTE_ROOT)
        print(f"  upload {rel}")
        upload_bytes(ftp, rel, local.read_bytes())


def upload_deploy_files(ftp: ftplib.FTP) -> None:
    cwd(ftp, REMOTE_ROOT)
    ht = (ROOT / "deploy/root.htaccess.example").read_bytes()
    idx = (ROOT / "deploy/index.php.example").read_bytes()
    # backup current htaccess on server
    if exists(ftp, ".htaccess"):
        upload_bytes(ftp, f".htaccess.pre-static-{STAMP}", download_bytes(ftp, ".htaccess"))
    upload_bytes(ftp, ".htaccess", ht)
    upload_bytes(ftp, "index.php", idx)

    cwd(ftp, f"{REMOTE_ROOT}/{LEGACY}")
    legacy_ht = (ROOT / "deploy/legacy.htaccess.example").read_bytes()
    upload_bytes(ftp, ".htaccess", legacy_ht)

    cwd(ftp, f"{REMOTE_ROOT}/{LEGACY}")
    cfg = download_bytes(ftp, "wp-config.php").decode("utf-8", errors="replace")
    cfg = patch_wp_config(cfg)
    upload_bytes(ftp, "wp-config.php", cfg.encode("utf-8"))


def upload_db_update_script(ftp: ftplib.FTP) -> str:
    cwd(ftp, REMOTE_ROOT)
    cfg = download_bytes(ftp, f"{LEGACY}/wp-config.php").decode("utf-8", errors="replace")
    db = {
        k: re.search(rf"define\('{k}',\s*'([^']*)'\)", cfg).group(1)
        for k in ["DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST"]
    }
    prefix = re.search(r"\$table_prefix\s*=\s*'([^']*)'", cfg).group(1)
    token = f"migrate_{STAMP}"
    php = f"""<?php
if (($_GET['token'] ?? '') !== '{token}') {{ http_response_code(403); exit('forbidden'); }}
$m = new mysqli('{db["DB_HOST"]}', '{db["DB_USER"]}', '{db["DB_PASSWORD"]}', '{db["DB_NAME"]}');
if ($m->connect_error) {{ die('db: ' . $m->connect_error); }}
$p = '{prefix}';
$m->query("UPDATE {{$p}}options SET option_value='https://davidcoen.it/legacy' WHERE option_name='siteurl'");
$m->query("UPDATE {{$p}}options SET option_value='https://davidcoen.it' WHERE option_name='home'");
$m->query("UPDATE {{$p}}options SET option_value='' WHERE option_name IN ('rewrite_rules','category_children')");
$m->close();
@unlink(__FILE__);
echo 'ok';
"""
    name = f"wp_migrate_{STAMP}.php"
    upload_bytes(ftp, name, php.encode("utf-8"))
    return f"https://davidcoen.it/{name}?token={token}"


def run_url(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "davidcoen-migrate/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read(12000).decode("utf-8", errors="replace")
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read(8000).decode("utf-8", errors="replace")
        return e.code, body


def smoke_tests() -> list[tuple[str, bool, str]]:
    out = []
    for url, needle in TESTS:
        code, body = run_url(url)
        ok = code == 200 and needle.lower() in body.lower()
        out.append((url, ok, f"HTTP {code}"))
    return out


def main() -> int:
    backup_dir = ROOT / "backups" / STAMP
    print(f"=== davidcoen.it migration {STAMP} ===")

    ftp = ftp_connect()
    try:
        print("[1/6] Backup remote files...")
        backup_remote_files(ftp, backup_dir)
        print(f"      -> {backup_dir}")

        cwd(ftp, REMOTE_ROOT)
        if exists(ftp, LEGACY):
            print(f"ERROR: {LEGACY}/ already exists. Abort.")
            return 1

        print("[2/6] Move WordPress to legacy/...")
        move_wp_to_legacy(ftp)

        print("[3/6] Upload static site...")
        upload_static_site(ftp)

        print("[4/6] Upload .htaccess, bootstrap index.php, patch wp-config...")
        upload_deploy_files(ftp)

        print("[5/6] Update database URLs...")
        migrate_url = upload_db_update_script(ftp)
        time.sleep(1)
        code, body = run_url(migrate_url)
        if "ok" not in body:
            print(f"ERROR: DB migrate failed: HTTP {code} {body[:200]}")
            return 1
        print("      DB updated, temp script removed")

        print("[6/6] Smoke tests...")
        time.sleep(2)
        results = smoke_tests()
        failed = [r for r in results if not r[1]]
        for url, ok, note in results:
            print(f"  {'OK' if ok else 'FAIL'} {url} ({note})")
        if failed:
            print(f"\n{len(failed)} test(s) failed — check site manually")
            return 2

        print("\nMigration complete.")
        return 0
    finally:
        ftp.quit()


if __name__ == "__main__":
    sys.exit(main())
