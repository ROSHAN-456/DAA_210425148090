// DOM Elements
const els = {
  runKruskalBtn: document.getElementById('runKruskalBtn'),
  runPrimBtn: document.getElementById('runPrimBtn'),
  compareBothBtn: document.getElementById('compareBothBtn'),

  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  resetViewBtn: document.getElementById('resetViewBtn'),

  prevStepBtn: document.getElementById('prevStepBtn'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  nextStepBtn: document.getElementById('nextStepBtn'),
  restartBtn: document.getElementById('restartBtn'),
  speedSlider: document.getElementById('speedSlider'),
  speedLabel: document.getElementById('speedLabel'),
  progressFill: document.getElementById('progressFill'),

  statAlgo: document.getElementById('statAlgo'),
  statStep: document.getElementById('statStep'),
  statVertex: document.getElementById('statVertex'),
  statVisited: document.getElementById('statVisited'),
  statCost: document.getElementById('statCost'),
  statExec: document.getElementById('statExec'),

  explainTitle: document.getElementById('explainTitle'),
  explainBody: document.getElementById('explainBody'),

  dataPanelTitle: document.getElementById('dataPanelTitle'),
  edgeTableWrap: document.getElementById('edgeTableWrap'),
  edgeTableBody: document.getElementById('edgeTableBody'),
  pqWrap: document.getElementById('pqWrap'),
  pqItems: document.getElementById('pqItems'),

  miniAccepted: document.getElementById('miniAccepted'),
  miniRejected: document.getElementById('miniRejected'),
  miniRemaining: document.getElementById('miniRemaining'),

  resultsGrid: document.getElementById('resultsGrid'),
  resAlgo: document.getElementById('resAlgo'),
  resCost: document.getElementById('resCost'),
  resEdges: document.getElementById('resEdges'),
  resTime: document.getElementById('resTime'),
  resComplexity: document.getElementById('resComplexity'),

  chartHint: document.getElementById('chartHint'),
  darkModeToggle: document.getElementById('darkModeToggle'),
  heroBg: document.getElementById('heroBg')
};

// State
let renderer;
let currentRun = null;
let stepIndex = -1;
let isPlaying = false;
let playInterval = null;
const speeds = [2000, 1000, 500, 100]; // Multipliers: 0.5x, 1x, 2x, Faster
const speedLabels = ['0.5x', '1x', '2x', 'Max'];

// Chart Instances
let execChart, edgeChart, costChart;

// Generate Hero BG
function drawHeroBg() {
  els.heroBg.innerHTML = '';
  // simple dots and lines
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 1200, y = Math.random() * 700;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 3);
    circle.setAttribute('fill', 'rgba(100,116,139,0.5)');
    els.heroBg.appendChild(circle);
  }
}

// Init
function init() {
  drawHeroBg();
  renderer = new GraphRenderer(document.getElementById('graphSvg'), DEFAULT_GRAPH);

  els.zoomInBtn.addEventListener('click', () => renderer.zoom(1.2));
  els.zoomOutBtn.addEventListener('click', () => renderer.zoom(0.8));
  els.resetViewBtn.addEventListener('click', () => renderer.resetView());

  els.runKruskalBtn.addEventListener('click', () => startAlgorithm('kruskal'));
  els.runPrimBtn.addEventListener('click', () => startAlgorithm('prim'));
  els.compareBothBtn.addEventListener('click', compareBoth);

  els.playPauseBtn.addEventListener('click', togglePlay);
  els.prevStepBtn.addEventListener('click', prevStep);
  els.nextStepBtn.addEventListener('click', nextStep);
  els.restartBtn.addEventListener('click', () => gotoStep(0));

  els.speedSlider.addEventListener('input', (e) => {
    els.speedLabel.textContent = speedLabels[e.target.value];
    if (isPlaying) { togglePlay(); togglePlay(); } // restart interval
  });

  els.darkModeToggle.addEventListener('click', () => {
    document.body.dataset.theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  });

  // smooth scroll
  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelector(btn.dataset.scroll).scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Auto-run Kruskal on load so it doesn't look empty
  setTimeout(() => startAlgorithm('kruskal'), 500);
}

function startAlgorithm(type) {
  const t0 = performance.now();
  let result;
  if (type === 'kruskal') result = runKruskalSteps(DEFAULT_GRAPH);
  else result = runPrimSteps(DEFAULT_GRAPH, 0); // start at node 0
  const execTime = performance.now() - t0;

  currentRun = { ...result, execTime };
  stepIndex = -1;
  isPlaying = false;
  clearInterval(playInterval);
  els.playPauseBtn.textContent = '▶';
  els.resultsGrid.hidden = true;
  renderer.clearHighlights();

  setupDataPanel(type);
  els.statAlgo.textContent = type === 'kruskal' ? 'Kruskal' : 'Prim';

  updateCharts(type, currentRun);
  gotoStep(0);

  // Auto-play!
  setTimeout(() => {
    if (stepIndex === 0 && !isPlaying) togglePlay();
  }, 500);
}

