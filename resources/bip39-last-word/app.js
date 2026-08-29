import { wordlist } from 'https://esm.sh/@scure/bip39@1.6.0/wordlists/english.js';
import { validateMnemonic, mnemonicToEntropy } from 'https://esm.sh/@scure/bip39@1.6.0';

ResourcesSite.mountToolHeader({
  title: 'Last BIP39 word calculator',
  subtitle: 'Compute valid checksum words for incomplete English mnemonics.',
  clientSide: true,
  sensitive: true,
});

const wordSet = new Set(wordlist);

function findValidLastWords(words) {
  if (![11, 23].includes(words.length)) {
    throw new Error('Enter exactly 11 or 23 valid BIP39 words.');
  }
  for (const w of words) {
    if (!wordSet.has(w)) throw new Error(`Unknown word: ${w}`);
  }
  const matches = [];
  for (const candidate of wordlist) {
    const mnemonic = [...words, candidate].join(' ');
    if (validateMnemonic(mnemonic, wordlist)) matches.push(candidate);
  }
  return matches;
}

document.getElementById('calcBtn').addEventListener('click', () => {
  const result = document.getElementById('result');
  result.hidden = false;
  try {
    const words = document.getElementById('words').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = findValidLastWords(words);
    if (!matches.length) {
      result.innerHTML = '<p class="status-bad">No valid checksum words found. Check spelling and word count.</p>';
      return;
    }
    const entropyPreview = mnemonicToEntropy([...words, matches[0]].join(' '), wordlist);
    result.innerHTML = `
      <p><strong>${matches.length}</strong> valid final word(s):</p>
      <p class="mono">${matches.map((w) => ResourcesSite.escape(w)).join(', ')}</p>
      <p class="muted">Entropy bits (first match): ${entropyPreview.length * 4} (${entropyPreview.length} bytes)</p>`;
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
});
