ResourcesSite.mountToolHeader({
  title: 'Relay health checker',
  subtitle: 'NIP-11 document, HTTPS paywall, and WebSocket connectivity from your browser.',
  clientSide: true,
  network: true,
});

function wsUrl(httpsUrl) {
  const u = new URL(httpsUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

function statusRow(name, ok, detail) {
  return `<tr><th>${ResourcesSite.escape(name)}</th><td><span class="status-pill ${ok ? 'status-ok' : 'status-bad'}">${ok ? 'OK' : 'FAIL'}</span> ${detail || ''}</td></tr>`;
}

async function checkNip11(url) {
  const start = performance.now();
  const res = await fetch(url, { headers: { Accept: 'application/nostr+json' } });
  const ms = Math.round(performance.now() - start);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  return { ms, data };
}

function checkWebSocket(url) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const ws = new WebSocket(wsUrl(url));
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout'));
    }, 8000);
    ws.onopen = () => {
      clearTimeout(timer);
      ws.close();
      resolve(Math.round(performance.now() - start));
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('WebSocket error'));
    };
  });
}

document.getElementById('checkBtn').addEventListener('click', async () => {
  const relay = document.getElementById('relay').value.trim();
  const result = document.getElementById('result');
  result.hidden = false;
  result.innerHTML = '<p class="muted">Running checks…</p>';
  const rows = [];
  try {
    const nip11 = await checkNip11(relay);
    rows.push(statusRow('NIP-11', true, `${nip11.ms} ms — <span class="mono">${ResourcesSite.escape(nip11.data.name || 'relay')}</span>`));
    rows.push(`<tr><th>NIP-11 JSON</th><td><pre>${ResourcesSite.escape(JSON.stringify(nip11.data, null, 2))}</pre></td></tr>`);
  } catch (e) {
    rows.push(statusRow('NIP-11', false, ResourcesSite.escape(e.message)));
  }
  try {
    const payStart = performance.now();
    const pay = await fetch(relay, { headers: { Accept: 'text/html' } });
    const payMs = Math.round(performance.now() - payStart);
    rows.push(statusRow('HTTPS paywall', pay.ok, `${payMs} ms (${pay.status})`));
  } catch (e) {
    rows.push(statusRow('HTTPS paywall', false, ResourcesSite.escape(e.message)));
  }
  try {
    const wsMs = await checkWebSocket(relay);
    rows.push(statusRow('WebSocket', true, `${wsMs} ms`));
  } catch (e) {
    rows.push(statusRow('WebSocket', false, ResourcesSite.escape(e.message)));
  }
  result.innerHTML = `<table class="data"><tbody>${rows.join('')}</tbody></table>`;
});
