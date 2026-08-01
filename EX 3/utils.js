/* ============================================================
   utils.js — shared data & helper structures for MST Visualizer
   ============================================================ */

// ---- Default graph data --------------------------------------------------
// Positions are hand-placed on a 800x520 viewBox so the graph reads clearly.
const DEFAULT_GRAPH = {
  nodes: [
    { id: 0, x: 140, y: 260 },
    { id: 1, x: 320, y: 110 },
    { id: 2, x: 560, y: 90 },
    { id: 3, x: 290, y: 400 },
    { id: 4, x: 520, y: 300 },
    { id: 5, x: 400, y: 470 },
    { id: 6, x: 660, y: 430 },
  ],
  edges: [
    { id: 'e0', u: 0, v: 1, w: 7 },
    { id: 'e1', u: 0, v: 3, w: 5 },
    { id: 'e2', u: 1, v: 2, w: 8 },
    { id: 'e3', u: 1, v: 3, w: 9 },
    { id: 'e4', u: 1, v: 4, w: 7 },
    { id: 'e5', u: 2, v: 4, w: 5 },
    { id: 'e6', u: 3, v: 4, w: 15 },
    { id: 'e7', u: 3, v: 5, w: 6 },
    { id: 'e8', u: 4, v: 5, w: 8 },
    { id: 'e9', u: 4, v: 6, w: 9 },
    { id: 'e10', u: 5, v: 6, w: 11 },
  ],
};

// ---- Union-Find (Disjoint Set Union) --------------------------------------
class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false; // would create a cycle
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
    return true;
  }
  connected(a, b) { return this.find(a) === this.find(b); }
}

// ---- Minimal binary-heap-free priority queue (fine for small graphs) -----
class MinPQ {
  constructor() { this.items = []; }
  push(item) {
    this.items.push(item);
    this.items.sort((a, b) => a.key - b.key);
  }
  pop() { return this.items.shift(); }
  get isEmpty() { return this.items.length === 0; }
  snapshot() { return this.items.map(i => ({ ...i })); }
}

// ---- Small helpers ---------------------------------------------------------
const fmt = {
  cost(n) { return n.toLocaleString(); },
  ms(n) { return `${n.toFixed(2)} ms`; },
};

function edgeKey(u, v) { return u < v ? `${u}-${v}` : `${v}-${u}`; }

function cloneGraph(g) {
  return {
    nodes: g.nodes.map(n => ({ ...n })),
    edges: g.edges.map(e => ({ ...e })),
  };
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Export to global scope (plain script tags, no bundler)
window.DEFAULT_GRAPH = DEFAULT_GRAPH;
window.UnionFind = UnionFind;
window.MinPQ = MinPQ;
window.fmt = fmt;
window.edgeKey = edgeKey;
window.cloneGraph = cloneGraph;
window.debounce = debounce;