function setupDataPanel(type) {
  if (type === 'kruskal') {
    els.dataPanelTitle.textContent = "Sorted Edges Table";
    els.pqWrap.hidden = true;
    els.edgeTableWrap.hidden = false;
    // Populate table
    els.edgeTableBody.innerHTML = currentRun.sortedEdges.map(id => {
      const e = DEFAULT_GRAPH.edges.find(x => x.id === id);
      return `<tr id="tr-${id}"><td>${e.u} &mdash; ${e.v}</td><td>${e.w}</td><td class="status-cell">Pending</td></tr>`;
    }).join('');
  } else {
    els.dataPanelTitle.textContent = "Priority Queue & Edge Stats";
    els.pqWrap.hidden = false;
    els.edgeTableWrap.hidden = true;
  }
}

function togglePlay() {
  if (!currentRun) return;
  isPlaying = !isPlaying;

  if (isPlaying) {
    els.playPauseBtn.textContent = '⏸';
    const sDelay = speeds[els.speedSlider.value];
    playInterval = setInterval(nextStep, sDelay);
  } else {
    els.playPauseBtn.textContent = '▶';
    clearInterval(playInterval);
  }
}

function nextStep() {
  if (!currentRun) return;
  if (stepIndex < currentRun.steps.length - 1) {
    gotoStep(stepIndex + 1);
  } else {
    if (isPlaying) togglePlay();
  }
}

function prevStep() {
  if (!currentRun) return;
  if (stepIndex > 0) gotoStep(stepIndex - 1);
}

function gotoStep(idx) {
  stepIndex = idx;
  const step = currentRun.steps[idx];

  renderer.clearHighlights();

  // progress bar
  els.progressFill.style.width = `${(idx / (currentRun.steps.length - 1)) * 100}%`;

  // update UI panels
  els.statStep.textContent = `${idx + 1} / ${currentRun.steps.length}`;
  els.statCost.textContent = step.cost;
  els.statExec.textContent = idx === currentRun.steps.length - 1 ? 'Finished' : 'Running';

  els.explainTitle.textContent = step.title;
  els.explainBody.textContent = step.explanation;

  if (currentRun.algorithm === 'kruskal') {
    els.statVertex.textContent = 'N/A';
    els.statVisited.textContent = `${DEFAULT_GRAPH.nodes.length - step.mstEdges.length} components`;

    // Mini stats
    els.miniAccepted.textContent = step.accepted || 0;
    els.miniRejected.textContent = step.rejected || 0;
    els.miniRemaining.textContent = step.remaining || 0;

    // Updates Table status deterministically
    const activeEdgeIndex = step.edge ? currentRun.sortedEdges.indexOf(step.edge) : -1;

    currentRun.sortedEdges.forEach((id, i) => {
      const tr = document.getElementById(`tr-${id}`);
      if (!tr) return;
      const statCell = tr.querySelector('.status-cell');

      if (step.phase === 'sort') {
        tr.className = '';
        statCell.textContent = 'Pending';
      } else {
        if (step.mstEdges.includes(id)) {
          tr.className = 'accepted-row';
          statCell.textContent = 'MST (Accepted)';
        } else {
          const isPast = activeEdgeIndex !== -1 ? (i < activeEdgeIndex) : (step.phase === 'done');
          if (isPast) {
            tr.className = 'rejected-row';
            statCell.textContent = 'Cycle (Rejected)';
          } else if (i === activeEdgeIndex) {
            if (step.phase === 'result') {
              tr.className = step.cycle ? 'rejected-row active-row' : 'accepted-row active-row';
              statCell.textContent = step.cycle ? 'Cycle (Rejected)' : 'MST (Accepted)';
            } else {
              tr.className = 'active-row';
              statCell.textContent = 'Considering...';
            }

            // Scroll the container only, without hijacking the window's scroll
            const wrap = els.edgeTableWrap;
            wrap.scrollTop = tr.offsetTop - wrap.offsetHeight / 2 + tr.offsetHeight / 2;
          } else {
            tr.className = '';
            statCell.textContent = 'Pending';
          }
        }
      }
    });

    // Apply edges to renderer
    step.mstEdges.forEach(id => renderer.setEdgeState(id, 'accepted'));
    if (step.phase === 'consider') renderer.setEdgeState(step.edge, 'current');
    if (step.phase === 'result' && step.cycle) renderer.setEdgeState(step.edge, 'rejected'); // transient

  } else {
    // Prim Updates
    els.statVertex.textContent = step.current || '—';
    els.statVisited.textContent = step.visited.length;
    els.miniAccepted.textContent = step.mstEdges.length;

    const unv = DEFAULT_GRAPH.nodes.length - step.visited.length;
    els.miniRejected.textContent = 'Implicit';
    els.miniRemaining.textContent = unv;

    // PQ
    els.pqItems.innerHTML = step.pq.map(px => `
      <div class="pq-item">
         <span>To Node ${px.to}</span>
         <span class="pq-item-key">w: ${px.key}</span>
      </div>
    `).join('');

    // Apply to Renderer
    renderer.applyVisitedNodes(step.visited);
    renderer.applyMstEdges(step.mstEdges);
    if (step.pendingEdge) renderer.setEdgeState(step.pendingEdge, 'current');
    if (step.current) Object.values(renderer.nodeEls).forEach(({ circle }) => circle.classList.remove('node-current'));
    if (step.current && step.phase !== 'done') renderer.setNodeState(step.current, 'current');
  }

  // Done logic
  if (step.phase === 'done') {
    showResults();
  } else {
    els.resultsGrid.hidden = true;
  }
}

