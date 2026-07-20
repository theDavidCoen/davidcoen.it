# davidcoen.it

Minimal static personal site — work in progress, local only.

## Stack

- Plain HTML / CSS / JS
- No build step required
- GDPR-friendly cookie banner (localStorage only, no trackers)

## Preview locally

```bash
cd /home/david/Documenti/davidcoen.it
python -m http.server 8080
```

Open http://localhost:8080

## Deploy

**Live since 2026-07-20.** Static site at root; WordPress preserved under `/legacy/` (URLs unchanged via root `index.php` bootstrap).

See [`docs/migration-plan.md`](docs/migration-plan.md). Deploy script: `scripts/migrate-deploy.py` (already executed).

## Pages

- `index.html` — homepage
- `accept-bitcoin.html` — BTCPay / merchant overview (internal)
- `privacy.html` — GDPR privacy policy

## Assets

- `assets/david-coen.jpg` — portrait photo (About section)
- `assets/logo-light.png` — favicon

## Links policy

All links from the current site are preserved in `index.html`, except internal shop / account URLs (omitted by choice).

Legacy WordPress pages (news, blog posts, categories) remain linked until content is migrated.

## Migration (WordPress → static at root)

See [`docs/migration-plan.md`](docs/migration-plan.md) and [`docs/wp-url-inventory.md`](docs/wp-url-inventory.md).

Deploy templates live in `deploy/` (`.htaccess` examples, WordPress bootstrap). **Production cutover not started.**
