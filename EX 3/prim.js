/* ============================================================
   prim.js — generates a full step-by-step trace of Prim's
   algorithm, growing the tree outward from a start vertex.
   ============================================================ */

function runPrimSteps(graph, startId = 0) {
  const steps = [];
  const n = graph.nodes.length;
  const adj = Array.from({ length: n }, () => []);
  graph.edges.forEach(e => {
    adj[e.u].push({ to: e.v, w: e.w, edgeId: e.id });
    adj[e.v].push({ to: e.u, w: e.w, edgeId: e.id });
  });

  const visited = new Set([startId]);
  const pq = new MinPQ();
  const mst = [];
  let cost = 0;

  steps.push({
    phase: 'start',
    title: `Start at vertex ${startId}`,
    current: startId,
    visited: [...visited],
    pq: [],
    mstEdges: [],
    cost: 0,
    explanation: `Prim's algorithm starts from vertex ${startId}. The tree grows one edge at a time, always choosing the cheapest edge that reaches a new, unvisited vertex.`,
  });

  function pushNeighbors(vertex) {
    adj[vertex].forEach(({ to, w, edgeId }) => {
      if (!visited.has(to)) pq.push({ key: w, to, from: vertex, edgeId });
    });
  }

  pushNeighbors(startId);
  steps.push({
    phase: 'enqueue',
    title: `Add edges from vertex ${startId} to the queue`,
    current: startId,
    visited: [...visited],
    pq: pq.snapshot(),
    mstEdges: mst.map(e => e.edgeId),
    cost,
    explanation: `All edges leaving vertex ${startId} are added to the priority queue, keyed by weight.`,
  });

  while (!pq.isEmpty && visited.size < n) {
    // Extract-min, skipping stale entries whose "to" vertex got visited meanwhile.
    let candidate = pq.pop();
    while (candidate && visited.has(candidate.to) && !pq.isEmpty) {
      candidate = pq.pop();
    }
    if (!candidate || visited.has(candidate.to)) break;

    steps.push({
      phase: 'extract',
      title: `Extract minimum: edge ${candidate.from}–${candidate.to} (${candidate.key})`,
      current: candidate.to,
      pendingEdge: candidate.edgeId,
      visited: [...visited],
      pq: pq.snapshot(),
      mstEdges: mst.map(e => e.edgeId),
      cost,
      explanation: `The cheapest edge in the queue is (${candidate.from}, ${candidate.to}) with weight ${candidate.key}. Vertex ${candidate.to} is not yet visited, so this edge is selected.`,
    });

    visited.add(candidate.to);
    mst.push(candidate);
    cost += candidate.key;

    steps.push({
      phase: 'add',
      title: `Add vertex ${candidate.to} to the tree`,
      current: candidate.to,
      selectedEdge: candidate.edgeId,
      visited: [...visited],
      pq: pq.snapshot(),
      mstEdges: mst.map(e => e.edgeId),
      cost,
      explanation: `Vertex ${candidate.to} joins the tree via edge (${candidate.from}, ${candidate.to}). Total cost is now ${cost}.`,
    });

    pushNeighbors(candidate.to);
    steps.push({
      phase: 'enqueue',
      title: `Add edges from vertex ${candidate.to} to the queue`,
      current: candidate.to,
      visited: [...visited],
      pq: pq.snapshot(),
      mstEdges: mst.map(e => e.edgeId),
      cost,
      explanation: `New edges leaving vertex ${candidate.to} are pushed into the priority queue for future consideration.`,
    });
  }

  steps.push({
    phase: 'done',
    title: 'Minimum Spanning Tree complete',
    visited: [...visited],
    pq: [],
    mstEdges: mst.map(e => e.edgeId),
    cost,
    explanation: `The Minimum Spanning Tree is complete with ${mst.length} edges and a total cost of ${cost}, connecting all ${n} vertices.`,
  });

  return { steps, mst, cost, algorithm: 'prim' };
}

window.runPrimSteps = runPrimSteps;
