(function () {
  const BADGE_CLIENT = '<span class="badge badge-client">[client-side]</span>';
  const BADGE_NETWORK = '<span class="badge badge-network">[network]</span>';
  const BADGE_SENSITIVE = '<span class="badge badge-warn">[sensitive]</span>';

  const THEME_TOGGLE = `<button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch to dark theme">
    <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg>
    <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true" hidden><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1.1a1 1 0 1 1 2 0V21a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v1.1a1 1 0 0 1-1 1Zm10 9a1 1 0 0 1-1 1h-1.1a1 1 0 1 1 0-2H21a1 1 0 0 1 1 1ZM4.1 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1.1a1 1 0 0 1 1 1Zm14.7 6.7a1 1 0 0 1 0 1.4l-.8.8a1 1 0 1 1-1.4-1.4l.8-.8a1 1 0 0 1 1.4 0ZM6.5 6.5a1 1 0 0 1 0 1.4l-.8.8A1 1 0 1 1 4.3 7.3l.8-.8a1 1 0 0 1 1.4 0Zm12 0 .8.8a1 1 0 0 1-1.4 1.4l-.8-.8a1 1 0 0 1 1.4-1.4ZM6.5 17.5l-.8.8a1 1 0 0 1-1.4-1.4l.8-.8a1 1 0 0 1 1.4 1.4Z"/></svg>
  </button>`;

  let btcHistoryPromise = null;

  const BASE = window.RESOURCES_BASE || '/resources';

  window.ResourcesSite = {
    BADGE_CLIENT,
    BADGE_NETWORK,
    BADGE_SENSITIVE,
    mountToolHeader(options) {
      const {
        title,
        subtitle = '',
        clientSide = true,
        network = false,
        sensitive = false,
      } = options;
      const mount = document.getElementById('tool-header');
      if (!mount) return;
      const badges = [
        clientSide ? BADGE_CLIENT : '',
        network ? BADGE_NETWORK : '',
        sensitive ? BADGE_SENSITIVE : '',
      ].filter(Boolean).join(' ');
      mount.innerHTML = `
        <header class="site-header tool-header">
          <div class="header-top">
            <a class="back-link" href="${BASE}/">← Resources</a>
            ${THEME_TOGGLE}
          </div>
          <h1>${title}</h1>
          ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
          ${badges ? `<p class="tool-badges">${badges}</p>` : ''}
        </header>`;
      if (window.ResourcesThemeToggle) {
        window.ResourcesThemeToggle.init();
      }
    },
    el(id) {
      return document.getElementById(id);
    },
    showResult(id, html) {
      const node = this.el(id);
      if (!node) return;
      node.innerHTML = html;
      node.hidden = false;
    },
    escape(s) {
      return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    },
    table(rows) {
      const body = rows
        .map(([k, v]) => `<tr><th>${this.escape(k)}</th><td>${v}</td></tr>`)
        .join('');
      return `<table class="data"><tbody>${body}</tbody></table>`;
    },
    async fetchJson(url, init) {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    async fetchBtcHistory() {
      if (!btcHistoryPromise) {
        btcHistoryPromise = this.fetchJson(
          'https://api.blockchain.info/charts/market-price?timespan=all&format=json&cors=true',
        ).then((data) => data.values || []);
      }
      return btcHistoryPromise;
    },
    async yearlyAverageUsd(year) {
      const values = await this.fetchBtcHistory();
      const start = Date.UTC(year, 0, 1) / 1000;
      const end = Date.UTC(year + 1, 0, 1) / 1000;
      const prices = values
        .filter((v) => v.x >= start && v.x < end && v.y > 0)
        .map((v) => v.y);
      if (!prices.length) {
        throw new Error(`No market price data for ${year} (BTC may not have traded yet).`);
      }
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    },
    async currentBtcUsd() {
      const ticker = await this.fetchJson('https://api.blockchain.info/ticker?cors=true');
      const last = ticker?.USD?.last;
      if (!Number.isFinite(last) || last <= 0) throw new Error('Could not read current BTC/USD');
      return last;
    },
  };
})();
