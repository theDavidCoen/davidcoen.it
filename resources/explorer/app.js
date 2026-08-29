import * as bitcoin from 'https://esm.sh/bitcoinjs-lib@6.1.7';

ResourcesSite.mountToolHeader({
  title: 'Bitcoin transaction explorer',
  subtitle: 'Inspect transactions via mempool.space and decode raw hex locally.',
  clientSide: true,
  network: true,
});

const API = 'https://mempool.space/api';

function isTxid(value) {
  return /^[0-9a-f]{64}$/i.test(value);
}

function isHexTx(value) {
  return /^[0-9a-f]+$/i.test(value) && value.length >= 20 && value.length % 2 === 0;
}

function sats(n) {
  return `${Number(n).toLocaleString()} sat`;
}

function renderMempoolTx(tx) {
  const rows = [
    ['TXID', `<span class="mono">${tx.txid}</span>`],
    ['Status', tx.status?.confirmed ? `Confirmed block ${tx.status.block_height}` : 'Unconfirmed'],
    ['Size / vsize', `${tx.size} B / ${tx.weight ? Math.ceil(tx.weight / 4) : '—'} vB`],
    ['Fee', tx.fee != null ? sats(tx.fee) : '—'],
    ['Version', String(tx.version)],
    ['Locktime', String(tx.locktime)],
  ];
  let html = ResourcesSite.table(rows);
  html += '<h3>Inputs</h3>';
  (tx.vin || []).forEach((vin, i) => {
    html += ResourcesSite.table([
      [`#${i}`, vin.is_coinbase ? 'coinbase' : `<span class="mono">${vin.txid}:${vin.vout}</span>`],
      ['Prevout', vin.prevout ? sats(vin.prevout.value) : '—'],
      ['Address', vin.prevout?.scriptpubkey_address ? `<span class="mono">${ResourcesSite.escape(vin.prevout.scriptpubkey_address)}</span>` : '—'],
    ]);
  });
  html += '<h3>Outputs</h3>';
  (tx.vout || []).forEach((vout, i) => {
    html += ResourcesSite.table([
      [`#${i}`, sats(vout.value)],
      ['Address', vout.scriptpubkey_address ? `<span class="mono">${ResourcesSite.escape(vout.scriptpubkey_address)}</span>` : '—'],
      ['Type', vout.scriptpubkey_type || '—'],
    ]);
  });
  html += `<p><a href="https://mempool.space/tx/${tx.txid}" target="_blank" rel="noopener">Open on mempool.space</a></p>`;
  return html;
}

function renderLocalHex(hex) {
  const tx = bitcoin.Transaction.fromHex(hex);
  const rows = [
    ['TXID (local)', `<span class="mono">${tx.getId()}</span>`],
    ['Version', String(tx.version)],
    ['Locktime', String(tx.locktime)],
    ['Inputs', String(tx.ins.length)],
    ['Outputs', String(tx.outs.length)],
  ];
  let html = '<p class="muted">Decoded locally from raw hex.</p>' + ResourcesSite.table(rows);
  tx.outs.forEach((out, i) => {
    html += ResourcesSite.table([[`Output #${i}`, `${sats(out.value)} — <span class="mono">${out.script.toString('hex')}</span>`]]);
  });
  return html;
}

document.getElementById('lookupBtn').addEventListener('click', async () => {
  const query = document.getElementById('query').value.trim().toLowerCase();
  const result = document.getElementById('result');
  result.hidden = false;
  result.innerHTML = '<p class="muted">Loading…</p>';
  try {
    if (!query) throw new Error('Enter a txid or raw hex.');
    if (isHexTx(query) && query.length > 64) {
      let html = renderLocalHex(query);
      const txid = bitcoin.Transaction.fromHex(query).getId();
      try {
        const tx = await ResourcesSite.fetchJson(`${API}/tx/${txid}`);
        html += '<hr><h3>Known on chain</h3>' + renderMempoolTx(tx);
      } catch (_) {
        html += '<p class="muted">Transaction not found on mempool.space (may be unpublished).</p>';
      }
      result.innerHTML = html;
      return;
    }
    const txid = isTxid(query) ? query : bitcoin.Transaction.fromHex(query).getId();
    const tx = await ResourcesSite.fetchJson(`${API}/tx/${txid}`);
    result.innerHTML = renderMempoolTx(tx);
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
});