function showResults() {
  els.resultsGrid.hidden = false;
  els.resAlgo.textContent = currentRun.algorithm === 'kruskal' ? 'Kruskal\'s' : 'Prim\'s';
  els.resCost.textContent = currentRun.cost;
  els.resEdges.textContent = currentRun.mst.length;
  els.resTime.textContent = fmt.ms(currentRun.execTime);
  els.resComplexity.textContent = currentRun.algorithm === 'kruskal' ? 'O(E log E)' : 'O(E log V)';
}

function updateCharts(type, data) {
  els.chartHint.hidden = true;
  const cRed = '#ef4444', cGreen = '#10b981', cBlue = '#3b82f6';

  if (execChart) execChart.destroy();
  execChart = new Chart(document.getElementById('execTimeChart'), {
    type: 'bar',
    data: {
      labels: [type],
      datasets: [{ label: 'Execution Time (ms)', data: [data.execTime], backgroundColor: cBlue }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  if (edgeChart) edgeChart.destroy();
  const acc = data.steps[data.steps.length - 1].mstEdges.length;
  // kruskal tracks rejected, prim doesn't really
  const rej = type === 'kruskal' ? data.steps[data.steps.length - 1].rejected : (DEFAULT_GRAPH.edges.length - acc);

  edgeChart = new Chart(document.getElementById('edgeSplitChart'), {
    type: 'doughnut',
    data: {
      labels: ['Accepted', 'Rejected/Unused'],
      datasets: [{ data: [acc, rej], backgroundColor: [cGreen, cRed] }]
    }
  });

  if (costChart) costChart.destroy();
  const costSnaps = data.steps.filter(s => s.phase === 'add' || (s.phase === 'result' && !s.cycle)).map(s => s.cost);
  costChart = new Chart(document.getElementById('costGrowthChart'), {
    type: 'line',
    data: {
      labels: costSnaps.map((_, i) => `Edge ${i + 1}`),
      datasets: [{ label: 'Total MST Cost', data: costSnaps, borderColor: cBlue, tension: 0.2, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function compareBoth() {
  const t0 = performance.now();
  const kData = runKruskalSteps(DEFAULT_GRAPH);
  const t1 = performance.now();
  const tk = t1 - t0;

  const p0 = performance.now();
  const pData = runPrimSteps(DEFAULT_GRAPH, 0);
  const p1 = performance.now();
  const tp = p1 - p0;

  if (execChart) execChart.destroy();
  execChart = new Chart(document.getElementById('execTimeChart'), {
    type: 'bar',
    data: {
      labels: ['Kruskal', 'Prim'],
      datasets: [{ label: 'Execution Time (ms)', data: [tk, tp], backgroundColor: ['#8b5cf6', '#3b82f6'] }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  if (edgeChart) edgeChart.destroy();
  const kAcc = kData.steps[kData.steps.length - 1].mstEdges.length;
  const kRej = kData.steps[kData.steps.length - 1].rejected;
  const pAcc = pData.steps[pData.steps.length - 1].mstEdges.length;
  const pRej = DEFAULT_GRAPH.edges.length - pAcc;

  edgeChart = new Chart(document.getElementById('edgeSplitChart'), {
    type: 'bar',
    data: {
      labels: ['Kruskal', 'Prim'],
      datasets: [
        { label: 'Accepted', data: [kAcc, pAcc], backgroundColor: '#10b981' },
        { label: 'Rejected/Unused', data: [kRej, pRej], backgroundColor: '#ef4444' }
      ]
    },
    options: { scales: { y: { stacked: true }, x: { stacked: true } } }
  });

  if (costChart) costChart.destroy();
  const kSnaps = kData.steps.filter(s => s.phase === 'add' || (s.phase === 'result' && !s.cycle)).map(s => s.cost);
  const pSnaps = pData.steps.filter(s => s.phase === 'add').map(s => s.cost);

  costChart = new Chart(document.getElementById('costGrowthChart'), {
    type: 'line',
    data: {
      labels: kSnaps.map((_, i) => `Edge ${i + 1}`),
      datasets: [
        { label: 'Kruskal MST Cost', data: kSnaps, borderColor: '#8b5cf6', tension: 0.2, fill: false },
        { label: 'Prim MST Cost', data: pSnaps, borderColor: '#3b82f6', tension: 0.2, fill: false }
      ]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  els.chartHint.hidden = false;
  els.chartHint.textContent = `Comparison finished cleanly. Kruskal: ${fmt.ms(tk)}, Prim: ${fmt.ms(tp)}.`;

  // scroll to complexity
  document.querySelector('#complexity').scrollIntoView({ behavior: 'smooth' });
}

window.addEventListener('DOMContentLoaded', init);
