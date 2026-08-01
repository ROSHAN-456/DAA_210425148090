/* ============================================================
   AI MATRIX OPTIMIZER — charts.js
   Chart.js analytics dashboard.
   ============================================================ */

const ChartsModule = (() => {
  let costChart, progressChart, radarChart, pieChart;
  let acceptedCount = 0, rejectedCount = 0;

  const palette = {
    orange: '#FF6B00',
    primary: '#FF4500',
    cyan: '#00E5FF',
    teal: '#00F5D4',
    green: '#39FF88',
    red: '#FF3B3B',
    amber: '#FFD166',
    text: '#F8FAFC',
    grid: 'rgba(255,255,255,0.08)'
  };

  Chart.defaults.color = 'rgba(248,250,252,0.7)';
  Chart.defaults.font.family = "'Rajdhani', 'Orbitron', sans-serif";

  function baseGridOptions() {
    return {
      grid: { color: palette.grid, borderColor: palette.grid },
      ticks: { color: 'rgba(248,250,252,0.6)' }
    };
  }

  function initCharts() {
    const costCtx = document.getElementById('chart-cost');
    const progressCtx = document.getElementById('chart-progress');
    const radarCtx = document.getElementById('chart-radar');
    const pieCtx = document.getElementById('chart-pie');

    costChart = new Chart(costCtx, {
      type: 'bar',
      data: { labels: [], datasets: [{
        label: 'Split Cost',
        data: [],
        backgroundColor: [],
        borderRadius: 4,
        borderWidth: 0
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { legend: { display: false }, title: { display: false } },
        scales: { x: baseGridOptions(), y: baseGridOptions() }
      }
    });

    progressChart = new Chart(progressCtx, {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Minimum Cost',
        data: [],
        borderColor: palette.cyan,
        backgroundColor: 'rgba(0,229,255,0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointBackgroundColor: palette.teal
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false } },
        scales: { x: baseGridOptions(), y: baseGridOptions() }
      }
    });

    radarChart = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Speed', 'Accuracy', 'Efficiency', 'Memory', 'Convergence', 'Stability'],
        datasets: [{
          label: 'Algorithm Profile',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: 'rgba(255,107,0,0.25)',
          borderColor: palette.orange,
          pointBackgroundColor: palette.amber
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: palette.grid },
            grid: { color: palette.grid },
            pointLabels: { color: 'rgba(248,250,252,0.75)', font: { size: 11 } },
            ticks: { display: false, backdropColor: 'transparent' }
          }
        },
        plugins: { legend: { display: false } }
      }
    });

    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Accepted Splits', 'Rejected Splits'],
        datasets: [{
          data: [0, 0],
          backgroundColor: [palette.green, palette.red],
          borderColor: '#140A06',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: 'rgba(248,250,252,0.75)' } } },
        cutout: '65%'
      }
    });
  }

  function resetCharts() {
    acceptedCount = 0; rejectedCount = 0;
    [costChart, progressChart].forEach(c => {
      c.data.labels = [];
      c.data.datasets[0].data = [];
      if (c.data.datasets[0].backgroundColor && Array.isArray(c.data.datasets[0].backgroundColor)) {
        c.data.datasets[0].backgroundColor = [];
      }
      c.update();
    });
    pieChart.data.datasets[0].data = [0, 0];
    pieChart.update();
    radarChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
    radarChart.update();
  }

  function pushSplitEval(step) {
    const label = `A${step.i}..A${step.j}|k${step.k}`;
    costChart.data.labels.push(label);
    costChart.data.datasets[0].data.push(step.cost);
    costChart.data.datasets[0].backgroundColor.push(step.accepted ? palette.green : palette.red);
    if (costChart.data.labels.length > 24) {
      costChart.data.labels.shift();
      costChart.data.datasets[0].data.shift();
      costChart.data.datasets[0].backgroundColor.shift();
    }
    costChart.update('none');

    if (step.accepted) acceptedCount++; else rejectedCount++;
    pieChart.data.datasets[0].data = [acceptedCount, rejectedCount];
    pieChart.update('none');
  }

  function pushMinimum(label, value) {
    progressChart.data.labels.push(label);
    progressChart.data.datasets[0].data.push(value);
    if (progressChart.data.labels.length > 30) {
      progressChart.data.labels.shift();
      progressChart.data.datasets[0].data.shift();
    }
    progressChart.update('none');
  }

  function setRadarProfile(values) {
    radarChart.data.datasets[0].data = values;
    radarChart.update();
  }

  /* -----------------------------------------------------------
     INSTANT LIVE ANALYSIS
     Fills every chart in one shot from a fully-solved DP result,
     so the moment the input changes the analytics reflect it —
     no need to press Launch first.
  ----------------------------------------------------------- */
  function renderFullAnalysis(result) {
    acceptedCount = 0; rejectedCount = 0;

    const costLabels = [], costData = [], costColors = [];
    const progLabels = [], progData = [];

    result.steps.forEach(step => {
      if (step.type === 'split-eval') {
        costLabels.push(`A${step.i}..A${step.j}|k${step.k}`);
        costData.push(step.cost);
        costColors.push(step.accepted ? palette.green : palette.red);
        step.accepted ? acceptedCount++ : rejectedCount++;
      } else if (step.type === 'cell-done') {
        progLabels.push(`A${step.i}${step.j}`);
        progData.push(step.cost);
      }
    });

    const MAX_POINTS = 40;
    const trimmedCostLabels = costLabels.slice(-MAX_POINTS);
    const trimmedCostData = costData.slice(-MAX_POINTS);
    const trimmedCostColors = costColors.slice(-MAX_POINTS);

    costChart.data.labels = trimmedCostLabels;
    costChart.data.datasets[0].data = trimmedCostData;
    costChart.data.datasets[0].backgroundColor = trimmedCostColors;
    costChart.update();

    progressChart.data.labels = progLabels.slice(-MAX_POINTS);
    progressChart.data.datasets[0].data = progData.slice(-MAX_POINTS);
    progressChart.update();

    pieChart.data.datasets[0].data = [acceptedCount, rejectedCount];
    pieChart.update();

    const n = result.n;
    const cost = result.optimalCost;
    const efficiency = Math.min(99, Math.max(40, 100 - (cost / (n * n * n * 50)) * 100));
    const memory = n * n * 8;
    radarChart.data.datasets[0].data = [
      Math.min(100, Math.max(0, 60 + n * 3)),
      92,
      efficiency,
      Math.min(100, Math.max(20, 100 - memory / 200)),
      Math.min(100, Math.max(10, 100 - (cost / 5000))),
      88
    ];
    radarChart.update();
  }

  return {
    initCharts, resetCharts, pushSplitEval, pushMinimum, setRadarProfile,
    renderFullAnalysis
  };
})();
