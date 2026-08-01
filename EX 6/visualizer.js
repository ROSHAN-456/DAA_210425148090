/* ============================================================
   AI MATRIX OPTIMIZER — visualizer.js
   Renders energy modules, the holographic DP table, the
   parenthesization tree, the mission log and ambient particles.
   ============================================================ */

const Visualizer = (() => {
  const { $, el, fmtNumber } = Utils;

  let dims = [];
  let n = 0;
  let cellNodes = {}; // "i-j" -> DOM node
  let activity = {};  // i -> j -> count

  /* ---------------- Energy Modules ---------------- */

  function renderModules(dimsArr) {
    dims = dimsArr;
    n = dims.length - 1;
    const track = $('#modules-track');
    track.innerHTML = '';
    for (let i = 1; i <= n; i++) {
      const rows = dims[i - 1], cols = dims[i];
      const card = el('div', { class: 'energy-module', 'data-index': i, id: `module-${i}` }, [
        el('div', { class: 'module-glow' }),
        el('div', { class: 'module-title' }, `MATRIX A${i}`),
        el('div', { class: 'module-dims' }, `${rows} \u00d7 ${cols}`),
        el('div', { class: 'module-label' }, 'ENERGY OUTPUT'),
        el('div', { class: 'module-bar' }, el('div', { class: 'module-bar-fill' })),
        el('div', { class: 'module-status' }, [
          el('span', { class: 'status-dot' }), 'ACTIVE'
        ])
      ]);
      track.appendChild(card);
    }
    renderModulePreviewTable(dims);
  }

  function renderModulePreviewTable(dimsArr) {
    const wrap = $('#preview-table');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 1; i < dimsArr.length; i++) {
      wrap.appendChild(el('div', { class: 'preview-chip' }, [
        el('span', { class: 'preview-chip-name' }, `A${i}`),
        el('span', { class: 'preview-chip-dims' }, `${dimsArr[i - 1]}\u00d7${dimsArr[i]}`)
      ]));
    }
  }

  function pulseModule(i) {
    const mod = document.getElementById(`module-${i}`);
    if (mod) {
      mod.classList.add('module-active');
      setTimeout(() => mod.classList.remove('module-active'), 700);
    }
  }

  function fuseModules(i, j) {
    const a = document.getElementById(`module-${i}`);
    const b = document.getElementById(`module-${j}`);
    [a, b].forEach(m => m && m.classList.add('module-fusing'));
    spawnFusionBurst();
    setTimeout(() => [a, b].forEach(m => m && m.classList.remove('module-fusing')), 900);
  }

  function spawnFusionBurst() {
    const layer = $('#fusion-layer');
    if (!layer) return;
    const burst = el('div', { class: 'fusion-burst' });
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
  }

  /* ---------------- DP Table ---------------- */

  function initDPTable(matN) {
    n = matN;
    activity = {};
    const table = $('#dp-table');
    table.innerHTML = '';
    table.style.setProperty('--n', n);
    cellNodes = {};

    const grid = el('div', { class: 'dp-grid' });
    grid.style.gridTemplateColumns = `64px repeat(${n}, 64px)`;

    grid.appendChild(el('div', { class: 'dp-corner' }, ''));
    for (let j = 1; j <= n; j++) grid.appendChild(el('div', { class: 'dp-head' }, `A${j}`));

    for (let i = 1; i <= n; i++) {
      grid.appendChild(el('div', { class: 'dp-head' }, `A${i}`));
      for (let j = 1; j <= n; j++) {
        const cell = el('div', { class: 'dp-cell', id: `dp-${i}-${j}` }, i <= j ? '\u2014' : '');
        if (i > j) cell.classList.add('dp-cell-inactive');
        grid.appendChild(cell);
        cellNodes[`${i}-${j}`] = cell;
        activity[i] = activity[i] || {};
        activity[i][j] = 0;
      }
    }
    table.appendChild(grid);
  }

  function markProcessing(i, j) {
    const cell = cellNodes[`${i}-${j}`];
    if (!cell) return;
    cell.classList.add('dp-processing');
    activity[i][j] = (activity[i][j] || 0) + 1;
  }

  function markResult(i, j, value, accepted) {
    const cell = cellNodes[`${i}-${j}`];
    if (!cell) return;
    cell.classList.remove('dp-processing');
    cell.textContent = fmtNumber(value);
    cell.classList.add(accepted ? 'dp-flash-green' : 'dp-flash-red');
    setTimeout(() => cell.classList.remove('dp-flash-green', 'dp-flash-red'), 500);
  }

  function finalizeCell(i, j, value) {
    const cell = cellNodes[`${i}-${j}`];
    if (!cell) return;
    cell.classList.remove('dp-processing');
    cell.textContent = fmtNumber(value);
    cell.classList.add('dp-optimal');
  }

  function getActivity() { return activity; }

  /* ---------------- Parenthesization Tree ---------------- */

  function renderTree(node, container) {
    container.innerHTML = '';
    const svgWrap = el('div', { class: 'tree-canvas' });
    container.appendChild(svgWrap);
    const rootEl = buildTreeNode(node, 0);
    svgWrap.appendChild(rootEl);
  }

  function buildTreeNode(node, depth) {
    if (node.type === 'leaf') {
      return el('div', { class: 'tree-leaf', style: `--depth:${depth}` }, `A${node.index}`);
    }
    const wrap = el('div', { class: 'tree-node', style: `--depth:${depth}` });
    const label = el('div', { class: 'tree-op' }, '\u00d7 FUSE');
    const children = el('div', { class: 'tree-children' }, [
      buildTreeNode(node.left, depth + 1),
      buildTreeNode(node.right, depth + 1)
    ]);
    wrap.appendChild(label);
    wrap.appendChild(children);
    return wrap;
  }

  /* ---------------- Mission Log ---------------- */

  function logMessage(msg, type = 'info') {
    const log = $('#mission-log');
    if (!log) return;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const line = el('div', { class: `log-line log-${type}` }, [
      el('span', { class: 'log-time' }, `[${time}]`),
      el('span', { class: 'log-text' }, msg)
    ]);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 200) log.removeChild(log.firstChild);
  }

  function clearLog() {
    const log = $('#mission-log');
    if (log) log.innerHTML = '';
  }

  /* ---------------- Ambient Particles ---------------- */

  function spawnEmbers(container, count = 30) {
    for (let i = 0; i < count; i++) {
      const ember = el('div', { class: 'ember' });
      ember.style.left = `${Math.random() * 100}%`;
      ember.style.animationDelay = `${Math.random() * 8}s`;
      ember.style.animationDuration = `${6 + Math.random() * 6}s`;
      ember.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
      container.appendChild(ember);
    }
  }

  function renderPlaceholderModules(count) {
    const track = $('#modules-track');
    track.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      const card = el('div', { class: 'energy-module module-placeholder', 'data-index': i, id: `module-${i}` }, [
        el('div', { class: 'module-glow' }),
        el('div', { class: 'module-title' }, `MATRIX A${i}`),
        el('div', { class: 'module-dims' }, '\u2014 \u00d7 \u2014'),
        el('div', { class: 'module-label' }, 'ENERGY OUTPUT'),
        el('div', { class: 'module-bar' }, el('div', { class: 'module-bar-fill' })),
        el('div', { class: 'module-status' }, [
          el('span', { class: 'status-dot' }), 'STANDBY'
        ])
      ]);
      track.appendChild(card);
    }
    const wrap = $('#preview-table');
    if (wrap) {
      wrap.innerHTML = '';
      for (let i = 1; i <= count; i++) {
        wrap.appendChild(el('div', { class: 'preview-chip' }, [
          el('span', { class: 'preview-chip-name' }, `A${i}`),
          el('span', { class: 'preview-chip-dims' }, '\u2014\u00d7\u2014')
        ]));
      }
    }
  }

  return {
    renderModules, renderPlaceholderModules, pulseModule, fuseModules,
    initDPTable, markProcessing, markResult, finalizeCell, getActivity,
    renderTree, logMessage, clearLog, spawnEmbers
  };
})();
