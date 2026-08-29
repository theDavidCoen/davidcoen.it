const units = {
  bits: 1,
  bytes: 8,
  kilobits: 1_000,
  kilobytes: 8_000,
  megabits: 1_000_000,
  megabytes: 8_000_000,
  gigabits: 1_000_000_000,
  gigabytes: 8_000_000_000,
  terabits: 1_000_000_000_000,
  terabytes: 8_000_000_000_000,
  petabits: 1_000_000_000_000_000,
  petabytes: 8_000_000_000_000_000,
  exabits: 1_000_000_000_000_000_000,
  exabytes: 8_000_000_000_000_000_000,
};

function convert() {
  const input = Number(document.getElementById('input').value);
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const resultEl = document.getElementById('result');
  if (!Number.isFinite(input)) {
    resultEl.textContent = 'Enter a valid number.';
    return;
  }
  const bits = input * units[from];
  const out = bits / units[to];
  resultEl.textContent = `${input} ${from} = ${out.toLocaleString('en-US', { maximumFractionDigits: 12 })} ${to}`;
}
