#!/bin/sh
set -e
mkdir -p /var/lib/tor/davidcoen
# Docker named volumes often remount as 0755; Tor requires 0700.
chmod 700 /var/lib/tor /var/lib/tor/davidcoen
exec tor -f /etc/tor/torrc
