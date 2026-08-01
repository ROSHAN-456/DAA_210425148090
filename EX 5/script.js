'use strict';

/* ==========================================================================
   MISSION MIN-MAX — Application Logic
   ========================================================================== */

/* ---------------------------- Starfield BG ---------------------------- */
(function starfield(){
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let w, h, stars = [], shootingStars = [];

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function initStars(){
    stars = [];
    const count = Math.floor((w * h) / 9000);
    for(let i = 0; i < count; i++){
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005
      });
    }
  }
  initStars();
  window.addEventListener('resize', initStars);

  function maybeSpawnShootingStar(){
    if(Math.random() < 0.004){
      shootingStars.push({
        x: Math.random() * w * 0.6,
        y: Math.random() * h * 0.3,
        len: 80 + Math.random() * 60,
        speed: 8 + Math.random() * 6,
        life: 1
      });
    }
  }

  function tick(){
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(248,250,252,0.9)';
    for(const s of stars){
      s.tw += s.speed;
      const alpha = 0.4 + Math.sin(s.tw) * 0.4;
      ctx.globalAlpha = Math.max(0.1, alpha);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    maybeSpawnShootingStar();
    ctx.strokeStyle = 'rgba(250,204,21,0.8)';
    ctx.lineWidth = 1.5;
    shootingStars.forEach(s => {
      ctx.globalAlpha = s.life;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len, s.y - s.len * 0.4);
      ctx.stroke();
      s.x += s.speed;
      s.y += s.speed * 0.4;
      s.life -= 0.02;
    });
    ctx.globalAlpha = 1;
    shootingStars = shootingStars.filter(s => s.life > 0);

    requestAnimationFrame(tick);
  }
  tick();
})();

/* ---------------------------- Landing -> App ---------------------------- */
document.getElementById('startMissionBtn').addEventListener('click', () => {
  document.getElementById('landing').style.opacity = '0';
  document.getElementById('landing').style.pointerEvents = 'none';
  setTimeout(() => {
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }, 400);
});

/* ---------------------------- View Navigation ---------------------------- */
const navButtons = document.querySelectorAll('.nav-btn');
const mainLayout = document.querySelector('.layout');
const timelinePanel = document.querySelector('.timeline-panel');
const performancePanel = document.getElementById('performancePanel');
const briefPanel = document.getElementById('briefPanel');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    mainLayout.classList.toggle('hidden', view !== 'console');
    timelinePanel.classList.toggle('hidden', view !== 'console');
    performancePanel.classList.toggle('hidden', view !== 'performance');
    briefPanel.classList.toggle('hidden', view !== 'brief');
    if(view === 'performance' && typeof liveChart !== 'undefined' && liveChart){
      requestAnimationFrame(() => liveChart.resize());
    }
  });
});

/* ============================================================
   ALGORITHM ENGINES
   ============================================================ */

function buildDCTrace(array){
  let nodeId = 0;
  const nodes = {};
  const events = [];
  let totalComparisons = 0;

  function solve(lo, hi, depth, parent){
    const id = nodeId++;
    nodes[id] = { id, parent, lo, hi, depth, min: null, max: null, leftId: null, rightId: null };
    events.push({ type: 'enter', id, lo, hi, depth });

    if(lo === hi){
      const v = array[lo];
      nodes[id].min = v; nodes[id].max = v;
      events.push({ type: 'base', id, lo, hi, depth, min: v, max: v, comparisons: 0, pair: false });
      return { id, min: v, max: v };
    }
    if(hi - lo === 1){
      totalComparisons += 1;
      const a = array[lo], b = array[hi];
      const min = Math.min(a, b), max = Math.max(a, b);
      nodes[id].min = min; nodes[id].max = max;
      events.push({ type: 'base', id, lo, hi, depth, min, max, comparisons: 1, pair: true });
      return { id, min, max };
    }
    const mid = Math.floor((lo + hi) / 2);
    const left = solve(lo, mid, depth + 1, id);
    const right = solve(mid + 1, hi, depth + 1, id);
    totalComparisons += 2;
    const min = Math.min(left.min, right.min);
    const max = Math.max(left.max, right.max);
    nodes[id].min = min; nodes[id].max = max;
    nodes[id].leftId = left.id; nodes[id].rightId = right.id;
    events.push({ type: 'merge', id, lo, hi, depth, leftId: left.id, rightId: right.id, min, max, comparisons: 2 });
    return { id, min, max };
  }

  const root = solve(0, array.length - 1, 0, null);

  let running = 0;
  const cumulative = events.map(e => {
    if(e.comparisons) running += e.comparisons;
    return running;
  });

  return { nodes, events, cumulative, rootId: root.id, totalComparisons };
}

