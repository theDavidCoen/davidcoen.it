const terms = ['big spender', 'splurger', 'spender', 'spenderooni', 'wasteful one', 'money burner'];

ResourcesSite.mountToolHeader({
  title: 'Bitcoin regret calculator',
  subtitle: 'Historical USD → BTC using Blockchain.com average prices (no API key).',
  clientSide: true,
  network: true,
});

const yearSelector = document.getElementById('year');
const currentYear = new Date().getFullYear();
for (let year = 2009; year <= currentYear; year++) {
  const option = document.createElement('option');
  option.value = String(year);
  option.textContent = String(year);
  yearSelector.appendChild(option);
}
yearSelector.value = '2010';

function formatBtc(btc) {
  return `${btc.toLocaleString('en-US', { maximumFractionDigits: 8 })} BTC`;
}

function formatUsd(usd) {
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function calculate() {
  const amount = Number(document.getElementById('amount').value);
  const year = Number(document.getElementById('year').value);
  const goods = document.getElementById('goods').value.trim();
  const result = document.getElementById('result');
  if (!Number.isFinite(amount) || amount <= 0) {
    result.hidden = false;
    result.innerHTML = '<p class="status-bad">Enter a positive USD amount.</p>';
    return;
  }
  result.hidden = false;
  result.innerHTML = '<p class="muted">Loading historical price…</p>';
  try {
    const avg = await ResourcesSite.yearlyAverageUsd(year);
    const btc = amount / avg;
    const today = await ResourcesSite.currentBtcUsd();
    const todayValue = btc * today;
    const term = terms[Math.floor(Math.random() * terms.length)];
    const goodsBit = goods ? ` on <strong>${ResourcesSite.escape(goods)}</strong>` : '';
    result.innerHTML = `
      <p>You <strong>${term}</strong> — if you had not spent <strong>${formatUsd(amount)}</strong> in <strong>${year}</strong>${goodsBit}, you could have stacked about <strong class="mono">${formatBtc(btc)}</strong>.</p>
      <p class="muted">Average BTC price in ${year}: ${formatUsd(avg)} (Blockchain.com). At today's price (~${formatUsd(today)}), that would be worth about <strong>${formatUsd(todayValue)}</strong>.</p>`;
  } catch (e) {
    result.innerHTML = `<p class="status-bad">${ResourcesSite.escape(e.message)}</p>`;
  }
}

document.getElementById('calculate').addEventListener('click', calculate);
