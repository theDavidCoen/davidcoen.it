ResourcesSite.mountToolHeader({
  title: 'Universal Decoder for Human Readable Address',
  subtitle: 'Detect and resolve Lightning Addresses, BIP 353, FIO, ENS, Unstoppable Domains, SNS, Zano aliases, and Dash usernames.',
  clientSide: true,
  network: true,
});

const PROXY = '/resources/universal-address-decoder/proxy.php';

const UD_TLDS = new Set([
  'crypto', 'nft', 'wallet', 'blockchain', 'bitcoin', 'x', 'dao', '888', 'zil',
  'hi', 'klever', 'kresus', 'anime', 'manga', 'binanceus', 'go', 'altimist',
  'pudgy', 'austin', 'bitget', 'pog', 'rain', 'unstoppable',
]);

const FIO_DOMAINS = new Set([
  'edge', 'ridl', 'shapeshift', 'guarda', 'coinomi', 'infinito', 'math',
  'mycrypto', 'trust', 'ledger', 'atomic', 'temp', 'wallet', 'fio',
]);

const SOLANA_RPCS = [
  'https://rpc.solanatracker.io/public',
  'https://solana.leorpc.com/?api_key=FREE',
];

function esc(s) {
  return ResourcesSite.escape(s);
}

function link(url, label = url) {
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

function code(s) {
  return `<code>${esc(s)}</code>`;
}

function section(title, rows, extraHtml = '') {
  return `<h3>${esc(title)}</h3>${ResourcesSite.table(rows)}${extraHtml}`;
}

function errNote(e) {
  return `<p class="muted">Could not resolve (${esc(e.message || String(e))})</p>`;
}

function stripPrefixes(raw) {
  let v = raw.trim();
  if (v.startsWith('lightning:')) v = v.slice('lightning:'.length);
  if (v.startsWith('₿')) v = v.slice(1);
  if (v.includes('?')) v = v.split('?')[0];
  return v.trim();
}

function parseAt(value) {
  const m = value.match(/^([^\s@]+)@([^\s@]+)$/);
  if (!m) return null;
  return { user: m[1], domain: m[2].toLowerCase() };
}

function tldOf(name) {
  const parts = name.toLowerCase().split('.');
  return parts.length >= 2 ? parts[parts.length - 1] : '';
}

function detectCandidates(raw) {
  const hasBitcoinPrefix = raw.trim().startsWith('₿');
  const value = stripPrefixes(raw);
  const lower = value.toLowerCase();
  const at = parseAt(value);
  const tld = at ? tldOf(at.domain) : tldOf(lower);
  const out = [];

  if (lower.endsWith('.eth')) out.push('ens');
  if (lower.endsWith('.sol') || lower.endsWith('.sns')) out.push('sns');
  if (lower.endsWith('.dash')) out.push('dash');
  if (UD_TLDS.has(tld) || (at && UD_TLDS.has(tldOf(at.domain)))) out.push('ud');

  if (at) {
    const domainHasDot = at.domain.includes('.');
    if (domainHasDot) {
      out.push('ln');
      out.push('bip353');
    }
    if (!domainHasDot || FIO_DOMAINS.has(at.domain.split('.')[0])) {
      out.push('fio');
    }
  } else if (/^@?[a-z0-9_]{1,64}$/i.test(value)) {
    out.push('zano');
    if (!value.startsWith('@')) out.push('dash');
  }

  if (hasBitcoinPrefix && !out.includes('bip353') && at) out.unshift('bip353');

  return [...new Set(out)];
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const t = await res.text();
      if (t) detail += `: ${t.slice(0, 180)}`;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}

async function proxyJson(target, bodyObj) {
  return fetchJson(`${PROXY}?target=${encodeURIComponent(target)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(bodyObj),
  });
}

async function fetchLnurlMeta(url) {
  let res = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'manual' });
  if (res.type === 'opaqueredirect' || res.status === 0) {
    return fetchJson(url, { headers: { Accept: 'application/json' } });
  }
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get('Location');
    if (!loc) throw new Error(`${res.status} redirect without Location`);
    return fetchJson(new URL(loc, url).href, { headers: { Accept: 'application/json' } });
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function resolveLn(value) {
  const at = parseAt(stripPrefixes(value));
  if (!at) throw new Error('Not an email-like address');
  const url = `https://${at.domain}/.well-known/lnurlp/${encodeURIComponent(at.user)}`;
  const rows = [
    ['Type', 'Lightning Address (LUD-16)'],
    ['Address', esc(`${at.user}@${at.domain}`)],
    ['LNURL-p URL', link(url)],
  ];
  try {
    const meta = await fetchLnurlMeta(url);
    const extra = [];
    if (meta.tag) extra.push(['Tag', esc(String(meta.tag))]);
    if (meta.callback) extra.push(['Callback', link(meta.callback)]);
    if (meta.minSendable != null) extra.push(['Min sendable (msat)', esc(String(meta.minSendable))]);
    if (meta.maxSendable != null) extra.push(['Max sendable (msat)', esc(String(meta.maxSendable))]);
    if (meta.nostrPubkey) extra.push(['Nostr pubkey', code(meta.nostrPubkey)]);
    if (meta.metadata) {
      try {
        const parsed = typeof meta.metadata === 'string' ? JSON.parse(meta.metadata) : meta.metadata;
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (Array.isArray(entry) && entry.length >= 2) extra.push([esc(String(entry[0])), esc(String(entry[1]))]);
          }
        }
      } catch { /* ignore */ }
    }
    return section('Lightning Address', rows.concat(extra), `<pre>${esc(JSON.stringify(meta, null, 2))}</pre>`);
  } catch (e) {
    return section('Lightning Address', rows) + errNote(e);
  }
}

