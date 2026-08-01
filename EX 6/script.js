/* ============================================================
   AI MATRIX OPTIMIZER — script.js
   Application controller: owns state, drives step playback,
   wires the UI, and syncs every panel to the current step.
   ============================================================ */

(() => {
  const { $, $$, el, fmtNumber, fmtTime, parseDims, generateRandomDims, animateCount, clamp } = Utils;

  const state = {
    dims: [],
    result: null,
    steps: [],
    cursor: -1,
    playing: false,
    speed: 1,
    timer: null,
    startTime: null,
    matricesCombined: 0,
    opsCompleted: 0
  };

  const SPEED_BASE_MS = 550;

  /* ---------------------------------------------------------
     BOOTSTRAP
  --------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initBackgroundFX();
    initNav();
    ChartsModule.initCharts();
    bindInputPanel();
    bindControlPanel();
    Visualizer.renderPlaceholderModules(5);
    Visualizer.initDPTable(5);
    $('#step-explanation').innerHTML = defaultStepHTML();
    $('#year').textContent = new Date().getFullYear();
  });

  /* ---------------------------------------------------------
     BACKGROUND / NAV
  --------------------------------------------------------- */
  function initBackgroundFX() {
    $$('.ember-field').forEach(f => Visualizer.spawnEmbers(f, 22));
  }

  function initNav() {
    const links = $$('.nav-link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const target = link.getAttribute('href');
        if (target && target.startsWith('#')) {
          e.preventDefault();
          document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
    const burger = $('#nav-burger');
    burger && burger.addEventListener('click', () => $('#nav-menu').classList.toggle('open'));

    $('#hero-start')?.addEventListener('click', () => {
      document.querySelector('#input')?.scrollIntoView({ behavior: 'smooth' });
    });
    $('#hero-learn')?.addEventListener('click', () => {
      document.querySelector('#complexity')?.scrollIntoView({ behavior: 'smooth' });
    });

    const spy = () => {
      const sections = $$('main section[id]');
      let current = sections[0]?.id;
      const y = window.scrollY + 140;
      sections.forEach(s => { if (s.offsetTop <= y) current = s.id; });
      links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${current}`));
    };
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  /* ---------------------------------------------------------
     INPUT PANEL
  --------------------------------------------------------- */
  function bindInputPanel() {
    const input = $('#dims-input');

    $('#btn-load-sample').addEventListener('click', () => {
      const samples = [
        [10, 30, 5, 60, 10],
        [40, 20, 30, 10, 30],
        [5, 10, 3, 12, 5, 50, 6]
      ];
      const pick = samples[Math.floor(Math.random() * samples.length)];
      input.value = pick.join(',');
      loadDims(pick, { autoStart: false });
    });

    $('#btn-random').addEventListener('click', () => {
      const count = Utils.randInt(4, 7);
      const arr = generateRandomDims(count + 1, 5, 90);
      input.value = arr.join(',');
      loadDims(arr, { autoStart: false });
    });

    $('#btn-reset').addEventListener('click', () => {
      input.value = '10,30,5,60,10';
      loadDims([10, 30, 5, 60, 10], { autoStart: false });
    });

    $('#btn-apply').addEventListener('click', () => applyInput());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyInput(); });

    function applyInput() {
      const dims = parseDims(input.value);
      if (dims.length < 3) {
        Visualizer.logMessage('Input rejected: need at least 2 matrices (3 dimensions).', 'warn');
        shake($('#dims-input-wrap'));
        return;
      }
      loadDims(dims, { autoStart: false });
      $('#btn-launch')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function shake(node) {
    if (!node) return;
    node.classList.add('shake');
    setTimeout(() => node.classList.remove('shake'), 500);
  }

  /* ---------------------------------------------------------
     LOAD DIMENSIONS -> COMPUTE DP -> RESET UI
  --------------------------------------------------------- */
  function loadDims(dims, { autoStart }) {
    stopPlayback();
    state.dims = dims;
    state.result = DPEngine.solve(dims);
    state.steps = state.result.steps;
    state.cursor = -1;
    state.matricesCombined = 0;
    state.opsCompleted = 0;

    Visualizer.renderModules(dims);
    Visualizer.initDPTable(state.result.n);
    Visualizer.clearLog();
    Visualizer.logMessage('System initialized.', 'system');
    Visualizer.logMessage(`Loading ${state.result.n} energy modules.`, 'system');

    ChartsModule.renderFullAnalysis(state.result);

    resetLivePanel();
    resetDashboard();
    renderInstantAnalysis();
    $('#tree-container').innerHTML = '<div class="tree-placeholder">Run the optimization to grow the parenthesization tree.</div>';
    $('#step-explanation').innerHTML = defaultStepHTML();

    if (autoStart) playFromStart();
  }

  function renderInstantAnalysis() {
    const n = state.result.n;
    const cost = state.result.optimalCost;
    const order = DPEngine.parenString(state.result.optimalOrder);
    const memory = n * n * 8;
    const efficiency = clamp(100 - (cost / (n * n * n * 50)) * 100, 40, 99);

    $('#dash-min-cost').textContent = fmtNumber(cost);
    $('#dash-order').textContent = order;
    $('#dash-time').textContent = 'Instant';
    $('#dash-efficiency').textContent = `${efficiency.toFixed(1)}%`;
    $('#dash-memory').textContent = `${(memory / 1024).toFixed(2)} KB`;
    $('#dash-matrices').textContent = n;
  }

  function defaultStepHTML() {
    return `<div class="step-line step-idle">AI standing by. Press <strong>Launch</strong> to begin optimization.</div>`;
  }

  /* ---------------------------------------------------------
     CONTROL PANEL
  --------------------------------------------------------- */
  function bindControlPanel() {
    $('#btn-launch').addEventListener('click', () => {
      if (!state.result) {
        Visualizer.logMessage('No data loaded. Enter dimensions and press Apply first.', 'warn');
        shake($('#dims-input-wrap'));
        return;
      }
      if (state.cursor >= state.steps.length - 1) playFromStart();
      else resume();
    });
    $('#btn-pause').addEventListener('click', pause);
    $('#btn-next').addEventListener('click', () => { pause(); stepForward(); });
    $('#btn-prev').addEventListener('click', () => { pause(); stepBackward(); });
    $('#btn-restart').addEventListener('click', () => playFromStart());
    $('#btn-autoplay').addEventListener('click', () => {
      if (state.playing) pause(); else resume();
    });

    const speedSlider = $('#speed-slider');
    speedSlider.addEventListener('input', () => {
      state.speed = Number(speedSlider.value);
      $('#speed-value').textContent = `${state.speed.toFixed(1)}\u00d7`;
      if (state.playing) { pause(); resume(); }
    });
  }

  function playFromStart() {
    if (!state.result) return;
    Visualizer.initDPTable(state.result.n);
    Visualizer.clearLog();
    Visualizer.logMessage('System initialized.', 'system');
    Visualizer.logMessage(`Loading ${state.result.n} energy modules.`, 'system');
    ChartsModule.resetCharts();
    resetLivePanel();
    resetDashboard();
    state.cursor = -1;
    state.startTime = performance.now();
    state.matricesCombined = 0;
    state.opsCompleted = 0;
    $('#tree-container').innerHTML = '<div class="tree-placeholder">Growing tree as fusions complete\u2026</div>';
    resume();
  }

  function resume() {
    if (state.steps.length === 0) return;
    state.playing = true;
    setPlayButtonState(true);
    tick();
  }

  function pause() {
    state.playing = false;
    clearTimeout(state.timer);
    setPlayButtonState(false);
  }

  function stopPlayback() {
    pause();
    state.cursor = -1;
  }

  function setPlayButtonState(playing) {
    $('#btn-launch').classList.toggle('active', playing);
    $('#btn-autoplay').classList.toggle('active', playing);
    document.body.classList.toggle('is-running', playing);
  }

  function tick() {
    if (!state.playing) return;
    if (state.cursor >= state.steps.length - 1) { pause(); return; }
    stepForward();
    const delay = clamp(SPEED_BASE_MS / state.speed, 60, 2000);
    state.timer = setTimeout(tick, delay);
  }

  function stepForward() {
    if (state.cursor >= state.steps.length - 1) return;
    state.cursor++;
    applyStep(state.steps[state.cursor], 'forward');
    updateProgress();
  }

  function stepBackward() {
    if (state.cursor <= 0) { state.cursor = -1; return; }
    // Replay from scratch up to cursor-1 (simplest reliable approach for a DP replay)
    const target = state.cursor - 1;
    Visualizer.initDPTable(state.result.n);
    Visualizer.clearLog();
    ChartsModule.resetCharts();
    resetLivePanel();
    state.cursor = -1;
    state.matricesCombined = 0;
    state.opsCompleted = 0;
    for (let i = 0; i <= target; i++) {
      state.cursor = i;
      applyStep(state.steps[i], 'replay');
    }
    updateProgress();
  }

  /* ---------------------------------------------------------
     APPLY A SINGLE STEP TO ALL PANELS
  --------------------------------------------------------- */
  function applyStep(step, mode) {
    const explain = $('#step-explanation');
    const live = $('#live-panel');

    switch (step.type) {
      case 'init':
        setLiveField('stage', 'Initializing');
        pushStepLine(explain, step.message, 'system');
        break;

      case 'chain-start':
        setLiveField('stage', `Chain Length ${step.len}`);
        setLiveField('chainLength', step.len);
        pushStepLine(explain, step.message, 'stage');
        break;

      case 'cell-start':
        setLiveField('currentCell', `A${step.i}..A${step.j}`);
        Visualizer.markProcessing(step.i, step.j);
        Visualizer.pulseModule(step.i);
        Visualizer.pulseModule(step.j);
        pushStepLine(explain, step.message, 'analyze');
        break;

      case 'split-eval':
        setLiveField('currentSplit', `k = ${step.k}`);
        setLiveField('currentCost', fmtNumber(step.cost));
        if (mode !== 'replay') {
          ChartsModule.pushSplitEval(step);
          if (step.accepted) Visualizer.fuseModules(step.i, step.k);
        } else {
          ChartsModule.pushSplitEval(step);
        }
        if (step.accepted) {
          setLiveField('minCost', fmtNumber(step.cost));
          state.opsCompleted++;
        }
        pushStepLine(explain, step.message, step.accepted ? 'accept' : 'reject');
        Visualizer.logMessage(step.message, step.accepted ? 'success' : 'warn');
        break;

      case 'cell-done':
        Visualizer.markResult(step.i, step.j, step.cost, true);
        Visualizer.finalizeCell(step.i, step.j, step.cost);
        ChartsModule.pushMinimum(`A${step.i}${step.j}`, step.cost);
        state.matricesCombined++;
        setLiveField('matricesCombined', state.matricesCombined);
        pushStepLine(explain, step.message, 'complete');
        Visualizer.logMessage(step.message, 'success');
        break;

      case 'done':
        pushStepLine(explain, step.message, 'done');
        Visualizer.logMessage(step.message, 'system');
        finishRun();
        break;
    }

    if (step.type !== 'split-eval' && step.type !== 'cell-done') {
      // avoid double logging (those two log inside their case already)
      if (step.type === 'chain-start' || step.type === 'cell-start' || step.type === 'init') {
        Visualizer.logMessage(step.message, step.type === 'init' ? 'system' : 'info');
      }
    }
  }

  function pushStepLine(container, msg, cls) {
    const line = el('div', { class: `step-line step-${cls}` }, msg);
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
    while (container.children.length > 60) container.removeChild(container.firstChild);
  }

  function setLiveField(key, value) {
    const node = document.getElementById(`live-${key}`);
    if (node) node.textContent = value;
    const railNode = document.getElementById(`dpstat-${key}`);
    if (railNode) railNode.textContent = value;
  }

  function resetLivePanel() {
    ['stage', 'chainLength', 'currentCell', 'currentSplit', 'currentCost', 'minCost', 'matricesCombined']
      .forEach(k => setLiveField(k, k === 'stage' ? 'Standby' : '\u2014'));
    setLiveField('opsCompleted', 0);
  }

  /* ---------------------------------------------------------
     PROGRESS / DASHBOARD / TREE
  --------------------------------------------------------- */
  function updateProgress() {
    const pct = state.steps.length ? Math.round(((state.cursor + 1) / state.steps.length) * 100) : 0;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-label').textContent = `${pct}% \u2022 step ${state.cursor + 1} / ${state.steps.length}`;
    setLiveField('opsCompleted', state.opsCompleted);
  }

  function resetDashboard() {
    $('#dash-min-cost').textContent = '\u2014';
    $('#dash-order').textContent = '\u2014';
    $('#dash-time').textContent = '\u2014';
    $('#dash-efficiency').textContent = '\u2014';
    $('#dash-memory').textContent = '\u2014';
    $('#dash-matrices').textContent = state.result ? state.result.n : '\u2014';
    $('#progress-fill').style.width = '0%';
    $('#progress-label').textContent = `0% \u2022 step 0 / ${state.steps.length}`;
  }

  function finishRun() {
    const elapsed = performance.now() - state.startTime;
    const n = state.result.n;
    const cost = state.result.optimalCost;
    const order = DPEngine.parenString(state.result.optimalOrder);
    const memory = n * n * 8; // rough bytes estimate for m/s tables

    animateCount($('#dash-min-cost'), 0, cost, 700);
    $('#dash-order').textContent = order;
    $('#dash-time').textContent = fmtTime(elapsed);
    const efficiency = clamp(100 - (cost / (n * n * n * 50)) * 100, 40, 99);
    $('#dash-efficiency').textContent = `${efficiency.toFixed(1)}%`;
    $('#dash-memory').textContent = `${(memory / 1024).toFixed(2)} KB`;
    $('#dash-matrices').textContent = n;

    Visualizer.renderTree(state.result.optimalOrder, $('#tree-container'));
    ChartsModule.setRadarProfile([
      clamp(60 + state.speed * 8, 0, 100),
      92,
      efficiency,
      clamp(100 - memory / 200, 20, 100),
      clamp(100 - (cost / 5000), 10, 100),
      88
    ]);

    document.body.classList.remove('is-running');
    setPlayButtonState(false);
    document.querySelector('#performance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

})();
