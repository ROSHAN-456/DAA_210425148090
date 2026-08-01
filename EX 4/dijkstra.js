// ==========================================================================
// dijkstra.js — algorithm engine that produces a recorded step trace
// ==========================================================================

const Dijkstra = (() => {
  const INF = Infinity;

  /**
   * Runs Dijkstra's algorithm and records every micro-step so the UI
   * can play, pause, and scrub through the execution.
   * @returns {{steps: object[], distances: object, prev: object}}
   */
  function run(graph, sourceId) {
    const steps = [];
    const vertexIds = graph.vertices.map((v) => v.id);
    const dist = {};
    const prev = {};
    const visited = new Set();

    vertexIds.forEach((id) => {
      dist[id] = id === sourceId ? 0 : INF;
      prev[id] = null;
    });

    // Priority queue represented as a simple array of {id, dist} — fine for
    // teaching-scale graphs and keeps the recorded steps easy to animate.
    let pq = vertexIds.map((id) => ({ id, dist: dist[id] }));

    steps.push({
      type: 'init',
      source: sourceId,
      dist: { ...dist },
      prev: { ...prev },
      visited: new Set(),
      pq: pq.map((p) => ({ ...p })),
      explanation: `Starting Dijkstra's algorithm from source vertex ${sourceId}. Distance to source is set to 0 and every other vertex begins at infinity.`,
    });

    const adj = {};
    vertexIds.forEach((id) => { adj[id] = []; });
    graph.edges.forEach((e) => {
      if (adj[e.from]) adj[e.from].push(e);
    });

    while (pq.length) {
      pq.sort((a, b) => a.dist - b.dist);
      const { id: u, dist: uDistAtQueueTime } = pq.shift();

      if (visited.has(u)) continue;
      if (uDistAtQueueTime === INF) {
        steps.push({
          type: 'unreachable',
          pq: pq.map((p) => ({ ...p })),
          dist: { ...dist },
          prev: { ...prev },
          visited: new Set(visited),
          explanation: 'All remaining vertices are unreachable from the source. Stopping early.',
        });
        break;
      }

      visited.add(u);
      steps.push({
        type: 'extract-min',
        current: u,
        currentDist: dist[u],
        pq: pq.map((p) => ({ ...p })),
        dist: { ...dist },
        prev: { ...prev },
        visited: new Set(visited),
        explanation: `Extracting the vertex with the smallest tentative distance from the priority queue: vertex ${u} (distance ${Utils.fmtDist(dist[u])}). Marking it visited.`,
      });

      const neighbours = adj[u] || [];
      for (let i = 0; i < neighbours.length; i += 1) {
        const edge = neighbours[i];
        const v = edge.to;
        if (visited.has(v)) {
          steps.push({
            type: 'skip-edge',
            current: u,
            edgeId: edge.id,
            neighbour: v,
            dist: { ...dist },
            prev: { ...prev },
            visited: new Set(visited),
            pq: pq.map((p) => ({ ...p })),
            explanation: `Vertex ${v} is already visited, so edge ${u} → ${v} is skipped.`,
          });
          continue;
        }
        const candidate = dist[u] === INF ? INF : dist[u] + edge.weight;
        const improved = candidate < dist[v];

        steps.push({
          type: 'check-edge',
          current: u,
          edgeId: edge.id,
          neighbour: v,
          weight: edge.weight,
          before: dist[v],
          candidate,
          improved,
          dist: { ...dist },
          prev: { ...prev },
          visited: new Set(visited),
          pq: pq.map((p) => ({ ...p })),
          explanation: improved
            ? `Checking edge ${u} → ${v} (weight ${edge.weight}). ${Utils.fmtDist(dist[u])} + ${edge.weight} = ${candidate}, which is less than the current distance ${Utils.fmtDist(dist[v])}. Better path found — updating.`
            : `Checking edge ${u} → ${v} (weight ${edge.weight}). ${Utils.fmtDist(dist[u])} + ${edge.weight} = ${Utils.fmtDist(candidate)}, which is not better than the current distance ${Utils.fmtDist(dist[v])}. No update needed.`,
        });

        if (improved) {
          dist[v] = candidate;
          prev[v] = u;
          const existing = pq.find((p) => p.id === v);
          if (existing) existing.dist = candidate;
          else pq.push({ id: v, dist: candidate });

          steps.push({
            type: 'update-dist',
            current: u,
            edgeId: edge.id,
            neighbour: v,
            dist: { ...dist },
            prev: { ...prev },
            visited: new Set(visited),
            pq: pq.map((p) => ({ ...p })),
            explanation: `Distance to vertex ${v} updated to ${candidate}. Previous vertex set to ${u}. Priority queue updated.`,
          });
        }
      }

      steps.push({
        type: 'vertex-done',
        current: u,
        dist: { ...dist },
        prev: { ...prev },
        visited: new Set(visited),
        pq: pq.map((p) => ({ ...p })),
        explanation: `All neighbours of vertex ${u} have been checked. Moving to the next vertex in the priority queue.`,
      });
    }

    steps.push({
      type: 'done',
      dist: { ...dist },
      prev: { ...prev },
      visited: new Set(visited),
      pq: [],
      explanation: 'Dijkstra\'s algorithm has finished. Every reachable vertex now holds its shortest distance from the source.',
    });

    return { steps, distances: dist, prev };
  }

  /** Reconstructs the path from source to target using the prev map. */
  function buildPath(prev, source, target) {
    if (target === source) return [source];
    const path = [];
    let cur = target;
    const guard = new Set();
    while (cur !== null && cur !== undefined) {
      if (guard.has(cur)) return null; // cycle guard, shouldn't happen
      guard.add(cur);
      path.unshift(cur);
      if (cur === source) break;
      cur = prev[cur];
    }
    if (path[0] !== source) return null;
    return path;
  }

  function pathEdgeIds(graph, path) {
    if (!path) return new Set();
    const ids = new Set();
    for (let i = 0; i < path.length - 1; i += 1) {
      const e = graph.edges.find((edge) => edge.from === path[i] && edge.to === path[i + 1]);
      if (e) ids.add(e.id);
    }
    return ids;
  }

  return { run, buildPath, pathEdgeIds, INF };
})();
