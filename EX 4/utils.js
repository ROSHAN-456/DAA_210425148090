// ==========================================================================
// utils.js — shared helper functions used across the app
// ==========================================================================

const Utils = (() => {
  const INF = Infinity;

  /** Simple incremental id generator for edges */
  let edgeCounter = 0;
  function nextEdgeId() {
    edgeCounter += 1;
    return `e${edgeCounter}`;
  }

  /** Clamp a number between min and max */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /** Linear interpolation */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Format a distance value for display */
  function fmtDist(d) {
    return d === INF ? '∞' : String(d);
  }

  /** Format milliseconds nicely */
  function fmtMs(ms) {
    return `${ms.toFixed(2)} ms`;
  }

  /** Create an SVG element with a namespace */
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  /** Create a plain DOM element with attrs + children helper */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.appendChild(c));
    return node;
  }

  /** Generate a sample / default graph matching the spec */
  function sampleGraph() {
    return {
      vertices: [
        { id: 0, x: 140, y: 260 },
        { id: 1, x: 380, y: 120 },
        { id: 2, x: 340, y: 380 },
        { id: 3, x: 620, y: 240 },
        { id: 4, x: 860, y: 340 },
        { id: 5, x: 1080, y: 200 },
      ],
      edges: [
        { id: nextEdgeId(), from: 0, to: 1, weight: 4 },
        { id: nextEdgeId(), from: 0, to: 2, weight: 1 },
        { id: nextEdgeId(), from: 2, to: 1, weight: 2 },
        { id: nextEdgeId(), from: 1, to: 3, weight: 1 },
        { id: nextEdgeId(), from: 2, to: 3, weight: 5 },
        { id: nextEdgeId(), from: 3, to: 4, weight: 3 },
        { id: nextEdgeId(), from: 4, to: 5, weight: 2 },
      ],
    };
  }

  /** Generate a random connected-ish graph */
  function randomGraph(vertexCount = 7, extraEdgeChance = 0.35) {
    const vertices = [];
    const cx = 600, cy = 260, r = 220;
    for (let i = 0; i < vertexCount; i += 1) {
      const angle = (2 * Math.PI * i) / vertexCount - Math.PI / 2;
      vertices.push({
        id: i,
        x: Math.round(cx + r * Math.cos(angle) + (Math.random() * 40 - 20)),
        y: Math.round(cy + r * Math.sin(angle) + (Math.random() * 40 - 20)),
      });
    }
    const edges = [];
    // Ensure connectivity with a random spanning chain
    const order = [...Array(vertexCount).keys()];
    for (let i = 1; i < order.length; i += 1) {
      const from = order[Math.floor(Math.random() * i)];
      const to = order[i];
      edges.push({ id: nextEdgeId(), from, to, weight: 1 + Math.floor(Math.random() * 9) });
    }
    // Sprinkle extra random edges
    for (let i = 0; i < vertexCount; i += 1) {
      for (let j = 0; j < vertexCount; j += 1) {
        if (i === j) continue;
        if (Math.random() < extraEdgeChance / vertexCount) {
          const exists = edges.some((e) => e.from === i && e.to === j);
          if (!exists) {
            edges.push({ id: nextEdgeId(), from: i, to: j, weight: 1 + Math.floor(Math.random() * 9) });
          }
        }
      }
    }
    return { vertices, edges };
  }

  /** Debounce helper */
  function debounce(fn, wait = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  return {
    INF, nextEdgeId, clamp, lerp, fmtDist, fmtMs, svgEl, el,
    sampleGraph, randomGraph, debounce,
  };
})();
