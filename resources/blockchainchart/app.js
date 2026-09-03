ResourcesSite.mountToolHeader({
  title: 'Bitcoin blockchain size',
  subtitle: 'Historical chain size in gigabytes.',
  clientSide: true,
  network: true,
});

if (window.luxon) {
  window.luxon.Settings.defaultLocale = 'en';
}

const RANGE_UNIT = {
  '1year': 'month',
  '5years': 'year',
  all: 'year',
};

let chart;
let span = RANGE_UNIT[new URLSearchParams(location.search).get('span')]
  ? new URLSearchParams(location.search).get('span')
  : 'all';

function themeColors() {
  const attr = document.documentElement.getAttribute('data-theme');
  const dark = attr === 'dark'
    || (!attr && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return dark
    ? {
      fg: '#f5f5f5',
      muted: '#aaa',
      grid: 'rgba(255,255,255,0.08)',
      line: '#f7931a',
      fill: 'rgba(247,147,26,0.16)',
    }
    : {
      fg: '#111',
      muted: '#444',
      grid: 'rgba(0,0,0,0.08)',
      line: '#c45c00',
      fill: 'rgba(247,147,26,0.18)',
    };
}

function formatGb(gb) {
  return `${gb.toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`;
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function mbToGb(mb) {
  return mb / 1000;
}

function applyThemeToChart() {
  if (!chart) return;
  const c = themeColors();
  const ds = chart.data.datasets[0];
  ds.borderColor = c.line;
  ds.backgroundColor = c.fill;
  chart.options.scales.x.ticks.color = c.muted;
  chart.options.scales.x.grid.color = c.grid;
  chart.options.scales.y.ticks.color = c.muted;
  chart.options.scales.y.grid.color = c.grid;
  chart.options.scales.y.title.color = c.fg;
  chart.options.plugins.legend.labels.color = c.fg;
  chart.update('none');
}

function ensureChart() {
  if (chart) return chart;
  const c = themeColors();
  chart = new Chart(document.getElementById('sizeChart'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Blockchain size',
        data: [],
        borderColor: c.line,
        backgroundColor: c.fill,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.15,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 12, bottom: 4 } },
      scales: {
        x: {
          type: 'time',
          adapters: { date: { locale: 'en' } },
          time: { unit: 'year' },
          ticks: { color: c.muted, maxRotation: 0 },
          grid: { color: c.grid },
        },
        y: {
          title: { display: true, text: 'Size (GB)', color: c.fg },
          ticks: {
            color: c.muted,
            callback: (value) => Number(value).toLocaleString('en-US'),
          },
          grid: { color: c.grid },
        },
      },
      plugins: {
        legend: { display: false, labels: { color: c.fg } },
        tooltip: {
          callbacks: {
            title: (items) => formatDate(items[0].parsed.x),
            label: (ctx) => formatGb(ctx.parsed.y),
          },
        },
      },
    },
  });
  return chart;
}

async function load(nextSpan) {
  span = nextSpan;
  document.querySelectorAll('.range-row button').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.span === span);
  });
  const status = document.getElementById('status');
  status.textContent = 'Loading chart data…';
  status.className = 'muted';
  try {
    const data = await ResourcesSite.fetchJson(
      `https://api.blockchain.info/charts/blocks-size?timespan=${encodeURIComponent(span)}&format=json&cors=true`,
    );
    const values = Array.isArray(data.values) ? data.values : [];
    if (!values.length) throw new Error('No chart points returned.');
    const points = values.map((item) => ({
      x: item.x * 1000,
      y: mbToGb(item.y),
    }));
    const first = points[0];
    const last = points[points.length - 1];
    const grown = last.y - first.y;
    document.getElementById('headline').textContent = formatGb(last.y);
    document.getElementById('subhead').textContent =
      `${formatDate(first.x)} to ${formatDate(last.x)} · ${grown >= 0 ? '+' : ''}${formatGb(grown)}`;
    const instance = ensureChart();
    instance.data.datasets[0].data = points;
    instance.options.scales.x.time.unit = RANGE_UNIT[span] || 'year';
    if (span === 'all') {
      instance.options.scales.y.min = 0;
      instance.options.scales.y.beginAtZero = true;
    } else {
      delete instance.options.scales.y.min;
      instance.options.scales.y.beginAtZero = false;
    }
    applyThemeToChart();
    status.textContent = `${points.length} samples`;
  } catch (err) {
    document.getElementById('headline').textContent = 'Could not load chart';
    document.getElementById('subhead').textContent = '';
    status.className = 'status-bad';
    status.textContent = err.message || String(err);
  }
}

document.querySelectorAll('.range-row button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.span;
    const url = new URL(location.href);
    if (next === 'all') url.searchParams.delete('span');
    else url.searchParams.set('span', next);
    history.replaceState(null, '', url);
    load(next);
  });
});

new MutationObserver(() => applyThemeToChart()).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

load(span);
