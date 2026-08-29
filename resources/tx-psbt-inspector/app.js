import * as bitcoin from 'https://esm.sh/bitcoinjs-lib@6.1.7';

ResourcesSite.mountToolHeader({
  title: 'TX / PSBT inspector',
  subtitle: 'Decode raw Bitcoin transaction hex and base64 PSBTs locally.',
  clientSide: true,
});

function sats(n) {
  return `${n.toLocaleString()} sat (${(n / 1e8).toFixed(8)} BTC)`;
}

function inspectTx(hex) {
  const tx = bitcoin.Transaction.fromHex(hex.trim());
  const rows = [
    ['TXID', `<span class="mono">${tx.getId()}</span>`],
    ['Version', String(tx.version)],
    ['Locktime', String(tx.locktime)],
    ['Inputs', String(tx.ins.length)],
    ['Outputs', String(tx.outs.length)],
  ];
  let html = ResourcesSite.table(rows);
  html += '<h3>Inputs</h3>';
  tx.ins.forEach((input, i) => {
    const txid = Buffer.from(input.hash).reverse().toString('hex');
    html += ResourcesSite.table([
      [`Input #${i}`, ''],
      ['Prev txid', `<span class="mono">${txid}</span>`],
      ['Vout', String(input.index)],
      ['Sequence', input.sequence.toString(16)],
    ]);
  });
  html += '<h3>Outputs</h3>';
  tx.outs.forEach((out, i) => {
    html += ResourcesSite.table([
      [`Output #${i}`, ''],
      ['Value', sats(out.value)],
      ['scriptPubKey', `<span class="mono">${out.script.toString('hex')}</span>`],
    ]);
  });
  return html;
}

function inspectPsbt(b64) {
  const psbt = bitcoin.Psbt.fromBase64(b64.trim(), { network: bitcoin.networks.bitcoin });
  const tx = psbt.data.globalMap.unsignedTx;
  const rows = [
    ['Type', 'PSBT'],
    ['Inputs', String(psbt.data.inputs.length)],
    ['Outputs', String(psbt.data.outputs.length)],
    ['TX version', tx ? String(tx.version) : '—'],
  ];
  let html = ResourcesSite.table(rows);
  psbt.data.inputs.forEach((input, i) => {
    const partial = input.partialSig?.map((p) => p.pubkey.toString('hex')).join(', ') || '—';
    const wit = input.witnessUtxo;
    html += ResourcesSite.table([
      [`Input #${i}`, ''],
      ['Witness UTXO', wit ? sats(wit.value) : '—'],
      ['Partial sigs', `<span class="mono">${partial}</span>`],
    ]);
  });
  psbt.data.outputs.forEach((output, i) => {
    html += ResourcesSite.table([
      [`Output #${i}`, ''],
      ['Redeem script', output.redeemScript ? `<span class="mono">${output.redeemScript.toString('hex')}</span>` : '—'],
      ['Witness script', output.witnessScript ? `<span class="mono">${output.witnessScript.toString('hex')}</span>` : '—'],
    ]);
  });
  return html;
}

document.getElementById('decodeBtn').addEventListener('click', () => {
  const result = document.getElementById('result');
  const mode = document.getElementById('mode').value;
  const input = document.getElementById('input').value.trim();
  result.hidden = false;
  try {
    if (!input) throw new Error('Paste data to inspect.');
    result.innerHTML = mode === 'psbt' ? inspectPsbt(input) : inspectTx(input);
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
});
