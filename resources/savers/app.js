const API_ENDPOINTS = [
  'https://gateway.liquify.com/chain/thorchain_api/thorchain/inbound_addresses',
  'https://thornode.thorchain.network/thorchain/inbound_addresses',
];

function isChainOffline(chain) {
  return Boolean(
    chain.halted ||
      chain.global_trading_paused ||
      chain.chain_trading_paused,
  );
}

function renderRows(chains) {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';

  chains
    .slice()
    .sort((a, b) => String(a.chain).localeCompare(String(b.chain)))
    .forEach((chain) => {
      const row = document.createElement('tr');
      const chainCell = document.createElement('td');
      chainCell.textContent = chain.chain;
      row.appendChild(chainCell);

      const offline = isChainOffline(chain);
      const statusCell = document.createElement('td');
      statusCell.textContent = offline ? 'OFFLINE' : 'ONLINE';
      statusCell.classList.add(offline ? 'offline' : 'online');
      row.appendChild(statusCell);

      tableBody.appendChild(row);
    });
}

function renderLastUpdate() {
  const lastUpdateTimeUTC = `${new Date().toISOString().replace('T', ' ').slice(0, -5)} UTC`;
  const lastUpdateTimeRome = new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' });
  const lastUpdateTimeLA = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const lastUpdateTime = document.getElementById('last-update-time');
  lastUpdateTime.textContent =
    `Last update: ${lastUpdateTimeUTC} | Rome: ${lastUpdateTimeRome} | Los Angeles: ${lastUpdateTimeLA}`;
}

function showError(message) {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 2;
  cell.textContent = message;
  cell.classList.add('offline');
  row.appendChild(cell);
  tableBody.appendChild(row);
}

async function fetchFromEndpoint(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error('Unexpected API response');
  }
  return data;
}

async function fetchData() {
  let lastError = null;

  for (const url of API_ENDPOINTS) {
    try {
      const data = await fetchFromEndpoint(url);
      renderRows(data);
      renderLastUpdate();
      return;
    } catch (error) {
      lastError = error;
      console.error(`THORChain status fetch failed for ${url}:`, error);
    }
  }

  showError(
    `Could not load chain status (${lastError?.message || 'network error'}). ` +
      'The public THORNode mirror may be temporarily unavailable.',
  );
}

fetchData();
setInterval(fetchData, 30 * 1000);
