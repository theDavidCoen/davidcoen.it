#!/usr/bin/python3
"""Read-only Bitcoin chain stats from the local BTCPay bitcoind.

Listens on the Docker gateway only. No request input is passed to bitcoin-cli.
Public JSON is blockchain data already on the P2P network.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

CLI = os.environ.get(
    "BITCOIN_CLI",
    "/home/david/btcpayserver-docker/bitcoin-cli.sh",
)
def detect_listen_host() -> str:
    env = os.environ.get("LISTEN_HOST")
    if env:
        return env
    try:
        import socket as _socket
        sock = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
        sock.connect(("172.22.0.1", 1))
        sock.close()
        return "172.22.0.1"
    except OSError:
        return "127.0.0.1"


LISTEN_HOST = detect_listen_host()
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "18767"))
CACHE_TTL = float(os.environ.get("CACHE_TTL", "30"))
DIFF_INTERVAL = 2016
RATE_WINDOW = 60.0
RATE_MAX = 30

ALLOWED_ORIGINS = {
    "https://davidcoen.it",
    "https://www.davidcoen.it",
    "http://pbe365sjbt5iycvku6no7zwxw7lcspflaucwiudqzkxvrvcbboxyykad.onion",
}

_cache_lock = threading.Lock()
_cached: tuple[float, dict] | None = None
_rate_lock = threading.Lock()
_hits: dict[str, list[float]] = {}


def rpc(*args: str):
    proc = subprocess.run(
        [CLI, *args],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "bitcoin-cli failed").strip()
        raise RuntimeError(err.splitlines()[-1][:300])
    out = (proc.stdout or "").strip()
    if not out:
        raise RuntimeError("empty bitcoin-cli response")
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return out


def header_at(height: int) -> dict:
    blockhash = rpc("getblockhash", str(height))
    if not isinstance(blockhash, str):
        raise RuntimeError("getblockhash did not return a hash")
    header = rpc("getblockheader", blockhash)
    if not isinstance(header, dict):
        raise RuntimeError("getblockheader did not return an object")
    return header


def build_stats() -> dict:
    info = rpc("getblockchaininfo")
    height = int(info["blocks"])
    if height <= 0:
        raise RuntimeError("bitcoind has no blocks yet")
    difficulty = float(info.get("difficulty") or 0)
    synced = float(info.get("verificationprogress") or 0) >= 0.999

    hashrate = rpc("getnetworkhashps")
    try:
        hashrate_n = float(hashrate)
    except (TypeError, ValueError):
        hashrate_n = 0.0

    epoch_start = (height // DIFF_INTERVAL) * DIFF_INTERVAL
    next_retarget = epoch_start + DIFF_INTERVAL
    remaining = next_retarget - height
    blocks_in_epoch = height - epoch_start
    progress = (blocks_in_epoch / DIFF_INTERVAL) * 100.0

    start_hdr = header_at(epoch_start)
    tip_hdr = header_at(height)
    start_time = int(start_hdr["time"])
    tip_time = int(tip_hdr["time"])
    if blocks_in_epoch > 0:
        avg_s = max(1.0, (tip_time - start_time) / blocks_in_epoch)
    else:
        avg_s = 600.0
    estimated_full = avg_s * DIFF_INTERVAL
    expected = DIFF_INTERVAL * 600.0
    change_pct = ((expected / estimated_full) - 1.0) * 100.0 if estimated_full else 0.0

    previous_pct = 0.0
    if epoch_start >= DIFF_INTERVAL:
        prev_hdr = header_at(epoch_start - DIFF_INTERVAL)
        prev_diff = float(prev_hdr.get("difficulty") or 0)
        curr_diff = float(start_hdr.get("difficulty") or 0)
        if prev_diff > 0:
            previous_pct = ((curr_diff / prev_diff) - 1.0) * 100.0

    now_ms = int(time.time() * 1000)
    remaining_ms = int(remaining * avg_s * 1000)
    return {
        "source": "btcpay.davidcoen.it",
        "height": height,
        "difficulty": difficulty,
        "hashrate": hashrate_n,
        "synced": synced,
        "progressPercent": progress,
        "difficultyChange": change_pct,
        "previousRetarget": previous_pct,
        "remainingBlocks": remaining,
        "nextRetargetHeight": next_retarget,
        "timeAvg": int(avg_s * 1000),
        "estimatedRetargetDate": now_ms + remaining_ms,
        "updatedAt": now_ms,
    }


def cached_stats() -> dict:
    global _cached
    now = time.time()
    with _cache_lock:
        if _cached and now - _cached[0] < CACHE_TTL:
            return _cached[1]
    data = build_stats()
    with _cache_lock:
        _cached = (time.time(), data)
    return data


def client_ip(handler: BaseHTTPRequestHandler) -> str:
    forwarded = handler.headers.get("X-Real-IP") or handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return handler.client_address[0]


def allow_request(ip: str) -> bool:
    now = time.time()
    with _rate_lock:
        stamps = [t for t in _hits.get(ip, []) if now - t < RATE_WINDOW]
        if len(stamps) >= RATE_MAX:
            _hits[ip] = stamps
            return False
        stamps.append(now)
        _hits[ip] = stamps
        if len(_hits) > 4000:
            _hits.clear()
            _hits[ip] = stamps
        return True


class Handler(BaseHTTPRequestHandler):
    server_version = "chain-stats/1"

    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET")
            self.send_header("Access-Control-Max-Age", "3600")

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=30")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path not in ("/", "/api/public/chain-stats"):
            self._send(404, {"error": "not found"})
            return
        if not allow_request(client_ip(self)):
            self._send(429, {"error": "rate limited"})
            return
        try:
            self._send(200, cached_stats())
        except Exception as exc:
            self._send(503, {"error": "node unavailable"})
            self.log_message("stats failed: %s", exc)

    def do_POST(self) -> None:
        self._send(405, {"error": "method not allowed"})

    def do_PUT(self) -> None:
        self._send(405, {"error": "method not allowed"})

    def do_DELETE(self) -> None:
        self._send(405, {"error": "method not allowed"})


def main() -> int:
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    server.daemon_threads = True
    print(f"chain-stats listening on {LISTEN_HOST}:{LISTEN_PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