function buildNaiveTrace(array){
  const events = [];
  let min = array[0], max = array[0], minIndex = 0, maxIndex = 0, comparisons = 0;
  events.push({ type: 'init', index: 0, value: array[0], min, max, minIndex, maxIndex, comparisons });

  for(let i = 1; i < array.length; i++){
    const v = array[i];
    comparisons++;
    if(v < min){
      min = v; minIndex = i;
      events.push({ type: 'compare', index: i, value: v, result: 'newMin', min, max, minIndex, maxIndex, comparisons });
    } else {
      comparisons++;
      if(v > max){
        max = v; maxIndex = i;
        events.push({ type: 'compare', index: i, value: v, result: 'newMax', min, max, minIndex, maxIndex, comparisons });
      } else {
        events.push({ type: 'compare', index: i, value: v, result: 'none', min, max, minIndex, maxIndex, comparisons });
      }
    }
  }
  return { events, min, max, comparisons };
}

/* ============================================================
   TREE LAYOUT + RENDER
   ============================================================ */

const treeSvg = document.getElementById('treeSvg');
let currentLayout = null;

function layoutTree(nodes, rootId){
  let leafCursor = 0;
  const order = {};
  function assignX(id){
    const n = nodes[id];
    if(n.leftId == null){
      order[id] = leafCursor++;
      return order[id];
    }
    const lx = assignX(n.leftId);
    const rx = assignX(n.rightId);
    order[id] = (lx + rx) / 2;
    return order[id];
  }
  assignX(rootId);
  const totalLeaves = leafCursor;
  const maxDepth = Math.max(...Object.values(nodes).map(n => n.depth));

  const W = 1000, H = 420, marginX = 50, marginY = 40;
  const positions = {};
  Object.values(nodes).forEach(n => {
    const px = totalLeaves <= 1 ? W / 2 : marginX + (order[n.id] / (totalLeaves - 1)) * (W - 2 * marginX);
    const py = maxDepth === 0 ? H / 2 : marginY + (n.depth / maxDepth) * (H - 2 * marginY - 20);
    positions[n.id] = { x: px, y: py };
  });
  return { positions, totalLeaves, maxDepth };
}

