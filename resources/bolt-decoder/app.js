import { decode as decodeBolt11 } from 'https://esm.sh/light-bolt11-decoder@3.2.0';
import { decodeBolt12, verifyBolt12Signature } from 'https://esm.sh/bolt12-ts@0.2.1';
import { bech32 } from 'https://esm.sh/@scure/base@1.2.6';

ResourcesSite.mountToolHeader({
  title: 'BOLT11 / LNURL / LN Address / offer decoder',
  subtitle: 'Decode Lightning invoices, Lightning Addresses, LNURL bech32 strings, and BOLT12 offers.',
  clientSide: true,
  network: true,
});

function msatToBtc(msat) {
  return (Number(msat) / 1e11).toLocaleString('en-US', { maximumFractionDigits: 11 });
}

function msatDisplay(msat) {
  if (msat == null) return 'Any amount';
  return `${Number(msat).toLocaleString()} msat (${msatToBtc(msat)} BTC)`;
}

function decodeLnurlBech32(value) {
  const lower = value.toLowerCase();
  const { prefix, words } = bech32.decode(lower, 2000);
  const bytes = bech32.fromWords(words);
  const url = new TextDecoder().decode(bytes);
  return { prefix, url };
}

/** LUD-16: user@domain → https://domain/.well-known/lnurlp/user */
function parseLightningAddress(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([a-zA-Z0-9._%+\-]+)@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})$/);
  if (!match) return null;
  const [, user, domain] = match;
  const url = `https://${domain.toLowerCase()}/.well-known/lnurlp/${encodeURIComponent(user)}`;
  return { address: `${user}@${domain.toLowerCase()}`, user, domain: domain.toLowerCase(), url };
}

function isLnurlpHttps(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && /\/\.well-known\/lnurlp\/[^/]+\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return { url: res.url || url, json: await res.json() };
}

/**
 * Resolve LNURL-p JSON. Same-origin → cross-origin 301 (e.g. davidcoen.it → btcpay)
 * breaks fetch() redirect following in browsers; follow Location manually instead.
 */
async function fetchLnurlMeta(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'manual' });
  } catch (e) {
    // Fall back to automatic follow (works when the host itself is CORS-enabled).
    return fetchJson(url);
  }

  if (res.type === 'opaqueredirect' || res.status === 0) {
    return fetchJson(url);
  }

  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get('Location');
    if (!loc) throw new Error(`${res.status} redirect without Location`);
    const next = new URL(loc, url).href;
    return fetchJson(next);
  }

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return { url: res.url || url, json: await res.json() };
}

function renderLnurlPayMeta(meta) {
  const rows = [];
  if (meta.tag) rows.push(['Tag', ResourcesSite.escape(String(meta.tag))]);
  if (meta.callback) {
    rows.push([
      'Callback',
      `<a href="${ResourcesSite.escape(meta.callback)}" target="_blank" rel="noopener">${ResourcesSite.escape(meta.callback)}</a>`,
    ]);
  }
  if (meta.minSendable != null) rows.push(['Min sendable', msatDisplay(meta.minSendable)]);
  if (meta.maxSendable != null) rows.push(['Max sendable', msatDisplay(meta.maxSendable)]);
  if (meta.commentAllowed != null) rows.push(['Comment allowed', String(meta.commentAllowed)]);
  if (meta.allowsNostr != null) rows.push(['Allows Nostr', meta.allowsNostr ? 'yes' : 'no']);
  if (meta.nostrPubkey) rows.push(['Nostr pubkey', `<code>${ResourcesSite.escape(meta.nostrPubkey)}</code>`]);
  if (meta.metadata) {
    try {
      const parsed = typeof meta.metadata === 'string' ? JSON.parse(meta.metadata) : meta.metadata;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (Array.isArray(entry) && entry.length >= 2) {
            rows.push([ResourcesSite.escape(String(entry[0])), ResourcesSite.escape(String(entry[1]))]);
          }
        }
      }
    } catch {
      rows.push(['Metadata', ResourcesSite.escape(String(meta.metadata))]);
    }
  }
  return rows.length ? ResourcesSite.table(rows) : '';
}

