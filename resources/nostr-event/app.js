import { verifyEvent, getEventHash, nip19 } from 'https://esm.sh/nostr-tools@2.10.4';

ResourcesSite.mountToolHeader({
  title: 'Nostr event inspector',
  subtitle: 'Validate signatures and decode NIP-19 identifiers.',
  clientSide: true,
});

function parseInput(raw) {
  const value = raw.trim();
  if (!value) throw new Error('Paste an event JSON or NIP-19 code.');
  if (value.startsWith('{')) return JSON.parse(value);
  if (value.startsWith('note1') || value.startsWith('nevent1') || value.startsWith('nprofile1') || value.startsWith('npub1')) {
    const decoded = nip19.decode(value);
    if (decoded.type === 'nevent') return decoded.data;
    throw new Error(`Decoded ${decoded.type}; paste full event JSON for inspection.`);
  }
  throw new Error('Expected JSON event or NIP-19 note/nevent string.');
}

document.getElementById('inspectBtn').addEventListener('click', () => {
  const result = document.getElementById('result');
  result.hidden = false;
  try {
    const event = parseInput(document.getElementById('input').value);
    const valid = verifyEvent(event);
    const hash = getEventHash(event);
    const rows = [
      ['Signature valid', valid ? '<span class="status-pill status-ok">yes</span>' : '<span class="status-pill status-bad">no</span>'],
      ['Event id', `<span class="mono">${event.id}</span>`],
      ['Computed id', `<span class="mono">${hash}</span>`],
      ['Pubkey', `<span class="mono">${event.pubkey}</span>`],
      ['NIP-19 npub', `<span class="mono">${nip19.npubEncode(event.pubkey)}</span>`],
      ['Kind', String(event.kind)],
      ['Created', new Date(event.created_at * 1000).toISOString()],
      ['Content', ResourcesSite.escape(event.content || '')],
      ['Tags', `<pre>${ResourcesSite.escape(JSON.stringify(event.tags, null, 2))}</pre>`],
    ];
    result.innerHTML = ResourcesSite.table(rows);
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
});