function renderTreeStatic(nodes, rootId){
  const layout = layoutTree(nodes, rootId);
  currentLayout = layout;
  const { positions } = layout;

  let svg = '';
  // edges first (so nodes draw on top)
  Object.values(nodes).forEach(n => {
    if(n.parent != null){
      const p = positions[n.parent], c = positions[n.id];
      svg += `<path id="edge-${n.id}" class="tree-edge" d="M${p.x},${p.y + 18} C${p.x},${(p.y + c.y) / 2} ${c.x},${(p.y + c.y) / 2} ${c.x},${c.y - 18}"/>`;
    }
  });
  Object.values(nodes).forEach(n => {
    const pos = positions[n.id];
    svg += `<g id="node-${n.id}" class="tree-node">
      <circle class="tree-node-circle" cx="${pos.x}" cy="${pos.y}" r="20"></circle>
      <text class="tree-node-range" x="${pos.x}" y="${pos.y + 4}">${n.lo === n.hi ? `#${n.lo}` : `${n.lo}-${n.hi}`}</text>
      <text class="tree-node-label" x="${pos.x}" y="${pos.y + 32}" id="node-label-${n.id}"></text>
    </g>`;
  });
  treeSvg.innerHTML = svg;
}

function markTreeNode(id, status){
  const el = document.getElementById(`node-${id}`);
  if(!el) return;
  if(status === 'active'){ el.classList.add('active'); }
  if(status === 'done'){ el.classList.remove('active'); el.classList.add('done'); }
}
function markTreeEdgeLit(id){
  const edge = document.getElementById(`edge-${id}`);
  if(edge) edge.classList.add('lit');
}
function setNodeLabel(id, text){
  const el = document.getElementById(`node-label-${id}`);
  if(el) el.textContent = text;
}
function resetTreeVisual(nodes){
  Object.values(nodes).forEach(n => {
    const el = document.getElementById(`node-${n.id}`);
    if(el) el.classList.remove('active', 'done');
    setNodeLabel(n.id, '');
    const edge = document.getElementById(`edge-${n.id}`);
    if(edge) edge.classList.remove('lit');
  });
}

/* ============================================================
   ARRAY / CAPSULE RENDER
   ============================================================ */

const arrayDisplay = document.getElementById('arrayDisplay');
const arrayDisplayB = document.getElementById('arrayDisplayB');
const deckAlgoLabel = document.getElementById('deckAlgoLabel');
const deckArrayLabel = document.getElementById('deckArrayLabel');

function renderCapsules(container, array){
  container.innerHTML = '';
  array.forEach((v, i) => {
    const span = document.createElement('span');
    span.className = 'capsule';
    span.dataset.index = i;
    span.textContent = v;
    container.appendChild(span);
  });
}

function resetCapsules(container){
  container.querySelectorAll('.capsule').forEach(c => {
    c.classList.remove('dim', 'active-segment', 'is-min', 'is-max', 'compared');
  });
}

function highlightSegment(container, lo, hi){
  container.querySelectorAll('.capsule').forEach(c => {
    const i = Number(c.dataset.index);
    c.classList.toggle('dim', i < lo || i > hi);
    c.classList.toggle('active-segment', i >= lo && i <= hi);
  });
}

function markExtremaInSegment(container, lo, hi, min, max){
  let minMarked = false, maxMarked = false;
  container.querySelectorAll('.capsule').forEach(c => {
    const i = Number(c.dataset.index);
    if(i < lo || i > hi) return;
    const v = Number(c.textContent);
    c.classList.remove('is-min', 'is-max');
    if(!minMarked && v === min){ c.classList.add('is-min'); minMarked = true; }
    if(!maxMarked && v === max){ c.classList.add('is-max'); maxMarked = true; }
  });
}

function pulseCapsule(container, index){
  const el = container.querySelector(`.capsule[data-index="${index}"]`);
  if(!el) return;
  el.classList.remove('compared');
  void el.offsetWidth;
  el.classList.add('compared');
}

/* ============================================================
   MISSION LOG
   ============================================================ */

const missionLog = document.getElementById('missionLog');
function logLine(tag, text){
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="tag">[${tag}]</span>${text}`;
  missionLog.appendChild(div);
  missionLog.scrollTop = missionLog.scrollHeight;
  while(missionLog.children.length > 200){ missionLog.removeChild(missionLog.firstChild); }
}
function clearLog(){ missionLog.innerHTML = ''; }

/* ============================================================
   STATUS PANEL
   ============================================================ */

const statMission = document.getElementById('statMission');
const statDepth = document.getElementById('statDepth');
const statProcessed = document.getElementById('statProcessed');
const statRemaining = document.getElementById('statRemaining');
const statMin = document.getElementById('statMin');
const statMax = document.getElementById('statMax');
const statComparisons = document.getElementById('statComparisons');
const meterFill = document.getElementById('meterFill');
const progressFill = document.getElementById('progressFill');

function updateStatus({ mission, depth, processed, remaining, min, max, comparisons, maxComparisons, progress }){
  if(mission != null) statMission.textContent = mission;
  if(depth != null) statDepth.textContent = depth;
  if(processed != null) statProcessed.textContent = processed;
  if(remaining != null) statRemaining.textContent = remaining;
  if(min != null) statMin.textContent = min;
  if(max != null) statMax.textContent = max;
  if(comparisons != null){
    statComparisons.textContent = comparisons;
    const pct = maxComparisons ? Math.min(100, (comparisons / maxComparisons) * 100) : 0;
    meterFill.style.width = pct + '%';
  }
  if(progress != null) progressFill.style.width = Math.min(100, progress) + '%';
}

/* ============================================================
   LIVE COMPARISON CHART
   ============================================================ */

let liveChart;
const liveChartStatus = document.getElementById('liveChartStatus');

function initLiveChart(){
  liveChart = new Chart(document.getElementById('liveChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'D&C Comparisons', data: [], borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.15)', tension: 0.3, fill: true, pointRadius: 2, spanGaps: true },
        { label: 'Naive Comparisons', data: [], borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.15)', tension: 0.3, fill: true, pointRadius: 2, spanGaps: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: { legend: { labels: { color: '#F8FAFC' } } },
      scales: {
        x: { ticks: { color: '#F8FAFC', maxTicksLimit: 10 }, grid: { color: 'rgba(248,250,252,0.08)' }, title: { display: true, text: 'Mission Step', color: '#B8CFC2' } },
        y: { beginAtZero: true, ticks: { color: '#F8FAFC' }, grid: { color: 'rgba(248,250,252,0.08)' }, title: { display: true, text: 'Comparisons', color: '#B8CFC2' } }
      }
    }
  });
}

