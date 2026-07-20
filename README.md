# davidcoen.it

Static personal site at [davidcoen.it](https://davidcoen.it), with legacy WordPress preserved under `/legacy/` for existing content and admin.

## Stack

- Plain HTML / CSS / JS — no build step
- Light / dark theme toggle (`js/theme-toggle.js`, `localStorage`)
- GDPR-friendly cookie banner (`js/cookie-consent.js`, no trackers)
- Legacy WordPress 7.x in `public_html/legacy/` (PHP 8.1, Mr. Tailor + WooCommerce)

## Live layout

| URL | Serves |
|-----|--------|
| `/` | Static homepage (`index.html`) |
| `/privacy.html`, `/accept-bitcoin.html` | Static pages |
| `/news/`, `/feed/`, posts, categories, shop | WordPress (via root `index.php` bootstrap) |

Production cutover completed **2026-07-20**.

## Preview locally

```bash
cd /path/to/davidcoen.it
python -m http.server 8080
```

Open http://localhost:8080 (static pages only; WordPress routes need the live server stack).

## Deploy templates

Configuration examples for the shared-hosting setup:

| File | Purpose |
|------|---------|
| [`deploy/root.htaccess.example`](deploy/root.htaccess.example) | Static files + WordPress bootstrap + `/wp-admin/` routing |
| [`deploy/legacy.htaccess.example`](deploy/legacy.htaccess.example) | PHP 8.1 handler, redirect legacy admin/login URLs |
| [`deploy/index.php.example`](deploy/index.php.example) | Front-end WordPress bootstrap at site root |
| [`deploy/wp-config-snippet.example`](deploy/wp-config-snippet.example) | `WP_HOME` / `WP_SITEURL`, memory, cookie paths |
| [`deploy/mu-plugins/davidcoen-admin-fix.php.example`](deploy/mu-plugins/davidcoen-admin-fix.php.example) | Admin URL fixes, editor memory relief |

One-off migration script (already run on production): [`scripts/migrate-deploy.py`](scripts/migrate-deploy.py).

## Pages

- `index.html` — homepage
- `accept-bitcoin.html` — BTCPay / merchant overview (internal)
- `privacy.html` — GDPR privacy policy

## Assets

- `assets/og-social.jpg` — social share card (1200×630, Open Graph / Twitter)
- `assets/david-coen.jpg` — portrait photo (About section, JPEG fallback)
- `assets/david-coen.webp` — portrait WebP
- `assets/apple-touch-icon.png` — iOS home screen icon
- `favicon.ico` — site favicon (root)

## Links policy

External and legacy WordPress links (news, blog posts, categories) are kept in `index.html`. Internal shop / account URLs are omitted by choice.

## Migration docs

- [`docs/migration-plan.md`](docs/migration-plan.md) — cutover strategy and checklist
- [`docs/wp-url-inventory.md`](docs/wp-url-inventory.md) — legacy URL inventory

## Repo notes

- `backups/` is gitignored (contains server snapshots and secrets)
- Do not commit live `wp-config.php` or FTP credentials