async function renderLnurlEndpoint(labelRows, url) {
  let html = ResourcesSite.table(labelRows);
  try {
    const { url: fetchedUrl, json: meta } = await fetchLnurlMeta(url);
    if (fetchedUrl && fetchedUrl !== url) {
      html += ResourcesSite.table([
        [
          'Fetched from',
          `<a href="${ResourcesSite.escape(fetchedUrl)}" target="_blank" rel="noopener">${ResourcesSite.escape(fetchedUrl)}</a>`,
        ],
      ]);
    }
    html += '<h3>LNURL-pay metadata</h3>' + renderLnurlPayMeta(meta);
    html += `<h3>Live JSON</h3><pre>${ResourcesSite.escape(JSON.stringify(meta, null, 2))}</pre>`;
  } catch (e) {
    html += `<p class="muted">Could not fetch URL (CORS or offline): ${ResourcesSite.escape(e.message)}</p>`;
  }
  return html;
}

function renderBolt11(raw) {
  const d = decodeBolt11(raw);
  const amountSection = d.sections.find((s) => s.name === 'amount');
  const rows = [
    ['Type', 'BOLT11 invoice'],
    ['Network', d.network?.bech32 || '—'],
    ['Amount', amountSection ? msatDisplay(amountSection.value * 1000) : 'Any amount'],
    ['Description', d.sections.find((s) => s.name === 'description')?.value || '—'],
    ['Payment hash', d.sections.find((s) => s.name === 'payment_hash')?.value || '—'],
    ['Expiry (s)', d.expiry || '—'],
    ['Timestamp', d.timestamp ? new Date(d.timestamp * 1000).toISOString() : '—'],
    ['Signature', d.signature ? 'present' : '—'],
  ];
  return ResourcesSite.table(rows) + `<pre>${ResourcesSite.escape(JSON.stringify(d, null, 2))}</pre>`;
}

function flattenValue(value) {
  if (value == null) return '—';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) return value.map((v) => flattenValue(v)).join(', ');
  if (value instanceof Uint8Array) return ResourcesSite.escape([...value].map((b) => b.toString(16).padStart(2, '0')).join(''));
  if (typeof value === 'object') {
    return `<pre>${ResourcesSite.escape(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))}</pre>`;
  }
  return ResourcesSite.escape(String(value));
}

function renderBolt12(raw) {
  const decoded = decodeBolt12(raw);
  const typeLabel = decoded.prefix === 'lno' ? 'BOLT12 offer' : decoded.prefix === 'lnr' ? 'BOLT12 invoice request' : decoded.prefix === 'lni' ? 'BOLT12 invoice' : `BOLT12 (${decoded.prefix})`;
  const rows = [['Type', typeLabel]];

  const fieldMap = [
    ['chain', 'Chain'],
    ['offerId', 'Offer id'],
    ['description', 'Description'],
    ['currency', 'Currency'],
    ['amountMsat', 'Amount'],
    ['issuer', 'Issuer'],
    ['issuerId', 'Issuer id'],
    ['paths', 'Paths'],
    ['features', 'Features'],
    ['recurrence', 'Recurrence'],
    ['quantityMax', 'Quantity max'],
    ['payerId', 'Payer id'],
    ['offerPaths', 'Offer paths'],
    ['offerNodeId', 'Offer node id'],
    ['signature', 'Signature'],
    ['invoiceNodeId', 'Invoice node id'],
    ['paymentHash', 'Payment hash'],
    ['paymentSecret', 'Payment secret'],
    ['createdAt', 'Created at'],
    ['relativeExpiry', 'Relative expiry (s)'],
    ['fallbacks', 'Fallbacks'],
    ['blindedPaths', 'Blinded paths'],
    ['invoicePaths', 'Invoice paths'],
  ];

  for (const [key, label] of fieldMap) {
    if (decoded[key] !== undefined) {
      let display = flattenValue(decoded[key]);
      if (key === 'amountMsat') display = msatDisplay(decoded[key]);
      if (key === 'createdAt' && decoded[key]) display = `${decoded[key]} (${new Date(Number(decoded[key]) * 1000).toISOString()})`;
      rows.push([label, display]);
    }
  }

  let sigRow = '—';
  try {
    const valid = verifyBolt12Signature(raw);
    sigRow = valid ? '<span class="status-pill status-ok">valid</span>' : '<span class="status-pill status-bad">invalid</span>';
  } catch (e) {
    sigRow = `<span class="status-pill status-warn">not checked</span> ${ResourcesSite.escape(e.message)}`;
  }
  rows.push(['Signature check', sigRow]);

  return ResourcesSite.table(rows) + `<h3>Full decode</h3><pre>${ResourcesSite.escape(JSON.stringify(decoded, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))}</pre>`;
}