function resetLiveChart(){
  if(!liveChart) return;
  liveChart.data.labels = [];
  liveChart.data.datasets[0].data = [];
  liveChart.data.datasets[1].data = [];
  liveChart.data.datasets[0].hidden = state.algo === 'naive';
  liveChart.data.datasets[1].hidden = state.algo === 'dc';
  liveChart.update('none');
  if(liveChartStatus){
    liveChartStatus.textContent = 'awaiting mission data';
    liveChartStatus.classList.remove('is-live');
  }
}

function pushLiveChartPoint(step, dcVal, naiveVal){
  if(!liveChart) return;
  liveChart.data.labels.push(step);
  liveChart.data.datasets[0].data.push(dcVal);
  liveChart.data.datasets[1].data.push(naiveVal);
  liveChart.update('none');
  if(liveChartStatus){
    liveChartStatus.textContent = 'live · updating with each step';
    liveChartStatus.classList.add('is-live');
  }
}

/* ============================================================
   MISSION STATE + PLAYER
   ============================================================ */

const state = {
  array: [],
  algo: 'dc',
  dc: null,
  naive: null,
  stepIndex: -1,
  totalSteps: 0,
  playing: false,
  timer: null,
  speed: 1,
  startedAt: null
};

function loadArray(array){
  if(!array || array.length === 0) return;
  state.array = array;
  state.dc = buildDCTrace(array);
  state.naive = buildNaiveTrace(array);
  state.stepIndex = -1;

  deckArrayLabel.textContent = `${array.length} packets loaded`;
  document.getElementById('finalReport').classList.add('hidden');
  clearLog();
  logLine('SYS', `Payload of ${array.length} packets received by Mother Station.`);

  arrayDisplay.classList.remove('hidden');
  arrayDisplayB.classList.add('hidden');
  renderCapsules(arrayDisplay, array);

  if(state.algo === 'dc' || state.algo === 'compare'){
    renderTreeStatic(state.dc.nodes, state.dc.rootId);
    document.querySelector('.tree-wrap').classList.remove('hidden');
  }

  if(state.algo === 'compare'){
    arrayDisplayB.classList.remove('hidden');
    renderCapsules(arrayDisplayB, array);
  }

  computeTotalSteps();
  resetLiveChart();
  updateStatus({
    mission: state.algo === 'dc' ? 'DIVIDE & CONQUER' : state.algo === 'naive' ? 'NAIVE SCAN' : 'DUAL MISSION',
    depth: 0, processed: 0, remaining: array.length,
    min: '—', max: '—', comparisons: 0,
    maxComparisons: state.algo === 'naive' ? state.naive.comparisons : state.dc.totalComparisons,
    progress: 0
  });
}

function computeTotalSteps(){
  if(state.algo === 'dc') state.totalSteps = state.dc.events.length;
  else if(state.algo === 'naive') state.totalSteps = state.naive.events.length;
  else state.totalSteps = Math.max(state.dc.events.length, state.naive.events.length);
}

function applyDCEvent(i, container){
  const e = state.dc.events[i];
  const node = state.dc.nodes[e.id];
  highlightSegment(container, e.lo, e.hi);

  if(e.type === 'enter'){
    markTreeNode(e.id, 'active');
    logLine('D&C', `Station deployed to sector [${e.lo}–${e.hi}] · depth ${e.depth}.`);
  } else if(e.type === 'base'){
    markTreeNode(e.id, 'done');
    setNodeLabel(e.id, `min ${e.min} · max ${e.max}`);
    markExtremaInSegment(container, e.lo, e.hi, e.min, e.max);
    logLine('D&C', e.pair
      ? `Sector [${e.lo}–${e.hi}] compared 2 packets → min ${e.min}, max ${e.max}.`
      : `Sector [${e.lo}–${e.hi}] holds a single packet: ${e.min}.`);
  } else if(e.type === 'merge'){
    markTreeNode(e.id, 'done');
    markTreeEdgeLit(e.leftId);
    markTreeEdgeLit(e.rightId);
    setNodeLabel(e.id, `min ${e.min} · max ${e.max}`);
    markExtremaInSegment(container, e.lo, e.hi, e.min, e.max);
    logLine('D&C', `Sectors merged at depth ${e.depth}: min ${e.min}, max ${e.max} (2 comparisons).`);
  }

  const comparisons = state.dc.cumulative[i];
  updateStatus({
    depth: e.depth, min: e.min != null ? e.min : '—', max: e.max != null ? e.max : '—',
    comparisons, maxComparisons: state.dc.totalComparisons,
    processed: e.hi - e.lo + 1, remaining: state.array.length - (e.hi - e.lo + 1)
  });
}

