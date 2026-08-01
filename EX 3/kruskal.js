/* ============================================================
   kruskal.js — generates a full step-by-step trace of Kruskal's
   algorithm so the player can scrub forward/back through it.
   ============================================================ */

function runKruskalSteps(graph) {
  const steps = [];
  const n = graph.nodes.length;
  const uf = new UnionFind(n);
  const sortedEdges = [...graph.edges].sort((a, b) => a.w - b.w);

  const mst = [];
  let cost = 0, accepted = 0, rejected = 0;

  // Step 0: show the sorted order (the "sorting" animation frame)
  steps.push({
    phase: 'sort',
    title: 'Sort all edges by weight',
    sortedOrder: sortedEdges.map(e => e.id),
    explanation: `Kruskal's algorithm begins by sorting all ${sortedEdges.length} edges in ascending order of weight. This guarantees the cheapest available edge is always considered first.`,
    mstEdges: [], cost: 0, accepted: 0, rejected: 0,
    remaining: sortedEdges.length,
  });

  for (let idx = 0; idx < sortedEdges.length; idx++) {
    const edge = sortedEdges[idx];

    // "considering" frame — highlight current edge before we know the outcome
    steps.push({
      phase: 'consider',
      title: `Consider edge ${edge.u}–${edge.v}`,
      edge: edge.id,
      weight: edge.w,
      explanation: `Step ${idx + 1}: the current edge is (${edge.u}, ${edge.v}) with weight ${edge.w}. Checking whether it would connect two vertices that are already in the same tree.`,
      mstEdges: mst.map(e => e.id),
      cost, accepted, rejected,
      remaining: sortedEdges.length - idx - 1,
    });

    const wouldCycle = uf.connected(edge.u, edge.v);

    if (!wouldCycle) {
      uf.union(edge.u, edge.v);
      mst.push(edge);
      cost += edge.w;
      accepted++;
    } else {
      rejected++;
    }

    steps.push({
      phase: 'result',
      title: wouldCycle ? 'Cycle detected — rejected' : 'No cycle — added to MST',
      edge: edge.id,
      weight: edge.w,
      cycle: wouldCycle,
      explanation: wouldCycle
        ? `Adding edge (${edge.u}, ${edge.v}) would connect two vertices already joined by the tree, forming a cycle. It is rejected.`
        : `Adding edge (${edge.u}, ${edge.v}) connects two separate components with no cycle. It is added to the Minimum Spanning Tree.`,
      mstEdges: mst.map(e => e.id),
      cost, accepted, rejected,
      remaining: sortedEdges.length - idx - 1,
    });

    // Stop once we have V-1 edges — MST is complete.
    if (mst.length === n - 1) break;
  }

  steps.push({
    phase: 'done',
    title: 'Minimum Spanning Tree complete',
    explanation: `The Minimum Spanning Tree is complete with ${mst.length} edges and a total cost of ${cost}. Any remaining edges are skipped since the tree already connects all ${n} vertices.`,
    mstEdges: mst.map(e => e.id),
    cost, accepted, rejected,
    remaining: 0,
  });

  return { steps, mst, cost, algorithm: 'kruskal', sortedEdges: sortedEdges.map(e => e.id) };
}

window.runKruskalSteps = runKruskalSteps;
