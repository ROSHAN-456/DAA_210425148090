// ==========================================================================
// script.js — application bootstrap, navigation, and UI wiring
// ==========================================================================

(() => {
  const state = {
    graph: Utils.sampleGraph(),
    selectedEdgeId: null,
    trace: null,          // { steps, distances, prev }
    stepIndex: -1,
    playing: false,
    playTimer: null,
    speeds: [500, 300, 150, 60], // ms per step for 0.5x/1x/2x/5x
    speedIndex: 1,
    lastRunSource: null,
    lastRunDest: null,
    lastRunMs: 0,
  };

  // ---------------------------------------------------------------- Toast
  function toast(msg) {
    const host = document.getElementById('toast-host');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------------------------------------------------------------- Nav
  function initNav() {
    const links = document.querySelectorAll('.nav-link');
    links.forEach((link) => {
      link.addEventListener('click', () => {
        links.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
        document.getElementById(`page-${link.dataset.page}`).classList.add('active');
        document.getElementById('navMenu').classList.remove('open');
        if (link.dataset.page === 'builder') builderView.render();
        if (link.dataset.page === 'visualizer') { syncVertexSelects(); vizView.render(currentHighlight()); }
        if (link.dataset.page === 'statistics') {
          requestAnimationFrame(() => requestAnimationFrame(buildCharts));
        }
      });
    });

    document.getElementById('navToggleBtn').addEventListener('click', () => {
      document.getElementById('navMenu').classList.toggle('open');
    });

    document.getElementById('heroStartBtn').addEventListener('click', () => {
      document.querySelector('.nav-link[data-page="visualizer"]').click();
    });
    document.getElementById('heroLearnBtn').addEventListener('click', () => {
      document.querySelector('.nav-link[data-page="about"]').click();
    });
  }

  // ---------------------------------------------------------------- Theme
  function initTheme() {
    const btn = document.getElementById('themeToggle');
    btn.addEventListener('click', () => {
      const html = document.documentElement;
      const isLight = html.getAttribute('data-theme') === 'light';
      html.setAttribute('data-theme', isLight ? 'dark' : 'light');
      btn.textContent = isLight ? '🌙' : '☀️';
    });
  }

  // ---------------------------------------------------------------- Particles
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', Utils.debounce(resize, 200));

    const COUNT = Math.min(70, Math.floor((window.innerWidth * window.innerHeight) / 22000));
    for (let i = 0; i < COUNT; i += 1) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
      });
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(196, 145, 250, 0.55)';
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      // faint connecting lines
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.10)';
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(tick);
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) tick();
  }

  // ---------------------------------------------------------------- Hero mini graph
  function renderHeroGraph() {
    const svg = document.getElementById('heroGraphBg');
    svg.innerHTML = '';
    const g = state.graph;
    const scaleX = 1200 / 1200, scaleY = 500 / 520;
    g.edges.forEach((e) => {
      const v1 = g.vertices.find((v) => v.id === e.from);
      const v2 = g.vertices.find((v) => v.id === e.to);
      if (!v1 || !v2) return;
      const line = Utils.svgEl('line', {
        x1: v1.x * scaleX, y1: v1.y * scaleY, x2: v2.x * scaleX, y2: v2.y * scaleY,
        stroke: 'var(--accent-1)', 'stroke-width': 1.4, opacity: 0.35,
      });
      svg.appendChild(line);
    });
    g.vertices.forEach((v) => {
      const c = Utils.svgEl('circle', { cx: v.x * scaleX, cy: v.y * scaleY, r: 5, fill: 'var(--accent-2)', opacity: 0.6 });
      svg.appendChild(c);
    });
  }

  // ---------------------------------------------------------------- Graph Builder
  let builderView;
  function initBuilder() {
    const svg = document.getElementById('builderSvg');
    builderView = new GraphView(svg, {
      editable: true,
      onChange: (g) => { state.graph = g; syncEverything(); },
      onEdgeClick: (edge) => selectEdge(edge),
    });
    builderView.setGraph(state.graph);

    document.getElementById('btnAddVertex').addEventListener('click', () => {
      const id = builderView.addVertex();
      toast(`Vertex ${id} added`);
    });

    document.getElementById('btnAddEdge').addEventListener('click', () => {
      const from = Number(document.getElementById('edgeFrom').value);
      const to = Number(document.getElementById('edgeTo').value);
      const weight = Math.max(1, Number(document.getElementById('edgeWeight').value) || 1);
      if (Number.isNaN(from) || Number.isNaN(to)) { toast('Add at least two vertices first'); return; }
      if (from === to) { toast('Cannot connect a vertex to itself'); return; }
      builderView.addEdge(from, to, weight);
      toast(`Edge ${from} → ${to} (${weight}) added`);
    });

    document.getElementById('btnDeleteEdge').addEventListener('click', () => {
      if (!state.selectedEdgeId) { toast('Click an edge in the graph to select it first'); return; }
      builderView.deleteEdge(state.selectedEdgeId);
      state.selectedEdgeId = null;
      document.getElementById('edgeInfoPanel').style.display = 'none';
      toast('Edge deleted');
    });

    document.getElementById('btnSampleGraph').addEventListener('click', () => {
      state.graph = Utils.sampleGraph();
      builderView.reset(state.graph);
      syncEverything();
      toast('Sample graph loaded');
    });

    document.getElementById('btnRandomGraph').addEventListener('click', () => {
      state.graph = Utils.randomGraph(6 + Math.floor(Math.random() * 3));
      builderView.reset(state.graph);
      syncEverything();
      toast('Random graph generated');
    });

    document.getElementById('btnResetGraph').addEventListener('click', () => {
      state.graph = { vertices: [], edges: [] };
      builderView.reset(state.graph);
      syncEverything();
      toast('Graph cleared');
    });

    document.getElementById('builderZoomIn').addEventListener('click', () => builderView.zoomBy(0.85));
    document.getElementById('builderZoomOut').addEventListener('click', () => builderView.zoomBy(1.15));
    document.getElementById('builderResetView').addEventListener('click', () => builderView.resetView());
  }

  function selectEdge(edge) {
    state.selectedEdgeId = edge.id;
    const panel = document.getElementById('edgeInfoPanel');
    panel.style.display = 'block';
    document.getElementById('edgeInfoText').textContent = `${edge.from} → ${edge.to}  (weight: ${edge.weight})`;
  }

  builderView = null;

  // ---------------------------------------------------------------- Selects
  function fillVertexSelect(select, includeEmpty = false) {
    const current = select.value;
    select.innerHTML = '';
    state.graph.vertices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `Vertex ${v.id}`;
      select.appendChild(opt);
    });
    if (state.graph.vertices.some((v) => String(v.id) === current)) select.value = current;
  }

  function syncVertexSelects() {
    fillVertexSelect(document.getElementById('edgeFrom'));
    fillVertexSelect(document.getElementById('edgeTo'));
    fillVertexSelect(document.getElementById('sourceSelect'));
    fillVertexSelect(document.getElementById('destSelect'));
    // Default destination to last vertex if possible
    const destSel = document.getElementById('destSelect');
    if (destSel.options.length > 1) destSel.selectedIndex = destSel.options.length - 1;
  }

  function syncEverything() {
    syncVertexSelects();
    document.getElementById('statVertices').textContent = state.graph.vertices.length;
    document.getElementById('statEdges').textContent = state.graph.edges.length;
    renderHeroGraph();
    resetTrace();
  }

  // ---------------------------------------------------------------- Visualizer
  let vizView;
  function initVisualizer() {
    const svg = document.getElementById('vizSvg');
    vizView = new GraphView(svg, { editable: false });
    vizView.setGraph(state.graph);

    document.getElementById('vizZoomIn').addEventListener('click', () => vizView.zoomBy(0.85));
    document.getElementById('vizZoomOut').addEventListener('click', () => vizView.zoomBy(1.15));
    document.getElementById('vizResetView').addEventListener('click', () => vizView.resetView());

    document.getElementById('btnFindPath').addEventListener('click', runDijkstra);
    document.getElementById('btnPlay').addEventListener('click', togglePlay);
    document.getElementById('btnNext').addEventListener('click', () => stepTo(state.stepIndex + 1));
    document.getElementById('btnPrev').addEventListener('click', () => stepTo(state.stepIndex - 1));
    document.getElementById('btnRestart').addEventListener('click', () => { pausePlayback(); stepTo(0); });

    document.getElementById('speedSlider').addEventListener('input', (e) => {
      state.speedIndex = Number(e.target.value);
      const labels = ['0.5x', '1x', '2x', '5x'];
      document.getElementById('speedLabel').textContent = labels[state.speedIndex];
      if (state.playing) { pausePlayback(); startPlayback(); }
    });
  }

  function runDijkstra() {
    const source = Number(document.getElementById('sourceSelect').value);
    const dest = Number(document.getElementById('destSelect').value);
    if (Number.isNaN(source) || Number.isNaN(dest)) { toast('Add vertices to the graph first'); return; }

    const t0 = performance.now();
    const trace = Dijkstra.run(state.graph, source);
    const t1 = performance.now();

    state.trace = trace;
    state.lastRunSource = source;
    state.lastRunDest = dest;
    state.lastRunMs = t1 - t0;

    document.getElementById('resultPanel').style.display = 'none';
    pausePlayback();
    stepTo(0);
    buildCharts();
    toast('Running Dijkstra\'s algorithm…');
  }

  function resetTrace() {
    state.trace = null;
    state.stepIndex = -1;
    pausePlayback();
    if (vizView) {
      vizView.setGraph(state.graph);
      vizView.render();
    }
    document.getElementById('explanationBox').textContent = 'Press “Find Shortest Path” to begin the animated walkthrough.';
    document.getElementById('stepCounter').textContent = 'Step 0 / 0';
    document.getElementById('resultPanel').style.display = 'none';
    renderStatus(null);
    renderDistTable(null);
    clearCharts();
  }

  function clearCharts() {
    try { if (barChart) { barChart.destroy(); barChart = null; } } catch (e) { }
    try { if (lineChart) { lineChart.destroy(); lineChart = null; } } catch (e) { }
    try { if (pieChart) { pieChart.destroy(); pieChart = null; } } catch (e) { }
    const barEmpty = document.getElementById('barChartEmpty');
    const lineEmpty = document.getElementById('lineChartEmpty');
    const pieEmpty = document.getElementById('pieChartEmpty');
    if (barEmpty) barEmpty.style.display = '';
    if (lineEmpty) lineEmpty.style.display = '';
    if (pieEmpty) pieEmpty.style.display = '';
    const analysisBar = document.getElementById('analysisBar');
    const analysisLine = document.getElementById('analysisLine');
    const analysisPie = document.getElementById('analysisPie');
    if (analysisBar) analysisBar.innerHTML = '';
    if (analysisLine) analysisLine.innerHTML = '';
    if (analysisPie) analysisPie.innerHTML = '';
  }

  function currentHighlight() {
    if (!state.trace || state.stepIndex < 0) return {};
    const step = state.trace.steps[state.stepIndex];
    const highlight = {
      visited: step.visited || new Set(),
      current: step.current !== undefined ? step.current : null,
      source: state.lastRunSource,
      dest: state.lastRunDest,
    };
    if (step.type === 'check-edge' || step.type === 'skip-edge') highlight.activeEdge = step.edgeId;
    if (step.type === 'check-edge' && step.improved) highlight.goodEdge = step.edgeId;
    if (step.type === 'check-edge' && !step.improved) highlight.badEdge = step.edgeId;
    if (step.type === 'update-dist') highlight.goodEdge = step.edgeId;

    if (step.type === 'done') {
      const path = Dijkstra.buildPath(step.prev, state.lastRunSource, state.lastRunDest);
      highlight.pathEdges = Dijkstra.pathEdgeIds(state.graph, path);
    }
    return highlight;
  }

  function stepTo(index) {
    if (!state.trace) return;
    const clamped = Utils.clamp(index, 0, state.trace.steps.length - 1);
    state.stepIndex = clamped;
    const step = state.trace.steps[clamped];

    vizView.render(currentHighlight());
    document.getElementById('explanationBox').textContent = step.explanation;
    document.getElementById('stepCounter').textContent = `Step ${clamped + 1} / ${state.trace.steps.length}`;
    renderStatus(step);
    renderDistTable(step);
    renderPQ(step);
    renderVisited(step);

    if (step.type === 'done') {
      showResult();
      pausePlayback();
    }

    // Live statistics: refresh charts on every step (no-op if Statistics tab
    // isn't the active page — buildCharts() guards against that itself).
    buildCharts();
  }

  function renderStatus(step) {
    const typeLabels = {
      init: 'Initializing', 'extract-min': 'Extract Min', 'check-edge': 'Checking Edge',
      'update-dist': 'Updating Distance', 'skip-edge': 'Skipping Edge', 'vertex-done': 'Vertex Complete',
      done: 'Complete', unreachable: 'Unreachable',
    };
    document.getElementById('statStepType').textContent = step ? (typeLabels[step.type] || step.type) : '—';
    document.getElementById('statCurrent').textContent = step && step.current !== undefined && step.current !== null ? step.current : '—';
    document.getElementById('statCurrentDist').textContent = step && step.currentDist !== undefined ? Utils.fmtDist(step.currentDist) : '—';
    document.getElementById('statStatus').textContent = step ? (step.type === 'done' ? 'Finished' : 'Processing…') : 'Idle';
  }

  function renderPQ(step) {
    const host = document.getElementById('pqList');
    host.innerHTML = '';
    const pq = (step && step.pq) || [];
    if (!pq.length) {
      host.innerHTML = '<span class="pq-chip">empty</span>';
      return;
    }
    const sorted = [...pq].sort((a, b) => a.dist - b.dist);
    sorted.forEach((p, i) => {
      const chip = document.createElement('span');
      chip.className = 'pq-chip' + (i === 0 ? ' head' : '');
      chip.textContent = `(${p.id}, ${Utils.fmtDist(p.dist)})`;
      host.appendChild(chip);
    });
  }

  function renderVisited(step) {
    const host = document.getElementById('visitedList');
    host.innerHTML = '';
    const visited = (step && step.visited) || new Set();
    if (!visited.size) { host.innerHTML = '<span class="pq-chip">none yet</span>'; return; }
    [...visited].forEach((id) => {
      const chip = document.createElement('span');
      chip.className = 'visited-chip';
      chip.textContent = `Vertex ${id}`;
      host.appendChild(chip);
    });
  }

  function renderDistTable(step) {
    const tbody = document.getElementById('distTableBody');
    tbody.innerHTML = '';
    state.graph.vertices.forEach((v) => {
      const dist = step ? step.dist[v.id] : Utils.INF;
      const prev = step ? step.prev[v.id] : null;
      const visited = step ? step.visited.has(v.id) : false;
      const isCurrent = step && step.current === v.id;
      const updated = step && (step.type === 'update-dist') && step.neighbour === v.id;

      const tr = document.createElement('tr');
      if (isCurrent) tr.className = 'row-current';
      else if (visited) tr.className = 'row-visited';

      tr.innerHTML = `
        <td>${v.id}</td>
        <td class="dist-cell${updated ? ' updated' : ''}">${Utils.fmtDist(dist)}</td>
        <td>${prev === null || prev === undefined ? '—' : prev}</td>
        <td>${visited ? '✅' : '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function showResult() {
    const step = state.trace.steps[state.trace.steps.length - 1];
    const path = Dijkstra.buildPath(step.prev, state.lastRunSource, state.lastRunDest);
    const dist = step.dist[state.lastRunDest];

    // Visualizer Results
    document.getElementById('resultPanel').style.display = 'block';
    document.getElementById('resSource').textContent = state.lastRunSource;
    document.getElementById('resDest').textContent = state.lastRunDest;
    document.getElementById('resDist').textContent = Utils.fmtDist(dist);
    document.getElementById('resPath').textContent = path ? path.join(' → ') : 'No path found';
    document.getElementById('resVisited').textContent = [...step.visited].join(', ');
    document.getElementById('resTime').textContent = Utils.fmtMs(state.lastRunMs);

    // Statistics Page Results
    document.getElementById('statsResultPanel').style.display = 'block';
    document.getElementById('statsResSource').textContent = state.lastRunSource;
    document.getElementById('statsResDest').textContent = state.lastRunDest;
    document.getElementById('statsResDist').textContent = Utils.fmtDist(dist);
    document.getElementById('statsResPath').textContent = path ? path.join(' → ') : 'No path found';
    document.getElementById('statsResVisited').textContent = [...step.visited].join(', ');
    document.getElementById('statsResTime').textContent = Utils.fmtMs(state.lastRunMs);
  }

  function togglePlay() {
    if (state.playing) pausePlayback();
    else startPlayback();
  }

  function startPlayback() {
    if (!state.trace) { toast('Run “Find Shortest Path” first'); return; }
    if (state.stepIndex >= state.trace.steps.length - 1) state.stepIndex = -1;
    state.playing = true;
    document.getElementById('btnPlay').textContent = '⏸';
    const delay = state.speeds[state.speedIndex];
    state.playTimer = setInterval(() => {
      if (state.stepIndex >= state.trace.steps.length - 1) { pausePlayback(); return; }
      stepTo(state.stepIndex + 1);
    }, delay);
  }

  function pausePlayback() {
    state.playing = false;
    document.getElementById('btnPlay').textContent = '▶';
    if (state.playTimer) clearInterval(state.playTimer);
    state.playTimer = null;
  }

  // ---------------------------------------------------------------- Charts
  let barChart, lineChart, pieChart;
  function buildCharts() {
    if (!state.trace) return;

    // Fix: Chart.js fails aggressively and halts JS execution if we try
    // to instantiate it while its container has display: none.
    const statPage = document.getElementById('page-statistics');
    if (!statPage || !statPage.classList.contains('active')) {
      return;
    }

    const steps = state.trace.steps;
    // LIVE ANALYSIS: use progress up to the current step being viewed/played,
    // not always the final step, so charts animate along with the run.
    const upToIndex = state.stepIndex >= 0 ? state.stepIndex : steps.length - 1;
    const finalStep = steps[upToIndex];
    const isComplete = finalStep.type === 'done' || finalStep.type === 'unreachable';
    const vertexIds = state.graph.vertices.map((v) => v.id);

    const barData = vertexIds.map((id) => (finalStep.dist[id] === Utils.INF ? null : finalStep.dist[id]));

    const updateSteps = steps.slice(0, upToIndex + 1).filter((s) => s.type === 'update-dist');
    const lineLabels = updateSteps.map((_, i) => `Update ${i + 1}`);
    const lineSeries = {};
    vertexIds.forEach((id) => { lineSeries[id] = []; });
    let running = {};
    vertexIds.forEach((id) => { running[id] = id === state.lastRunSource ? 0 : null; });
    updateSteps.forEach((s) => {
      running[s.neighbour] = s.dist[s.neighbour];
      vertexIds.forEach((id) => lineSeries[id].push(running[id]));
    });

    const visitedCount = finalStep.visited.size;
    const unvisitedCount = vertexIds.length - visitedCount;

    const gridColor = 'rgba(148,163,184,0.15)';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-1').trim() || '#b7c2e0';
    const heading = getComputedStyle(document.documentElement).getPropertyValue('--text-0').trim() || '#f4f6ff';
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--bg-1').trim() || '#131a2e';
    const border = getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim() || '#8b5cf6';
    const palette = ['#8b5cf6', '#d946ef', '#a78bfa', '#34d399', '#fb7185', '#f59e0b', '#c084fc', '#f472b6'];

    // Shared dark-themed tooltip styling so all three charts match the glass UI
    const tooltipStyle = {
      enabled: true,
      backgroundColor: surface,
      titleColor: heading,
      bodyColor: textColor,
      borderColor: border,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
      displayColors: true,
      titleFont: { weight: '600' },
    };
    // Shared smooth animation config
    const animationStyle = { duration: 400, easing: 'easeOutQuad' };

    try { if (barChart) barChart.destroy(); } catch (e) { }
    document.getElementById('barChartEmpty').style.display = 'none';
    try {
      barChart = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
          labels: vertexIds.map((id) => `V${id}`),
          datasets: [{
            label: 'Shortest Distance',
            data: barData,
            backgroundColor: vertexIds.map((_, i) => palette[i % palette.length]),
            borderRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: animationStyle,
          plugins: { legend: { display: false }, tooltip: tooltipStyle },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true },
          },
        },
      });
    } catch (e) { console.error(e); }

    try { if (lineChart) lineChart.destroy(); } catch (e) { }
    document.getElementById('lineChartEmpty').style.display = 'none';
    try {
      lineChart = new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: {
          labels: lineLabels.length ? lineLabels : ['Start'],
          datasets: vertexIds.map((id, i) => ({
            label: `Vertex ${id}`,
            data: lineSeries[id].length ? lineSeries[id] : [running[id]],
            borderColor: palette[i % palette.length],
            backgroundColor: 'transparent',
            tension: 0.35,
            pointRadius: 2,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: animationStyle,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: textColor, boxWidth: 12 } },
            tooltip: tooltipStyle,
          },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } },
          },
        },
      });
    } catch (e) { console.error(e); }

    try { if (pieChart) pieChart.destroy(); } catch (e) { }
    document.getElementById('pieChartEmpty').style.display = 'none';
    try {
      pieChart = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
          labels: ['Visited', 'Unvisited'],
          datasets: [{
            data: [visitedCount, unvisitedCount],
            backgroundColor: ['#34d399', '#4b5b7c'],
            borderWidth: 0,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          animation: animationStyle,
          plugins: {
            legend: { labels: { color: textColor } },
            tooltip: tooltipStyle,
          },
        },
      });
    } catch (e) { console.error(e); }

    // --- Dynamic Analysis Texts ---

    // 1. Bar Chart Analysis (Furthest node)
    const barAnalysis = document.getElementById('analysisBar');
    const reachableNodes = vertexIds.filter(id => finalStep.dist[id] !== Utils.INF && id !== state.lastRunSource);

    let maxDist = -1;
    let maxDistNode = null;
    let minDist = Infinity;
    let minDistNode = null;
    let sumDist = 0;

    reachableNodes.forEach(id => {
      const d = finalStep.dist[id];
      sumDist += d;
      if (d > maxDist) { maxDist = d; maxDistNode = id; }
      if (d < minDist) { minDist = d; minDistNode = id; }
    });

    barAnalysis.style.display = 'block';
    if (reachableNodes.length > 0) {
      const avgDist = (sumDist / reachableNodes.length).toFixed(1);
      barAnalysis.innerHTML = `
        <div style="margin-bottom:8px; font-weight: 600; color: var(--text-0);">💡 Distance Insight:</div>
        <ul style="margin:0; padding-left:22px; color:var(--text-2); display:flex; flex-direction:column; gap:6px;">
          <li><b>Furthest Node:</b> Node <b style="color:var(--text-0)">${maxDistNode}</b> (Distance: ${Utils.fmtDist(maxDist)})</li>
          <li><b>Closest Node:</b> Node <b style="color:var(--text-0)">${minDistNode}</b> (Distance: ${Utils.fmtDist(minDist)})</li>
          <li><b>Average Distance:</b> <b style="color:var(--text-0)">${avgDist}</b> across all ${reachableNodes.length} reachable nodes.</li>
        </ul>
      `;
    } else {
      barAnalysis.innerHTML = `<div style="margin-bottom:8px; font-weight: 600; color: var(--text-0);">💡 Distance Insight:</div><div style="color:var(--text-2);">No other nodes were reachable from the source vertex.</div>`;
    }

    // 2. Line Chart Analysis (Most updates)
    const lineAnalysis = document.getElementById('analysisLine');
    const updateCounts = {};
    vertexIds.forEach(id => updateCounts[id] = 0);
    updateSteps.forEach(s => updateCounts[s.neighbour]++);

    let maxUpdates = 0;
    let maxUpdatesNode = null;
    let totalUpdates = updateSteps.length;

    vertexIds.forEach(id => {
      if (updateCounts[id] > maxUpdates) {
        maxUpdates = updateCounts[id];
        maxUpdatesNode = id;
      }
    });

    lineAnalysis.style.display = 'block';
    if (totalUpdates > 0) {
      lineAnalysis.innerHTML = `
        <div style="margin-bottom:8px; font-weight: 600; color: var(--text-0);">💡 Relaxation Insight:</div>
        <ul style="margin:0; padding-left:22px; color:var(--text-2); display:flex; flex-direction:column; gap:6px;">
          <li><b>Total Updates:</b> <b style="color:var(--text-0)">${totalUpdates}</b> tentative distance improvements across the network.</li>
          <li><b>Highest Volatility:</b> Node <b style="color:var(--text-0)">${maxUpdatesNode}</b> was updated the most (<b style="color:var(--text-0)">${maxUpdates}</b> times).</li>
        </ul>
      `;
    } else {
      lineAnalysis.innerHTML = `<div style="margin-bottom:8px; font-weight: 600; color: var(--text-0);">💡 Relaxation Insight:</div><div style="color:var(--text-2);">No distance relaxations occurred. A shorter path was never found once a node was discovered.</div>`;
    }

    // 3. Pie Chart Analysis (Reachability)
    const pieAnalysis = document.getElementById('analysisPie');
    pieAnalysis.style.display = 'block';

    const visitPercentage = Math.round((visitedCount / vertexIds.length) * 100);

    if (unvisitedCount === 0) {
      pieAnalysis.innerHTML = `
        <div style="margin-bottom:8px; font-weight: 600; color: var(--text-0);">💡 Network Reachability:</div>
        <ul style="margin:0; padding-left:22px; color:var(--text-2); display:flex; flex-direction:column; gap:6px;">
          <li><b>Coverage:</b> <b style="color:var(--success)">100%</b> of the network (${visitedCount}/${vertexIds.length} nodes) successfully explored.</li>
          <li><b>Status:</b> The graph is fully connected relative to the selected source (Node ${state.lastRunSource}).</li>
        </ul>
      `;
    } else {
      pieAnalysis.innerHTML = `
        <div style="margin-bottom:8px; font-weight: 600; color: var(--text-0);">💡 Network Reachability:</div>
        <ul style="margin:0; padding-left:22px; color:var(--text-2); display:flex; flex-direction:column; gap:6px;">
          <li><b>Coverage:</b> Only <b style="color:var(--text-0)">${visitPercentage}%</b> explored (${visitedCount}/${vertexIds.length} nodes).</li>
          <li><b>Isolated Nodes:</b> <b style="color:var(--danger)">${unvisitedCount}</b> node(s) remained unreachable, indicating a disconnected component.</li>
        </ul>
      `;
    }
  }

  // ---------------------------------------------------------------- Init
  function init() {
    initNav();
    initTheme();
    initParticles();
    initBuilder();
    initVisualizer();
    syncEverything();
    renderHeroGraph();
    resetTrace();

    // Auto-run Dijkstra to pre-populate charts and visualizer
    // Defaulting source to vertex 0 (usually the first) 
    // and destination to the last vertex. 
    setTimeout(() => {
      const sourceSelect = document.getElementById('sourceSelect');
      if (sourceSelect.options.length > 0) {
        sourceSelect.selectedIndex = 0;
      }
      runDijkstra();
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', init);
})();