function applyNaiveEvent(i, container){
  const e = state.naive.events[i];
  container.querySelectorAll('.capsule').forEach(c => {
    const idx = Number(c.dataset.index);
    c.classList.toggle('active-segment', idx === e.index);
    c.classList.toggle('dim', idx > e.index);
  });
  container.querySelectorAll('.capsule').forEach(c => {
    const idx = Number(c.dataset.index);
    c.classList.toggle('is-min', idx === e.minIndex);
    c.classList.toggle('is-max', idx === e.maxIndex);
  });
  pulseCapsule(container, e.index);

  if(e.type === 'init'){
    logLine('NAIVE', `Patrol drone launched. Initial reading: ${e.value}.`);
  } else if(e.result === 'newMin'){
    logLine('NAIVE', `Packet ${e.value} at index ${e.index} is a new minimum.`);
  } else if(e.result === 'newMax'){
    logLine('NAIVE', `Packet ${e.value} at index ${e.index} is a new maximum.`);
  } else {
    logLine('NAIVE', `Packet ${e.value} at index ${e.index} confirmed within range.`);
  }

  updateStatus({
    depth: 0, min: e.min, max: e.max, comparisons: e.comparisons,
    maxComparisons: state.naive.comparisons,
    processed: e.index + 1, remaining: state.array.length - e.index - 1
  });
}

function applyStep(i){
  if(state.algo === 'dc'){
    applyDCEvent(i, arrayDisplay);
    pushLiveChartPoint(i + 1, state.dc.cumulative[i], null);
  } else if(state.algo === 'naive'){
    applyNaiveEvent(i, arrayDisplay);
    pushLiveChartPoint(i + 1, null, state.naive.events[i].comparisons);
  } else {
    const dcLen = state.dc.events.length, naiveLen = state.naive.events.length;
    const total = state.totalSteps;
    const dcIndex = Math.min(dcLen - 1, Math.floor((i / total) * dcLen));
    const naiveIndex = Math.min(naiveLen - 1, Math.floor((i / total) * naiveLen));
    applyDCEvent(dcIndex, arrayDisplay);
    applyNaiveEvent(naiveIndex, arrayDisplayB);
    pushLiveChartPoint(i + 1, state.dc.cumulative[dcIndex], state.naive.events[naiveIndex].comparisons);
  }
  updateStatus({ progress: ((i + 1) / state.totalSteps) * 100 });
}

function stepTo(i){
  if(i < 0 || i >= state.totalSteps) return;
  state.stepIndex = i;
  applyStep(i);
  if(i === state.totalSteps - 1){
    finishMission();
  }
}

function nextStep(){
  if(state.stepIndex >= state.totalSteps - 1){ pause(); return; }
  stepTo(state.stepIndex + 1);
}
function prevStep(){
  if(state.stepIndex <= 0) return;
  const target = state.stepIndex - 1;
  // rebuild visuals from scratch up to target for correctness (cheap enough)
  resetVisualsForReplay();
  for(let i = 0; i <= target; i++) applyStep(i);
  state.stepIndex = target;
}
function resetVisualsForReplay(){
  clearLog();
  resetCapsules(arrayDisplay);
  if(!arrayDisplayB.classList.contains('hidden')) resetCapsules(arrayDisplayB);
  if(state.dc) resetTreeVisual(state.dc.nodes);
  resetLiveChart();
}

function play(){
  if(state.playing) return;
  if(state.stepIndex >= state.totalSteps - 1) restart();
  state.playing = true;
  if(!state.startedAt) state.startedAt = performance.now();
  const interval = Math.max(120, 700 / state.speed);
  state.timer = setInterval(() => {
    if(state.stepIndex >= state.totalSteps - 1){ pause(); return; }
    stepTo(state.stepIndex + 1);
  }, interval);
}
function pause(){
  state.playing = false;
  clearInterval(state.timer);
}
function restart(){
  pause();
  state.startedAt = null;
  resetVisualsForReplay();
  state.stepIndex = -1;
  document.getElementById('finalReport').classList.add('hidden');
  updateStatus({
    depth: 0, processed: 0, remaining: state.array.length, min: '—', max: '—',
    comparisons: 0, progress: 0
  });
  logLine('SYS', 'Mission reset. Standing by for launch.');
}

