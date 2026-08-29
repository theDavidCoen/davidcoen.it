const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32M_CONST = 0x2bc830a3;

ResourcesSite.mountToolHeader({
  title: 'Arkade address converter',
  subtitle: 'Convert Arkade addresses ↔ Taproot scriptPubKey (client-side).',
  clientSide: true,
});

function fromWords(words) {
  let acc = 0;
  let bits = 0;
  const result = [];
  for (const value of words) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      result.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(result);
}

function toWords(bytes) {
  let acc = 0;
  let bits = 0;
  const words = [];
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  return words;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function expandHrp(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function bech32mEncode(hrp, payload) {
  const values = toWords(payload);
  const checksum = polymod([...expandHrp(hrp), ...values, 0, 0, 0, 0, 0, 0]) ^ BECH32M_CONST;
  const chk = [];
  for (let i = 0; i < 6; i++) chk.push((checksum >> (5 * (5 - i))) & 31);
  return hrp + '1' + [...values, ...chk].map((v) => CHARSET[v]).join('');
}

function bech32mDecode(bech) {
  const lower = bech.toLowerCase();
  const sep = lower.lastIndexOf('1');
  if (sep < 1) throw new Error('Missing separator');
  const hrp = lower.slice(0, sep);
  const data = lower.slice(sep + 1).split('').map((c) => {
    const v = CHARSET.indexOf(c);
    if (v < 0) throw new Error(`Invalid character: ${c}`);
    return v;
  });
  const payload = fromWords(data.slice(0, -6));
  const checksum = polymod([...expandHrp(hrp), ...data]) ^ BECH32M_CONST;
  if (checksum !== 0) throw new Error('Invalid bech32m checksum');
  return { hrp, payload };
}

function compressedToXOnly(hex) {
  if (hex.length === 64) return Uint8Array.from(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  if (hex.length !== 66 || !/^0[23]/.test(hex)) throw new Error('Operator pubkey must be 33-byte compressed or 32-byte x-only hex');
  return Uint8Array.from(hex.slice(2).match(/.{2}/g).map((b) => parseInt(b, 16)));
}

function getServerKey() {
  return compressedToXOnly(document.getElementById('serverPubkey').value.trim().toLowerCase());
}

function showMessage(text, ok = true) {
  const node = document.getElementById('message');
  node.textContent = text;
  node.hidden = false;
  node.style.borderColor = ok ? '' : '#fecaca';
}

function arkToScript() {
  const input = document.getElementById('arkAddress').value.trim().toLowerCase();
  const output = document.getElementById('scriptHex');
  try {
    const { hrp, payload } = bech32mDecode(input);
    if (!['ark', 'tark'].includes(hrp)) throw new Error(`Unexpected HRP: ${hrp}`);
    if (payload.length !== 65 || payload[0] !== 0) throw new Error('Expected version 0 payload (65 bytes)');
    const taprootKey = payload.slice(33);
    output.value = `5120${toHex(taprootKey)}`;
    showMessage(`Decoded ${hrp} address (version ${payload[0]}). Operator x-only: ${toHex(payload.slice(1, 33))}`);
  } catch (e) {
    output.value = '';
    showMessage(e.message, false);
  }
}

function scriptToArk() {
  const scriptHex = document.getElementById('scriptInput').value.trim().toLowerCase();
  const output = document.getElementById('arkOutput');
  try {
    if (!/^5120[0-9a-f]{64}$/.test(scriptHex)) throw new Error('Expected P2TR scriptPubKey: 5120 + 32-byte x-only key');
    const taprootKey = Uint8Array.from(scriptHex.slice(4).match(/.{2}/g).map((b) => parseInt(b, 16)));
    const serverKey = getServerKey();
    const hrp = document.getElementById('arkAddress').value.trim().toLowerCase().startsWith('tark') ? 'tark' : 'ark';
    const payload = new Uint8Array([0, ...serverKey, ...taprootKey]);
    output.value = bech32mEncode(hrp, payload);
    showMessage(`Reconstructed ${hrp} address.`);
  } catch (e) {
    output.value = '';
    showMessage(e.message, false);
  }
}

async function fetchPubkey() {
  showMessage('Fetching operator pubkey…');
  try {
    const res = await fetch('https://arkade.computer/v1/info', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const key = data.signerPubkey || data.signer_pubkey || data.serverPubkey;
    if (!key) throw new Error('signerPubkey not found in API response');
    document.getElementById('serverPubkey').value = String(key).toLowerCase();
    showMessage('Operator pubkey loaded from arkade.computer.');
  } catch (e) {
    showMessage(`Could not fetch pubkey (CORS or API): ${e.message}. Paste it manually from GetInfo.`, false);
  }
}

document.getElementById('toScript').addEventListener('click', arkToScript);
document.getElementById('toArk').addEventListener('click', scriptToArk);
document.getElementById('fetchPubkey').addEventListener('click', fetchPubkey);