async function resolveBip353(raw) {
  const hasPrefix = raw.trim().startsWith('₿');
  const value = stripPrefixes(raw);
  const at = parseAt(value);
  if (!at) throw new Error('BIP 353 needs user@domain (optionally prefixed with ₿)');
  const dnsName = `${at.user.toLowerCase()}.user._bitcoin-payment.${at.domain}`;
  const doh = `https://dns.google/resolve?name=${encodeURIComponent(dnsName)}&type=TXT`;
  const rows = [
    ['Type', 'BIP 353 (DNS Payment Instructions)'],
    ['Human form', esc(`${hasPrefix ? '₿' : ''}${at.user}@${at.domain}`)],
    ['DNS name', code(dnsName)],
    ['Lookup', link(doh, 'Google DoH TXT')],
  ];
  try {
    const data = await fetchJson(doh);
    const answers = (data.Answer || [])
      .filter((a) => a.type === 16)
      .map((a) => String(a.data || '').replace(/^"|"$/g, '').replace(/" "/g, ''));
    const bitcoin = answers.filter((t) => t.toLowerCase().startsWith('bitcoin:'));
    rows.push(['DNSSEC AD flag', data.AD ? 'yes (resolver claims authenticated)' : 'no / unknown']);
    rows.push(['Note', 'Browser DoH does not replace full local DNSSEC validation required by BIP 353.']);
    if (!bitcoin.length) {
      rows.push(['TXT records', answers.length ? esc(answers.join(' | ')) : 'none']);
      return section('BIP 353', rows) + '<p class="status-bad">No bitcoin: TXT record found.</p>';
    }
    const uri = bitcoin[0];
    rows.push(['Payment URI', code(uri)]);
    try {
      const u = new URL(uri);
      if (u.pathname && u.pathname !== '/') rows.push(['On-chain / path', code(u.pathname.replace(/^\//, ''))]);
      for (const [k, v] of u.searchParams.entries()) {
        rows.push([`Param ${k}`, code(v.length > 120 ? `${v.slice(0, 120)}…` : v)]);
      }
    } catch { /* ignore */ }
    return section('BIP 353', rows, `<pre>${esc(JSON.stringify({ dnsName, answers: bitcoin, raw: data }, null, 2))}</pre>`);
  } catch (e) {
    return section('BIP 353', rows) + errNote(e);
  }
}

async function resolveFio(value) {
  const at = parseAt(stripPrefixes(value));
  if (!at) throw new Error('FIO handle looks like name@domain');
  const handle = `${at.user}@${at.domain}`.toLowerCase();
  const rows = [
    ['Type', 'FIO Handle'],
    ['Handle', esc(handle)],
  ];
  const payload = { fio_address: handle, limit: 100, offset: 0 };
  const endpoints = [
    () => fetchJson('https://fio.eosrio.io/v1/chain/get_pub_addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    () => fetchJson('https://fio.eosphere.io/v1/chain/get_pub_addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    () => proxyJson('fio', payload),
    () => proxyJson('fio_alt', payload),
  ];
  let lastErr = null;
  for (const run of endpoints) {
    try {
      const data = await run();
      const addrs = data.public_addresses || [];
      if (!addrs.length) {
        rows.push(['Mapped addresses', 'none registered']);
        return section('FIO', rows, `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`);
      }
      for (const a of addrs) {
        rows.push([`${a.chain_code}/${a.token_code}`, code(a.public_address)]);
      }
      return section('FIO', rows, `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`);
    } catch (e) {
      lastErr = e;
    }
  }
  return section('FIO', rows) + errNote(lastErr || new Error('all FIO endpoints failed'));
}

async function resolveEns(value) {
  const name = stripPrefixes(value).toLowerCase();
  if (!name.endsWith('.eth')) throw new Error('ENS names end with .eth');
  const rows = [
    ['Type', 'ENS (Ethereum Name Service)'],
    ['Name', esc(name)],
  ];
  try {
    let data;
    try {
      data = await fetchJson(`https://api.ensideas.com/ens/resolve/${encodeURIComponent(name)}`);
    } catch {
      const profiles = await fetchJson(`https://api.web3.bio/profile/${encodeURIComponent(name)}`);
      const list = Array.isArray(profiles) ? profiles : [profiles];
      const ens = list.find((p) => p.platform === 'ens') || list[0];
      if (!ens) throw new Error('not found');
      data = {
        address: ens.address,
        displayName: ens.displayName || ens.identity,
        avatar: ens.avatar,
      };
    }
    if (data.address) rows.push(['ETH address', code(data.address)]);
    if (data.displayName) rows.push(['Display name', esc(data.displayName)]);
    if (data.avatar) rows.push(['Avatar', link(data.avatar)]);
    return section('ENS', rows, `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`);
  } catch (e) {
    return section('ENS', rows) + errNote(e);
  }
}

async function resolveUd(value) {
  const name = stripPrefixes(value).toLowerCase();
  const rows = [
    ['Type', 'Unstoppable Domains'],
    ['Domain', esc(name)],
    ['Explorer', link(`https://ud.me/${name}`, 'ud.me')],
  ];
  try {
    let profile;
    try {
      profile = await fetchJson(`https://api.web3.bio/ns/unstoppabledomains/${encodeURIComponent(name)}`);
    } catch {
      const list = await fetchJson(`https://api.web3.bio/profile/${encodeURIComponent(name)}`);
      const arr = Array.isArray(list) ? list : [list];
      profile = arr.find((p) => p.platform === 'unstoppabledomains') || arr[0];
    }
    if (!profile || !profile.address) {
      rows.push(['Result', 'no profile / address found']);
      return section('Unstoppable Domains', rows);
    }
    rows.push(['Owner / ETH', code(profile.address)]);
    if (profile.displayName) rows.push(['Display name', esc(profile.displayName)]);
    if (profile.avatar) rows.push(['Avatar', link(profile.avatar)]);
    if (profile.contenthash) rows.push(['Contenthash', code(profile.contenthash)]);
    return section('Unstoppable Domains', rows, `<pre>${esc(JSON.stringify(profile, null, 2))}</pre>`);
  } catch (e) {
    return section('Unstoppable Domains', rows) + errNote(e);
  }
}

async function solanaRpc(method, params) {
  const payload = { jsonrpc: '2.0', id: 1, method, params };
  let lastErr = null;
  for (const url of SOLANA_RPCS) {
    try {
      const data = await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (data.error) throw new Error(JSON.stringify(data.error));
      return data.result;
    } catch (e) {
      lastErr = e;
    }
  }
  try {
    const data = await proxyJson('solana', payload);
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.result;
  } catch (e) {
    throw lastErr || e;
  }
}

async function resolveSns(value) {
  let name = stripPrefixes(value).toLowerCase();
  if (name.endsWith('.sns')) name = `${name.slice(0, -4)}.sol`;
  if (!name.endsWith('.sol')) throw new Error('SNS domains end with .sol');
  const rows = [
    ['Type', 'SNS (Solana Name Service)'],
    ['Domain', esc(name)],
  ];

  // Prefer web3.bio (CORS-friendly, no RPC token).
  try {
    const list = await fetchJson(`https://api.web3.bio/profile/${encodeURIComponent(name)}`);
    const arr = Array.isArray(list) ? list : [list];
    const sns = arr.find((p) => p.platform === 'sns' && String(p.identity || '').toLowerCase() === name)
      || arr.find((p) => p.platform === 'sns')
      || arr[0];
    if (sns?.address) {
      rows.push(['Owner', code(sns.address)]);
      if (sns.displayName) rows.push(['Display name', esc(sns.displayName)]);
      if (sns.avatar) rows.push(['Avatar', link(sns.avatar)]);
      rows.push(['Source', 'web3.bio']);
      return section('SNS', rows, `<pre>${esc(JSON.stringify(sns, null, 2))}</pre>`);
    }
  } catch { /* fall through to on-chain */ }

  try {
    const [{ Connection }, sns] = await Promise.all([
      import('https://esm.sh/@solana/web3.js@1.95.4'),
      import('https://esm.sh/@bonfida/spl-name-service@3.0.10'),
    ]);
    // Use first working RPC via custom fetchConnection-like: Connection needs a URL string
    let lastErr = null;
    for (const rpc of SOLANA_RPCS) {
      try {
        const connection = new Connection(rpc, 'confirmed');
        const { getDomainKeySync, NameRegistryState } = sns;
        const { pubkey } = getDomainKeySync(name.replace(/\.sol$/, ''));
        const { registry } = await NameRegistryState.retrieve(connection, pubkey);
        const owner = registry.owner?.toBase58?.() || String(registry.owner);
        rows.push(['Owner', code(owner)]);
        rows.push(['Name account', code(pubkey.toBase58())]);
        rows.push(['RPC', esc(rpc)]);
        return section('SNS', rows);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('SNS resolve failed');
  } catch (e) {
    rows.push(['Hint', 'Domain may be unregistered, or public Solana RPCs rate-limited.']);
    return section('SNS', rows) + errNote(e);
  }
}

async function resolveZano(value) {
  let alias = stripPrefixes(value).toLowerCase();
  if (alias.startsWith('@')) alias = alias.slice(1);
  if (!/^[a-z0-9_]+$/.test(alias)) throw new Error('Zano alias is alphanumeric (optional leading @)');
  const rows = [
    ['Type', 'Zano Alias'],
    ['Alias', esc(`@${alias}`)],
    ['Explorer', link(`https://explorer.zano.org/aliases`, 'explorer.zano.org/aliases')],
  ];
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'get_alias_details',
    params: { alias },
  };
  try {
    let data;
    try {
      // Direct first (works if CORS ever opens)
      data = await fetchJson('https://node.zano.org/json_rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      data = await proxyJson('zano', payload);
    }
    const details = data.result?.alias_details;
    const status = data.result?.status;
    rows.push(['Status', esc(status || 'unknown')]);
    if (status === 'OK' && details?.address) {
      rows.push(['Address', code(details.address)]);
      if (details.comment) rows.push(['Comment', esc(details.comment)]);
    } else if (status === 'NOT_FOUND') {
      rows.push(['Result', 'alias not found']);
    }
    return section('Zano', rows, `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`);
  } catch (e) {
    return section('Zano', rows) + errNote(e);
  }
}

async function resolveDash(value) {
  let name = stripPrefixes(value).toLowerCase();
  if (name.startsWith('@')) name = name.slice(1);
  if (!name.endsWith('.dash')) name = `${name}.dash`;
  const label = name.replace(/\.dash$/, '');
  const rows = [
    ['Type', 'Dash Platform Username (DPNS)'],
    ['Name', esc(name)],
    ['Explorer', link(`https://platform-explorer.com/search?query=${encodeURIComponent(label)}`, 'Search on platform-explorer.com')],
  ];

  // Best-effort public HTTP attempts (often unavailable / CORS-blocked).
  const attempts = [
    `https://api.web3.bio/profile/${encodeURIComponent(name)}`,
    `https://api.web3.bio/profile/${encodeURIComponent(label)}`,
  ];
  for (const url of attempts) {
    try {
      const data = await fetchJson(url);
      const arr = Array.isArray(data) ? data : [data];
      const hit = arr.find((p) => p && (p.platform === 'dash' || String(p.identity || '').includes('dash')));
      if (hit?.address) {
        rows.push(['Resolved address / id', code(hit.address)]);
        rows.push(['Source', link(url)]);
        return section('Dash Username', rows, `<pre>${esc(JSON.stringify(hit, null, 2))}</pre>`);
      }
    } catch { /* next */ }
  }

  rows.push(['Identity lookup', 'No browser-accessible DPNS HTTP API available (Dash Platform uses gRPC DAPI).']);
  rows.push(['Next step', `Open Platform Explorer and search “${esc(label)}”.`]);
  return section('Dash Username', rows) +
    '<p class="muted">Dash usernames need a DAPI/gRPC gateway for live resolve. Detection works; live identity lookup is limited from a static page.</p>';
}

const RESOLVERS = {
  ln: resolveLn,
  bip353: resolveBip353,
  fio: resolveFio,
  ens: resolveEns,
  ud: resolveUd,
  sns: resolveSns,
  zano: resolveZano,
  dash: resolveDash,
};

const LABELS = {
  ln: 'Lightning Address',
  bip353: 'BIP 353',
  fio: 'FIO Handle',
  ens: 'ENS',
  ud: 'Unstoppable Domains',
  sns: 'SNS',
  zano: 'Zano Alias',
  dash: 'Dash Username',
};

async function decodeInput() {
  const raw = document.getElementById('input').value.trim();
  const result = document.getElementById('result');
  result.hidden = false;
  if (!raw) {
    result.innerHTML = '<p class="status-bad">Paste a human-readable address.</p>';
    return;
  }

  const candidates = detectCandidates(raw);
  if (!candidates.length) {
    result.innerHTML = '<p class="status-bad">Unrecognized format. Try user@domain, ₿user@domain, name.eth, name.crypto, name.sol, handle@edge, @alias, or name.dash.</p>';
    return;
  }

  result.innerHTML = `<p class="muted">Detected: ${candidates.map((c) => esc(LABELS[c] || c)).join(', ')} — resolving…</p>`;

  const parts = await Promise.all(
    candidates.map(async (id) => {
      try {
        return await RESOLVERS[id](raw);
      } catch (e) {
        return section(LABELS[id] || id, [['Error', esc(e.message)]]);
      }
    }),
  );

  result.innerHTML = parts.join('<hr style="border:0;border-top:1px solid var(--border);margin:1.25rem 0">');
}

document.getElementById('decodeBtn').addEventListener('click', decodeInput);
document.getElementById('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) decodeInput();
});