async function decodeInput() {
  const raw = document.getElementById('input').value.trim();
  const result = document.getElementById('result');
  result.hidden = false;
  if (!raw) {
    result.innerHTML = '<p class="status-bad">Paste a value to decode.</p>';
    return;
  }
  result.innerHTML = '<p class="muted">Decoding…</p>';
  try {
    let value = raw;
    if (value.startsWith('lightning:')) value = value.slice('lightning:'.length);
    if (value.includes('?')) value = value.split('?')[0];

    if (/^ln(url|urlc|urlw|urlx)[0-9]/i.test(value)) {
      const { prefix, url } = decodeLnurlBech32(value);
      result.innerHTML = await renderLnurlEndpoint(
        [
          ['Type', `LNURL (${prefix})`],
          ['Decoded URL', `<a href="${ResourcesSite.escape(url)}" target="_blank" rel="noopener">${ResourcesSite.escape(url)}</a>`],
        ],
        url,
      );
      return;
    }

    const lnAddress = parseLightningAddress(value);
    if (lnAddress) {
      result.innerHTML = await renderLnurlEndpoint(
        [
          ['Type', 'Lightning Address (LUD-16)'],
          ['Address', ResourcesSite.escape(lnAddress.address)],
          [
            'Resolved LNURL-p',
            `<a href="${ResourcesSite.escape(lnAddress.url)}" target="_blank" rel="noopener">${ResourcesSite.escape(lnAddress.url)}</a>`,
          ],
        ],
        lnAddress.url,
      );
      return;
    }

    if (isLnurlpHttps(value)) {
      const resolved = new URL(value);
      const user = decodeURIComponent(resolved.pathname.replace(/\/+$/, '').split('/').pop());
      result.innerHTML = await renderLnurlEndpoint(
        [
          ['Type', 'LNURL-p HTTPS endpoint'],
          ['User', ResourcesSite.escape(user)],
          [
            'URL',
            `<a href="${ResourcesSite.escape(resolved.href)}" target="_blank" rel="noopener">${ResourcesSite.escape(resolved.href)}</a>`,
          ],
        ],
        resolved.href,
      );
      return;
    }

    if (/^ln(bc|tb|bcrt)/i.test(value)) {
      result.innerHTML = renderBolt11(value.toLowerCase());
      return;
    }

    if (/^ln[oir]/i.test(value)) {
      result.innerHTML = renderBolt12(value.toLowerCase());
      return;
    }

    result.innerHTML =
      '<p class="status-bad">Unrecognized format. Supported: BOLT11 (lnbc…), BOLT12 (lno/lnr/lni…), LNURL bech32, Lightning Address (user@domain), LNURL-p HTTPS URL, lightning: URI.</p>';
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
}

document.getElementById('decodeBtn').addEventListener('click', decodeInput);