function finishMission(){
  pause();
  const duration = state.startedAt ? ((performance.now() - state.startedAt) / 1000).toFixed(2) : '0.00';
  const dcC = state.dc ? state.dc.totalComparisons : null;
  const naiveC = state.naive ? state.naive.comparisons : null;
  let min, max, comparisons, efficiency;

  if(state.algo === 'dc'){ min = state.dc.nodes[state.dc.rootId].min; max = state.dc.nodes[state.dc.rootId].max; comparisons = dcC; efficiency = `${(((naiveC - dcC) / naiveC) * 100).toFixed(1)}% fewer comparisons than naive`; }
  else if(state.algo === 'naive'){ min = state.naive.min; max = state.naive.max; comparisons = naiveC; efficiency = `${(((naiveC - dcC) / naiveC) * 100).toFixed(1)}% more comparisons than D&C`; }
  else { min = state.dc.nodes[state.dc.rootId].min; max = state.dc.nodes[state.dc.rootId].max; comparisons = `${dcC} vs ${naiveC}`; efficiency = `D&C used ${(((naiveC - dcC) / naiveC) * 100).toFixed(1)}% fewer comparisons`; }

  document.getElementById('repMin').textContent = min;
  document.getElementById('repMax').textContent = max;
  document.getElementById('repComparisons').textContent = comparisons;
  document.getElementById('repEfficiency').textContent = efficiency;
  document.getElementById('repDuration').textContent = `${duration}s`;
  document.getElementById('finalReport').classList.remove('hidden');
  logLine('SYS', `Mission complete. Minimum ${min}, Maximum ${max}. Transmission successful.`);
  launchConfetti();
}

/* ============================================================
   CONFETTI
   ============================================================ */

function launchConfetti(){
  const layer = document.getElementById('confettiLayer');
  const colors = ['#F97316', '#FACC15', '#FB7185', '#38BDF8', '#22C55E'];
  for(let i = 0; i < 60; i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.width = piece.style.height = (4 + Math.random() * 6) + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.boxShadow = `0 0 6px ${colors[Math.floor(Math.random() * colors.length)]}`;
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 4200);
  }
}

/* ============================================================
   INPUT HANDLING
   ============================================================ */

function parseManual(text){
  return text.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(n => !Number.isNaN(n));
}

document.getElementById('loadManualBtn').addEventListener('click', () => {
  const raw = document.getElementById('manualInput').value;
  const arr = parseManual(raw);
  if(arr.length === 0){ logLine('SYS', 'No valid packets detected in payload input.'); return; }
  loadArray(arr);
});

let selectedSize = 20;
document.querySelectorAll('#sizeButtons button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#sizeButtons button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSize = Number(btn.dataset.size);
  });
});

document.getElementById('generateBtn').addEventListener('click', () => {
  const min = Number(document.getElementById('rangeMin').value) || 0;
  const max = Number(document.getElementById('rangeMax').value) || 100;
  const arr = Array.from({ length: selectedSize }, () => Math.floor(Math.random() * (max - min + 1)) + min);
  document.getElementById('manualInput').value = arr.join(', ');
  loadArray(arr);
});

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('manualInput').value = '';
  state.array = [];
  arrayDisplay.innerHTML = '<p class="empty-state">Load or generate a data payload to begin.</p>';
  arrayDisplayB.innerHTML = '';
  treeSvg.innerHTML = '';
  clearLog();
  deckArrayLabel.textContent = 'no payload loaded';
  document.getElementById('finalReport').classList.add('hidden');
  resetLiveChart();
});

/* ---------------------------- Algo selection ---------------------------- */

document.querySelectorAll('.algo-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.algo-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    state.algo = card.dataset.algo;
    deckAlgoLabel.textContent = state.algo === 'dc' ? 'DIVIDE & CONQUER' : state.algo === 'naive' ? 'NAIVE SCAN' : 'COMPARE BOTH';
    document.querySelector('.tree-wrap').classList.toggle('hidden', state.algo === 'naive');
    arrayDisplayB.classList.toggle('hidden', state.algo !== 'compare');
    if(state.array.length){
      if(state.algo !== 'naive') renderTreeStatic(state.dc.nodes, state.dc.rootId);
      if(state.algo === 'compare') renderCapsules(arrayDisplayB, state.array);
      restart();
      computeTotalSteps();
    }
  });
});

/* ---------------------------- Controls ---------------------------- */

document.getElementById('playBtn').addEventListener('click', () => { if(state.array.length) play(); });
document.getElementById('pauseBtn').addEventListener('click', pause);
document.getElementById('nextBtn').addEventListener('click', () => { if(state.array.length){ pause(); nextStep(); } });
document.getElementById('prevBtn').addEventListener('click', () => { if(state.array.length){ pause(); prevStep(); } });
document.getElementById('restartBtn').addEventListener('click', () => { if(state.array.length) restart(); });

