import { Output, expand } from 'https://esm.sh/@bitcoinerlab/descriptors@1.3.1';

function stripChecksum(descriptor) {
  const hash = descriptor.indexOf('#');
  return hash >= 0 ? descriptor.slice(0, hash) : descriptor;
}

function looksLikeDescriptor(value) {
  return /[a-z]+\(/i.test(value) || value.startsWith('addr(');
}

function xpubToDescriptor(value) {
  const v = value.trim();
  if (v.startsWith('zpub') || v.startsWith('vpub')) return `wpkh(${v}/0/*)`;
  if (v.startsWith('ypub') || v.startsWith('upub')) return `sh(wpkh(${v}/0/*))`;
  if (v.startsWith('xpub') || v.startsWith('tpub')) return `pkh(${v}/0/*)`;
  throw new Error('Unsupported extended public key prefix.');
}

function detectInputKind(value) {
  if (looksLikeDescriptor(value)) return 'descriptor';
  if (/^[xyzuvt]pub/i.test(value)) return 'xpub';
  throw new Error('Paste an output descriptor or an xpub/ypub/zpub extended public key.');
}

function renderExpansion(info) {
  const rows = [];
  if (info.descriptor) rows.push(['Canonical descriptor', `<span class="mono">${ResourcesSite.escape(info.descriptor)}</span>`]);
  if (info.expandedExpression) rows.push(['Expanded expression', `<span class="mono">${ResourcesSite.escape(info.expandedExpression)}</span>`]);
  if (info.script) rows.push(['Script', `<span class="mono">${ResourcesSite.escape(info.script)}</span>`]);
  if (info.address) rows.push(['Address (index 0)', `<span class="mono">${ResourcesSite.escape(info.address)}</span>`]);
  if (info.keyOrigins) {
    rows.push(['Key origins', `<pre>${ResourcesSite.escape(JSON.stringify(info.keyOrigins, null, 2))}</pre>`]);
  }
  if (info.keys) {
    rows.push(['Keys', `<pre>${ResourcesSite.escape(JSON.stringify(info.keys, null, 2))}</pre>`]);
  }
  return ResourcesSite.table(rows);
}

function deriveFromDescriptor(descriptor, count, change) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const output = new Output({ descriptor, index: i, change });
    rows.push([`index ${i}`, `<span class="mono">${ResourcesSite.escape(output.getAddress())}</span>`]);
  }
  return rows;
}

document.getElementById('inspectBtn').addEventListener('click', () => {
  const result = document.getElementById('result');
  const value = document.getElementById('input').value.trim();
  const count = Math.min(Number(document.getElementById('count').value) || 5, 20);
  const change = Number(document.getElementById('change').value) || 0;
  result.hidden = false;
  try {
    if (!value) throw new Error('Paste a descriptor or extended public key.');
    const kind = detectInputKind(value);
    const descriptor = kind === 'descriptor' ? stripChecksum(value) : xpubToDescriptor(value);

    const expansion = expand({ descriptor });
    const sample = new Output({ descriptor, index: 0, change });

    const summary = ResourcesSite.table([
      ['Input type', kind === 'descriptor' ? 'Output descriptor' : 'Extended public key (auto-wrapped)'],
      ['Descriptor used', `<span class="mono">${ResourcesSite.escape(descriptor)}</span>`],
      ['ScriptPubKey (index 0)', `<span class="mono">${ResourcesSite.escape(sample.getScriptPubKey().toString('hex'))}</span>`],
      ['Address (index 0)', `<span class="mono">${ResourcesSite.escape(sample.getAddress())}</span>`],
      ['Change chain', change === 1 ? 'internal (1)' : 'external (0)'],
    ]);

    const derived = deriveFromDescriptor(descriptor, count, change);
    result.innerHTML = summary
      + '<h3>Descriptor expansion</h3>'
      + renderExpansion(expansion)
      + `<h3>Derived addresses (change=${change})</h3>`
      + ResourcesSite.table(derived);
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
});
