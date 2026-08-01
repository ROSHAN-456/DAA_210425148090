/* ============================================================
   AI MATRIX OPTIMIZER — utils.js
   Small shared helpers: DOM, formatting, particles, easing.
   ============================================================ */

const Utils = (() => {

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fmtNumber(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('en-US');
  }

  function fmtTime(ms) {
    if (ms < 1000) return `${ms.toFixed(1)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // Simple animated counter for numeric text nodes
  function animateCount(node, from, to, duration = 600, suffix = '') {
    const start = performance.now();
    const diff = to - from;
    function step(t) {
      const p = clamp((t - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + diff * eased);
      node.textContent = fmtNumber(val) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // Parse "10,30,5,60,10" into [10,30,5,60,10]
  function parseDims(str) {
    if (!str) return [];
    return str.split(',')
      .map(s => s.trim())
      .filter(s => s.length)
      .map(Number)
      .filter(n => Number.isFinite(n) && n > 0);
  }

  function generateRandomDims(count = 6, min = 5, max = 80) {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(randInt(min, max));
    return arr;
  }

  function uid() { return Math.random().toString(36).slice(2, 9); }

  return {
    $, $$, el, fmtNumber, fmtTime, clamp, randInt,
    animateCount, debounce, parseDims, generateRandomDims, uid
  };
})();


/* ============================================================
   AI MATRIX OPTIMIZER — dp.js
   Matrix Chain Multiplication solved via Dynamic Programming.
   Every micro-decision is recorded as a "step" so the visualizer
   can replay the AI's reasoning frame by frame.
   ============================================================ */

const DPEngine = (() => {

  /**
   * Solve Matrix Chain Multiplication and record every step.
   * dims: array of length n+1, matrix i has dims[i-1] x dims[i]
   * Returns { m, s, steps, n, optimalCost, optimalOrder }
   */
  function solve(dims) {
    const n = dims.length - 1; // number of matrices
    const m = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
    const s = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
    const steps = [];

    steps.push({
      type: 'init',
      message: `AI Core online. ${n} energy modules detected. Building ${n}\u00d7${n} optimization matrix.`,
      n
    });

    for (let len = 2; len <= n; len++) {
      steps.push({
        type: 'chain-start',
        len,
        message: `Calculating optimal fusions for chains of length ${len}.`
      });

      for (let i = 1; i <= n - len + 1; i++) {
        const j = i + len - 1;
        m[i][j] = Infinity;

        steps.push({
          type: 'cell-start',
          i, j, len,
          message: `AI is analyzing chain A${i} to A${j}.`
        });

        for (let k = i; k < j; k++) {
          const cost = m[i][k] + m[k + 1][j] + dims[i - 1] * dims[k] * dims[j];
          const isBetter = cost < m[i][j];

          steps.push({
            type: 'split-eval',
            i, j, k, len,
            cost,
            previousBest: m[i][j] === Infinity ? null : m[i][j],
            accepted: isBetter,
            message: isBetter
              ? `Trying split after A${k}. Cost ${Utils.fmtNumber(cost)} beats previous best ${m[i][j] === Infinity ? '\u221e' : Utils.fmtNumber(m[i][j])}. Better solution discovered.`
              : `Trying split after A${k}. Cost ${Utils.fmtNumber(cost)} does not improve on ${Utils.fmtNumber(m[i][j])}. Split rejected.`
          });

          if (isBetter) {
            m[i][j] = cost;
            s[i][j] = k;
          }
        }

        steps.push({
          type: 'cell-done',
          i, j, len,
          cost: m[i][j],
          split: s[i][j],
          message: `Optimization updated. Minimum cost for A${i}..A${j} is ${Utils.fmtNumber(m[i][j])} (split after A${s[i][j]}). Energy fusion completed.`
        });
      }
    }

    steps.push({
      type: 'done',
      message: `Mission successful. Optimal cost ${Utils.fmtNumber(m[1][n])} scalar multiplications.`,
      cost: m[1][n]
    });

    return {
      m, s, steps, n,
      optimalCost: m[1][n],
      optimalOrder: buildParenthesization(s, 1, n)
    };
  }

  function buildParenthesization(s, i, j) {
    if (i === j) return { type: 'leaf', index: i };
    const k = s[i][j];
    return {
      type: 'node',
      split: k,
      left: buildParenthesization(s, i, k),
      right: buildParenthesization(s, k + 1, j)
    };
  }

  function parenString(node) {
    if (node.type === 'leaf') return `A${node.index}`;
    return `(${parenString(node.left)} \u00d7 ${parenString(node.right)})`;
  }

  return { solve, parenString };
})();