const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
speedSlider.addEventListener('input', () => {
  state.speed = Number(speedSlider.value);
  speedValue.textContent = state.speed + '×';
  if(state.playing){ pause(); play(); }
});

/* ============================================================
   PERFORMANCE ANALYSIS
   ============================================================ */

let barChart, lineChart, radarChart;

function chartTheme(){
  return {
    color: '#F8FAFC',
    grid: 'rgba(248,250,252,0.08)'
  };
}

function setChartStatus(id, text, live){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = text;
  el.classList.toggle('is-live', !!live);
}

function clearPerfCharts(message){
  if(barChart){ barChart.destroy(); barChart = null; }
  if(lineChart){ lineChart.destroy(); lineChart = null; }
  if(radarChart){ radarChart.destroy(); radarChart = null; }
  ['barChartStatus', 'lineChartStatus', 'radarChartStatus'].forEach(id => setChartStatus(id, 'awaiting sweep', false));
  ['barAnalysis', 'lineAnalysis', 'radarAnalysis'].forEach(id => {
    document.getElementById(id).innerHTML = `<span class="chart-analysis-empty">${message}</span>`;
  });
}

document.getElementById('runPerfBtn').addEventListener('click', () => {
  if(!state.array.length || !state.dc || !state.naive){
    clearPerfCharts('Load or generate a payload in the Console first, then run this analysis.');
    document.querySelector('#perfTable tbody').innerHTML = '';
    logLine('SYS', 'No payload loaded — cannot run performance analysis.');
    return;
  }

  const n = state.array.length;
  const dcC = state.dc.totalComparisons;
  const naiveC = state.naive.comparisons;
  const expected = Math.ceil((3 * n) / 2) - 2;
  const row = { n, dcC, naiveC, expected };

  const tbody = document.querySelector('#perfTable tbody');
  tbody.innerHTML = `<tr class="perf-row-current"><td>${n.toLocaleString()} <span class="current-tag">CURRENT MISSION</span></td><td>${dcC.toLocaleString()}</td><td>${naiveC.toLocaleString()}</td><td>${expected.toLocaleString()}</td></tr>`;

  renderCharts(row);
  ['barChartStatus', 'lineChartStatus', 'radarChartStatus'].forEach(id =>
    setChartStatus(id, `current mission · n=${n}`, true)
  );
  logLine('SYS', `Performance analysis complete for current mission (n=${n}).`);
});

function renderCharts(row){
  const theme = chartTheme();
  analyzeBarChart(row);

  if(barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: [`Current Mission (n=${row.n})`],
      datasets: [
        { label: 'Divide & Conquer', data: [row.dcC], backgroundColor: '#F97316' },
        { label: 'Naive Scan', data: [row.naiveC], backgroundColor: '#38BDF8' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { labels: { color: theme.color } } },
      scales: {
        x: { ticks: { color: theme.color }, grid: { color: theme.grid } },
        y: { ticks: { color: theme.color }, grid: { color: theme.grid }, beginAtZero: true }
      }
    }
  });

  // Line chart: the REAL step-by-step comparison growth from this mission's actual trace
  // (D&C's cumulative comparisons per recursion event vs Naive's running count per index).
  const dcSteps = state.dc.cumulative;
  const naiveSteps = state.naive.events.map(e => e.comparisons);
  const maxLen = Math.max(dcSteps.length, naiveSteps.length);
  const labels = Array.from({ length: maxLen }, (_, i) => i + 1);
  const dcData = Array.from({ length: maxLen }, (_, i) => i < dcSteps.length ? dcSteps[i] : null);
  const naiveData = Array.from({ length: maxLen }, (_, i) => i < naiveSteps.length ? naiveSteps[i] : null);
  analyzeLineChart(row, dcSteps, naiveSteps);

  if(lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'D&C', data: dcData, borderColor: '#FACC15', backgroundColor: 'rgba(250,204,21,0.15)', tension: 0.35, fill: true, pointRadius: 2, spanGaps: true },
        { label: 'Naive', data: naiveData, borderColor: '#FB7185', backgroundColor: 'rgba(251,113,133,0.15)', tension: 0.35, fill: true, pointRadius: 2, spanGaps: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        x: { type: 'number', easing: 'linear', duration: 1100, from: NaN, delay(ctx){ return ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * (1100 / maxLen) : 0; } },
        y: { type: 'number', easing: 'linear', duration: 0, from(ctx){ return ctx.type === 'data' && ctx.mode === 'default' ? ctx.chart.scales.y.getPixelForValue(0) : undefined; } }
      },
      plugins: { legend: { labels: { color: theme.color } } },
      scales: {
        x: { ticks: { color: theme.color, maxTicksLimit: 10 }, grid: { color: theme.grid }, title: { display: true, text: 'Mission Step', color: '#B8CFC2' } },
        y: { ticks: { color: theme.color }, grid: { color: theme.grid }, beginAtZero: true, title: { display: true, text: 'Comparisons', color: '#B8CFC2' } }
      }
    }
  });

  const dcCompScore = Math.round((row.naiveC / (row.dcC + row.naiveC)) * 100);
  const naiveCompScore = 100 - dcCompScore;
  analyzeRadarChart(row, dcCompScore, naiveCompScore);

  if(radarChart) radarChart.destroy();
  radarChart = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: {
      labels: ['Comparison Efficiency', 'Time Complexity', 'Space Efficiency', 'Scalability'],
      datasets: [
        { label: 'D&C', data: [dcCompScore, 85, 65, dcCompScore], borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.25)' },
        { label: 'Naive', data: [naiveCompScore, 85, 95, naiveCompScore], borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.2)' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000, easing: 'easeOutElastic' },
      plugins: { legend: { labels: { color: theme.color } } },
      scales: {
        r: {
          angleLines: { color: theme.grid },
          grid: { color: theme.grid },
          pointLabels: { color: theme.color, font: { size: 10 } },
          ticks: { display: false, backdropColor: 'transparent' },
          suggestedMin: 0,
          suggestedMax: 100
        }
      }
    }
  });
}

