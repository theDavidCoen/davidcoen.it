const HALVING_INTERVAL = 210000;
const GENESIS_SUBSIDY = 50;
const NODE_STATS_URLS = [
  '/resources/countdown/node-stats.php',
  'https://btcpay.davidcoen.it/api/public/chain-stats',
];

ResourcesSite.mountToolHeader({
  title: 'Bitcoin difficulty and halving countdown',
  subtitle: 'Retarget every 2016 blocks. Subsidy halves every 210,000 blocks.',
  clientSide: true,
  network: true,
});

let tickTimer = 0;
let snapshot = null;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '…';
  const sign = ms < 0 ? '-' : '';
  let rest = Math.abs(ms);
  const days = Math.floor(rest / 86400000);
  rest %= 86400000;
  const hours = Math.floor(rest / 3600000);
  rest %= 3600000;
  const minutes = Math.floor(rest / 60000);
  const seconds = Math.floor((rest % 60000) / 1000);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remDays = days % 365;
    return `${sign}${years}y ${remDays}d ${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  if (days >= 1) {
    return `${sign}${days}d ${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${sign}${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatWhen(ms) {
  return new Date(ms).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPct(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatHashrate(h) {
  if (!Number.isFinite(h) || h <= 0) return 'n/a';
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  if (h >= 1e12) return `${(h / 1e12).toFixed(1)} TH/s`;
  return `${h.toExponential(2)} H/s`;
}

function subsidyAt(height) {
  const era = Math.floor(height / HALVING_INTERVAL);
  return GENESIS_SUBSIDY / 2 ** era;
}

function formatBtc(n) {
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 8 })} BTC`;
}

function setMeter(id, pct) {
  const el = document.getElementById(id);
  const clamped = Math.min(100, Math.max(0, pct));
  el.setAttribute('aria-valuenow', clamped.toFixed(1));
  el.querySelector('span').style.width = `${clamped}%`;
}

function renderTick() {
  if (!snapshot) return;
  const now = Date.now();
  document.getElementById('diffCountdown').textContent = formatDuration(snapshot.diffAt - now);
  document.getElementById('halvingCountdown').textContent = formatDuration(snapshot.halvingAt - now);
}

function renderSnapshot() {
  const s = snapshot;
  document.getElementById('diffEta').textContent = `Around ${formatWhen(s.diffAt)}`;
  setMeter('diffMeter', s.diffProgress);
  document.getElementById('diffProgress').textContent =
    `${s.diffProgress.toFixed(1)}% of this 2016-block epoch`;
  document.getElementById('diffTable').innerHTML = ResourcesSite.table([
    ['Estimated change', `<strong>${formatPct(s.difficultyChange)}</strong>`],
    ['Remaining blocks', s.remainingDiffBlocks.toLocaleString('en-US')],
    ['Next retarget height', s.nextRetargetHeight.toLocaleString('en-US')],
    ['Previous retarget', formatPct(s.previousRetarget)],
    ['Avg block time', `${(s.timeAvg / 1000).toFixed(0)}s`],
    ['Network hashrate', s.hashrate],
    ['Current difficulty', s.difficulty],
  ]);

  document.getElementById('halvingEta').textContent = `Around ${formatWhen(s.halvingAt)}`;
  setMeter('halvingMeter', s.halvingProgress);
  document.getElementById('halvingProgress').textContent =
    `${s.halvingProgress.toFixed(1)}% of this 210,000-block era`;
  document.getElementById('halvingTable').innerHTML = ResourcesSite.table([
    ['Block height', s.height.toLocaleString('en-US')],
    ['Next halving height', s.nextHalvingHeight.toLocaleString('en-US')],
    ['Remaining blocks', s.remainingHalvingBlocks.toLocaleString('en-US')],
    ['Current subsidy', formatBtc(s.currentSubsidy)],
    ['Subsidy after', formatBtc(s.nextSubsidy)],
  ]);
  renderTick();
}

async function loadNodeStats() {
  let lastErr = null;
  for (const url of NODE_STATS_URLS) {
    try {
      const data = await ResourcesSite.fetchJson(url);
      const height = Number(data.height);
      if (!Number.isFinite(height) || height <= 0) continue;
      return {
        sourceLabel: data.synced === false ? 'local node (syncing)' : 'local node (BTCPay)',
        height,
        diffAt: Number(data.estimatedRetargetDate) || Date.now(),
        diffProgress: Number(data.progressPercent) || 0,
        difficultyChange: Number(data.difficultyChange) || 0,
        remainingDiffBlocks: Number(data.remainingBlocks) || 0,
        nextRetargetHeight: Number(data.nextRetargetHeight) || 0,
        previousRetarget: Number(data.previousRetarget) || 0,
        timeAvg: Number(data.timeAvg) > 0 ? Number(data.timeAvg) : 600000,
        hashrate: formatHashrate(Number(data.hashrate)),
        difficulty: Number(data.difficulty) > 0
          ? Number(data.difficulty).toLocaleString('en-US', { maximumFractionDigits: 0 })
          : 'n/a',
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Node stats unavailable');
}

async function loadMempoolStats() {
  const [diff, heightText, mining] = await Promise.all([
    ResourcesSite.fetchJson('https://mempool.space/api/v1/difficulty-adjustment'),
    fetch('https://mempool.space/api/blocks/tip/height').then(async (res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.text();
    }),
    ResourcesSite.fetchJson('https://mempool.space/api/v1/mining/hashrate/3d').catch(() => null),
  ]);
  const height = Number(heightText);
  if (!Number.isFinite(height) || height <= 0) throw new Error('Could not read chain tip height.');
  return {
    sourceLabel: 'mempool.space (node unreachable)',
    height,
    diffAt: Number(diff.estimatedRetargetDate) || Date.now() + Number(diff.remainingTime || 0),
    diffProgress: Number(diff.progressPercent) || 0,
    difficultyChange: Number(diff.difficultyChange) || 0,
    remainingDiffBlocks: Number(diff.remainingBlocks) || 0,
    nextRetargetHeight: Number(diff.nextRetargetHeight) || 0,
    previousRetarget: Number(diff.previousRetarget) || 0,
    timeAvg: Number(diff.timeAvg) > 0 ? Number(diff.timeAvg) : 600000,
    hashrate: formatHashrate(Number(mining?.currentHashrate)),
    difficulty: Number(mining?.currentDifficulty) > 0
      ? Number(mining.currentDifficulty).toLocaleString('en-US', { maximumFractionDigits: 0 })
      : 'n/a',
  };
}

async function load() {
  const status = document.getElementById('status');
  status.className = 'muted';
  status.textContent = 'Loading from local Bitcoin node…';
  try {
    let epoch;
    try {
      epoch = await loadNodeStats();
    } catch {
      status.textContent = 'Local node unreachable, falling back to mempool.space…';
      epoch = await loadMempoolStats();
    }
    const timeAvg = epoch.timeAvg;
    const nextHalvingHeight = (Math.floor(epoch.height / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
    const remainingHalvingBlocks = Math.max(0, nextHalvingHeight - epoch.height);
    const eraStart = Math.floor(epoch.height / HALVING_INTERVAL) * HALVING_INTERVAL;
    snapshot = {
      ...epoch,
      remainingHalvingBlocks,
      nextHalvingHeight,
      halvingAt: Date.now() + remainingHalvingBlocks * timeAvg,
      halvingProgress: ((epoch.height - eraStart) / HALVING_INTERVAL) * 100,
      currentSubsidy: subsidyAt(epoch.height),
      nextSubsidy: subsidyAt(nextHalvingHeight),
    };
    renderSnapshot();
    document.getElementById('panels').hidden = false;
    status.textContent = `Height ${epoch.height.toLocaleString('en-US')} · ${epoch.sourceLabel}`;
    clearInterval(tickTimer);
    tickTimer = setInterval(renderTick, 1000);
  } catch (err) {
    document.getElementById('panels').hidden = true;
    status.className = 'status-bad';
    status.textContent = err.message || String(err);
  }
}

load();
