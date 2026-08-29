if (typeof zoomPlugin !== 'undefined') {
  Chart.register(zoomPlugin);
}

const GENESIS = new Date('2009-01-03T00:00:00Z');
const A = -17;
const B = 5.8;
let currentBTCPrice = 0;
let chart;
let marketSeries = [];

ResourcesSite.mountToolHeader({
  title: 'Bitcoin power law',
  subtitle: 'Santostasi model + market price overlay.',
  clientSide: true,
  network: true,
});

function daysSinceGenesis(date) {
  return Math.floor((date - GENESIS) / 86400000);
}

function powerLawPrice(n) {
  return 10 ** A * n ** B;
}

function formatPrice(p) {
  if (!Number.isFinite(p) || p <= 0) return '—';
  return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDateFull(d) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function setTargetDate(date) {
  const iso = date.toISOString().slice(0, 10);
  document.getElementById('targetDate').value = iso;
  const price = powerLawPrice(daysSinceGenesis(date));
  document.getElementById('predicted').textContent = `${formatDateFull(date)} → ${formatPrice(price)} (model)`;
}

function calculate() {
  const input = document.getElementById('targetDate').value;
  if (!input) return;
  setTargetDate(new Date(`${input}T12:00:00Z`));
}

function nearestMarketPrice(date) {
  const ts = date.getTime() / 1000;
  let best = null;
  let bestDiff = Infinity;
  for (const p of marketSeries) {
    const diff = Math.abs(p.x - ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best;
}

function updateHoverInfo(date) {
  const model = powerLawPrice(daysSinceGenesis(date));
  const market = nearestMarketPrice(date);
  const marketY = market?.y;
  let dev = '';
  if (marketY > 0) {
    const pct = ((marketY - model) / model * 100).toFixed(1);
    dev = ` · Market ${formatPrice(marketY)} (${pct > 0 ? '+' : ''}${pct}% vs model)`;
  }
  document.getElementById('hoverInfo').textContent = `${formatDateFull(date)} · Model ${formatPrice(model)}${dev}`;
}

async function loadCurrentPrice() {
  try {
    currentBTCPrice = await ResourcesSite.currentBtcUsd();
    const predicted = powerLawPrice(daysSinceGenesis(new Date()));
    const dev = ((currentBTCPrice - predicted) / predicted * 100).toFixed(1);
    document.getElementById('currentPrice').textContent = formatPrice(currentBTCPrice);
    const devNum = Number(dev);
    document.getElementById('deviation').innerHTML = `Deviation from model: <span class="${devNum >= 0 ? 'positive' : 'negative'}">${devNum > 0 ? '+' : ''}${dev}%</span>`;
    updateWeAreHerePoint();
  } catch (e) {
    document.getElementById('currentPrice').textContent = 'Price API error';
  }
}

const bands = [
  { max: 1e3, color: 'rgba(0, 0, 139, 0.35)', label: 'Basically free' },
  { max: 9e3, color: 'rgba(0, 0, 255, 0.35)', label: 'Blue sale' },
  { max: 3e4, color: 'rgba(0, 255, 255, 0.35)', label: 'Still cheap' },
  { max: 1e5, color: 'rgba(50, 205, 50, 0.35)', label: 'Accumulate' },
  { max: 3e5, color: 'rgba(255, 215, 0, 0.45)', label: 'HODL' },
  { max: 1e6, color: 'rgba(255, 140, 0, 0.45)', label: 'FOMO' },
  { max: 1e7, color: 'rgba(255, 0, 0, 0.5)', label: 'Danger zone' },
  { max: Infinity, color: 'rgba(139, 0, 0, 0.55)', label: 'Bubble territory' },
];

function buildChart() {
  const ctx = document.getElementById('rainbowChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Power law', data: [], borderColor: '#f7931a', borderWidth: 2, pointRadius: 0, tension: 0, order: 2 },
        ...bands.map((b, i) => ({
          label: b.label,
          data: [],
          backgroundColor: b.color,
          borderWidth: 0,
          pointRadius: 0,
          fill: i === 0 ? false : '-1',
          order: 3,
        })),
        {
          label: 'Market price',
          data: [],
          borderColor: '#7dd3fc',
          backgroundColor: 'rgba(125, 211, 252, 0.15)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
          order: 1,
        },
        {
          label: 'Current price',
          data: [],
          backgroundColor: '#f7931a',
          borderColor: '#fff',
          borderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 9,
          showLine: false,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'year' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          ticks: { color: '#ccc' },
        },
        y: {
          type: 'logarithmic',
          title: { display: true, text: 'BTC/USD (log)', color: '#f7931a' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          ticks: { color: '#ccc' },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#ddd', boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            title: (items) => formatDateFull(new Date(items[0].parsed.x)),
            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`,
          },
        },
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: null },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
          },
          limits: {
            x: { min: 'original', max: 'original' },
          },
        },
      },
      onHover: (event, elements) => {
        const canvas = chart.canvas;
        if (!event?.x) return;
        const x = chart.scales.x.getValueForPixel(event.x);
        if (x) updateHoverInfo(new Date(x));
        canvas.style.cursor = elements?.length ? 'pointer' : 'crosshair';
      },
      onClick: (event) => {
        if (!event?.x) return;
        const x = chart.scales.x.getValueForPixel(event.x);
        if (x) setTargetDate(new Date(x));
      },
    },
  });
}

function updateChart() {
  const points = [];
  const date = new Date('2009-01-03T00:00:00Z');
  const end = new Date('2040-01-01T00:00:00Z');
  while (date <= end) {
    const n = daysSinceGenesis(date);
    points.push({ x: new Date(date), y: powerLawPrice(n) });
    date.setMonth(date.getMonth() + 2);
  }
  chart.data.datasets[0].data = points;
  let prevMax = 0;
  bands.forEach((band, i) => {
    chart.data.datasets[i + 1].data = points.map((p) => ({
      x: p.x,
      y: Math.min(Math.max(p.y, prevMax), band.max),
    }));
    prevMax = band.max;
  });

  const marketPoints = marketSeries
    .filter((p) => p.y > 0)
    .map((p) => ({ x: new Date(p.x * 1000), y: p.y }));
  chart.data.datasets[bands.length + 1].data = marketPoints;
  chart.update();
}

function updateWeAreHerePoint() {
  if (!currentBTCPrice || !chart) return;
  chart.data.datasets[chart.data.datasets.length - 1].data = [{ x: new Date(), y: currentBTCPrice }];
  chart.update();
}

function calculateMilestone(target) {
  const n = 10 ** ((Math.log10(target) - A) / B);
  const future = new Date(GENESIS);
  future.setUTCDate(future.getUTCDate() + Math.ceil(n));
  return formatDateFull(future);
}

document.getElementById('calcBtn').addEventListener('click', calculate);
document.getElementById('resetZoom').addEventListener('click', () => chart.resetZoom());
document.getElementById('targetDate').value = new Date().toISOString().slice(0, 10);

(async () => {
  marketSeries = await ResourcesSite.fetchBtcHistory();
  buildChart();
  updateChart();
  calculate();
  await loadCurrentPrice();
  document.getElementById('m1').textContent = calculateMilestone(1_000_000);
  document.getElementById('m10').textContent = calculateMilestone(10_000_000);
  document.getElementById('m100').textContent = calculateMilestone(100_000_000);
})();