/* ---------------------------- Chart Analysis (current mission only) ---------------------------- */

function analyzeBarChart(row){
  const el = document.getElementById('barAnalysis');
  const ratio = row.naiveC / row.dcC;
  const savingsPct = Math.round((1 - row.dcC / row.naiveC) * 100);

  el.innerHTML = `
    <p>For your current mission (n=<strong>${row.n.toLocaleString()}</strong>), D&amp;C ran <span class="stat-dc">${row.dcC.toLocaleString()}</span> comparisons vs Naive's <span class="stat-naive">${row.naiveC.toLocaleString()}</span>.</p>
    <p>Naive needed <strong>${ratio.toFixed(2)}×</strong> as many comparisons — a <span class="stat-down">${savingsPct}% reduction</span> for D&amp;C on this exact payload.</p>
  `;
}

function analyzeLineChart(row, dcSteps, naiveSteps){
  const el = document.getElementById('lineAnalysis');
  const dcAccuracyPct = Math.abs(100 - (row.dcC / row.expected) * 100).toFixed(2);
  const dcAvgStep = (row.dcC / dcSteps.length).toFixed(2);
  const naiveAvgStep = (row.naiveC / naiveSteps.length).toFixed(2);

  el.innerHTML = `
    <p>Across this mission's actual run, D&amp;C reached <span class="stat-dc">${row.dcC.toLocaleString()}</span> total comparisons over ${dcSteps.length} recursion events (≈${dcAvgStep} per event), while Naive reached <span class="stat-naive">${row.naiveC.toLocaleString()}</span> over ${naiveSteps.length} scan steps (≈${naiveAvgStep} per step).</p>
    <p>D&amp;C's final comparison count sits within <strong>${dcAccuracyPct}%</strong> of the theoretical 3n/2 − 2 formula for n=${row.n.toLocaleString()}, confirming the real trace tracks its expected growth curve.</p>
  `;
}

function analyzeRadarChart(row, dcCompScore, naiveCompScore){
  const el = document.getElementById('radarAnalysis');
  const leader = dcCompScore >= naiveCompScore ? 'D&C' : 'Naive';
  const leadMargin = Math.abs(dcCompScore - naiveCompScore);

  el.innerHTML = `
    <p>For your current mission (n=${row.n.toLocaleString()}), <strong>${leader}</strong> leads Comparison Efficiency <span class="stat-dc">${dcCompScore}</span> vs <span class="stat-naive">${naiveCompScore}</span>, a ${leadMargin}-point margin — pulled directly from this run's real comparison counts.</p>
    <p>The other three axes are fixed Big-O scores, not measured: D&amp;C and Naive tie on Time Complexity (both O(n)), while D&amp;C trades Space Efficiency for Scalability since it uses O(log n) space against Naive's O(1).</p>
  `;
}

/* ---------------------------- Init ---------------------------- */
initLiveChart();
logLine('SYS', 'Mission Control systems online.');
