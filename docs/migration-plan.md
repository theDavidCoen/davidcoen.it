# Migration plan — static site at root, WordPress preserved

Goal: serve the new static site at `davidcoen.it/` while keeping all legacy WordPress URLs working unchanged (`/news/`, `/feed/`, `/category/…`, post slugs, shop, etc.).

**Do not run on production until backup and staging checks are complete.**

## Strategy (recommended)

WordPress moves to `/legacy/` on disk. The public URL stays `https://davidcoen.it` for permalinks. Apache/LiteSpeed:

1. Serves static files when they exist (`index.html`, `privacy.html`, `accept-bitcoin.html`, `css/`, `js/`, `assets/`, …).
2. Internally rewrites everything else to `/legacy/…` so WordPress handles it **without changing the browser URL** (no `/legacy/` visible to visitors).

This preserves links already present in the new static site and old bookmarks/SEO.

## Prerequisites

- [ ] Full backup: `public_html/`, MySQL dump, `wp-config.php`
- [ ] Maintenance window or low-traffic slot
- [ ] Staging copy of hosting (ideal) or local rehearsal with exported DB
- [ ] URL inventory reviewed: [`wp-url-inventory.md`](./wp-url-inventory.md)

## Phase 0 — Prepare (local / repo)

- [x] URL inventory of live WordPress
- [x] Example Apache rules: [`../deploy/root.htaccess.example`](../deploy/root.htaccess.example)
- [x] Example WordPress bootstrap: [`../deploy/index.php.example`](../deploy/index.php.example)
- [ ] Dry-run checklist on staging

## Phase 1 — Backup production

```bash
# On server (paths may vary)
tar -czf ~/backup-davidcoen-$(date +%F).tar.gz public_html/
mysqldump -u USER -p DATABASE > ~/backup-davidcoen-$(date +%F).sql
```

Store off-server. Verify archive extracts cleanly.

## Phase 2 — Move WordPress to `/legacy/`

1. Create `public_html/legacy/`
2. Move **all** WordPress core files and folders into `legacy/`:
   - `wp-admin/`, `wp-includes/`, `wp-content/`
   - Root WP files: `wp-*.php`, `xmlrpc.php`, `license.txt`, …
3. **Do not** move unrelated subdomains or non-WP apps.

Update database (phpMyAdmin or WP-CLI):

```sql
UPDATE wp_options SET option_value = 'https://davidcoen.it/legacy' WHERE option_name = 'siteurl';
UPDATE wp_options SET option_value = 'https://davidcoen.it' WHERE option_name = 'home';
```

Or in `legacy/wp-config.php` (optional override):

```php
define('WP_HOME', 'https://davidcoen.it');
define('WP_SITEURL', 'https://davidcoen.it/legacy');
```

4. In **Settings → Permalinks** (wp-admin), click Save to flush rewrite rules.
5. Set `legacy/.htaccess` `RewriteBase` to `/legacy/` (see example file).

## Phase 3 — Deploy static site at root

Upload from this repo to `public_html/`:

| Path | Purpose |
|------|---------|
| `index.html` | New homepage (replaces WP front page at `/`) |
| `accept-bitcoin.html` | BTCPay overview |
| `privacy.html` | GDPR policy (replaces WP `/privacy-policy/` for new site) |
| `css/`, `js/`, `assets/` | Static assets |
| `robots.txt`, `sitemap.xml` | New sitemap (static pages only) |

Copy and adapt:

- `deploy/index.php.example` → `public_html/index.php` (WP bootstrap for non-static routes)
- `deploy/root.htaccess.example` → `public_html/.htaccess`

Set directory index order so `/` serves static home:

```apache
DirectoryIndex index.html index.php
```

## Phase 4 — Routing logic (how requests are handled)

| Request | Handler |
|---------|---------|
| `/` | `index.html` (new site) |
| `/privacy.html`, `/accept-bitcoin.html` | Static files |
| `/css/*`, `/js/*`, `/assets/*` | Static files |
| `/news/`, `/feed/`, `/category/*`, post slugs, `/shop/*`, … | Rewrite → `/legacy/…` → WordPress |
| `/legacy/wp-admin/` | WordPress admin |

See [`deploy/root.htaccess.example`](../deploy/root.htaccess.example) for full rules.

## Phase 5 — Smoke tests (before DNS / after upload)

**New static site**

- [ ] `https://davidcoen.it/` — new homepage
- [ ] `https://davidcoen.it/privacy.html`
- [ ] `https://davidcoen.it/accept-bitcoin.html`
- [ ] Dark mode toggle, cookie banner

**Legacy WordPress (URLs unchanged)**

- [ ] `https://davidcoen.it/news/`
- [ ] `https://davidcoen.it/feed/` (valid RSS)
- [ ] All 6 categories linked from new homepage
- [ ] 3 random old posts from [`wp-url-inventory.md`](./wp-url-inventory.md)
- [ ] `/shop/` (if still needed)
- [ ] `https://davidcoen.it/legacy/wp-admin/` — login

**Conflict checks**

- [ ] `/` does **not** show WordPress
- [ ] New static assets not intercepted by WP
- [ ] Old `/privacy-policy/` still reachable (or 301 → `/privacy.html` if you choose)

## Phase 6 — Optional redirects

Only if you **want** to migrate URLs (not required for preservation):

| Old | New |
|-----|-----|
| `/privacy-policy/` | `/privacy.html` |
| `/payment-processor/` | `/accept-bitcoin.html` |

Use 301 in `root.htaccess`. Do **not** redirect `/news/` or post slugs.

## Phase 7 — Post-cutover

- [ ] Submit new `sitemap.xml` in Search Console
- [ ] Monitor 404s for 2 weeks
- [ ] Keep backup at least 30 days
- [ ] Document rollback: restore tar + DB, remove static `index.html` override

## Rollback

1. Restore `public_html` from backup tar
2. Restore MySQL from dump
3. Remove static files if partially applied

## Files in this repo

| File | Role |
|------|------|
| [`wp-url-inventory.md`](./wp-url-inventory.md) | All discovered legacy URLs |
| [`wp-url-inventory.json`](./wp-url-inventory.json) | Machine-readable inventory |
| [`../deploy/root.htaccess.example`](../deploy/root.htaccess.example) | Root rewrite rules |
| [`../deploy/legacy.htaccess.example`](../deploy/legacy.htaccess.example) | WP subdirectory rules |
| [`../deploy/index.php.example`](../deploy/index.php.example) | WP front controller |
| [`../scripts/generate-legacy-rewrites.py`](../scripts/generate-legacy-rewrites.py) | Regenerate slug list from inventory |

## Status

| Step | Status |
|------|--------|
| URL inventory | Done |
| Deploy templates | Done |
| Staging rehearsal | Done (production cutover) |
| Production cutover | **Done — 2026-07-20** |
