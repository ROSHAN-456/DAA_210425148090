/* ============================================================
   graph.js — renders the graph as SVG, handles drag/zoom/pan,
   and exposes methods to color nodes/edges as steps play.
   ============================================================ */

class GraphRenderer {
  constructor(svgEl, graph) {
    this.svg = svgEl;
    this.graph = cloneGraph(graph);
    this.viewBox = { x: 0, y: 0, w: 800, h: 520 };
    this.scale = 1;
    this.nodeEls = new Map();
    this.edgeEls = new Map();
    this.weightEls = new Map();
    this._drag = null;
    this._pan = null;
    this._build();
    this._wireZoomPan();
  }

  _svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  _build() {
    this.svg.innerHTML = '';
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);

    this.layer = this._svgEl('g', { class: 'graph-layer' });
    this.svg.appendChild(this.layer);

    const edgeLayer = this._svgEl('g', { class: 'edge-layer' });
    const nodeLayer = this._svgEl('g', { class: 'node-layer' });
    this.layer.appendChild(edgeLayer);
    this.layer.appendChild(nodeLayer);

    // Edges
    this.graph.edges.forEach(edge => {
      const u = this.graph.nodes.find(n => n.id === edge.u);
      const v = this.graph.nodes.find(n => n.id === edge.v);

      const group = this._svgEl('g', { class: 'edge', 'data-id': edge.id });
      const line = this._svgEl('line', {
        x1: u.x, y1: u.y, x2: v.x, y2: v.y, class: 'edge-line edge-unvisited',
      });
      const midX = (u.x + v.x) / 2, midY = (u.y + v.y) / 2;
      const label = this._svgEl('g', { class: 'edge-label', transform: `translate(${midX},${midY})` });
      const labelBg = this._svgEl('circle', { r: 15, class: 'edge-label-bg' });
      const labelText = this._svgEl('text', { class: 'edge-label-text', 'text-anchor': 'middle', dy: '0.35em' });
      labelText.textContent = edge.w;
      label.appendChild(labelBg);
      label.appendChild(labelText);

      group.appendChild(line);
      group.appendChild(label);
      edgeLayer.appendChild(group);

      this.edgeEls.set(edge.id, { group, line, label });
    });

    // Nodes
    this.graph.nodes.forEach(node => {
      const group = this._svgEl('g', {
        class: 'node', 'data-id': node.id,
        transform: `translate(${node.x},${node.y})`,
      });
      const circle = this._svgEl('circle', { r: 22, class: 'node-circle node-default' });
      const text = this._svgEl('text', { class: 'node-text', 'text-anchor': 'middle', dy: '0.35em' });
      text.textContent = node.id;

      group.appendChild(circle);
      group.appendChild(text);
      nodeLayer.appendChild(group);

      this.nodeEls.set(node.id, { group, circle });
      this._wireDrag(group, node);
    });
  }

  _clientToSvg(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = this.layer.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
  }

  _wireDrag(group, node) {
    const start = (e) => {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      this._drag = { node, offset: this._clientToSvg(clientX, clientY) };
      group.classList.add('dragging');
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end);
    };
    const move = (e) => {
      if (!this._drag) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const p = this._clientToSvg(clientX, clientY);
      this._drag.node.x = p.x;
      this._drag.node.y = p.y;
      this._reposition(this._drag.node.id);
    };
    const end = () => {
      if (this._drag) this.nodeEls.get(this._drag.node.id).group.classList.remove('dragging');
      this._drag = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
    group.addEventListener('mousedown', start);
    group.addEventListener('touchstart', start, { passive: false });
  }

  _reposition(nodeId) {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    const { group } = this.nodeEls.get(nodeId);
    group.setAttribute('transform', `translate(${node.x},${node.y})`);

    this.graph.edges.forEach(edge => {
      if (edge.u !== nodeId && edge.v !== nodeId) return;
      const u = this.graph.nodes.find(n => n.id === edge.u);
      const v = this.graph.nodes.find(n => n.id === edge.v);
      const { line, label } = this.edgeEls.get(edge.id);
      line.setAttribute('x1', u.x); line.setAttribute('y1', u.y);
      line.setAttribute('x2', v.x); line.setAttribute('y2', v.y);
      const midX = (u.x + v.x) / 2, midY = (u.y + v.y) / 2;
      label.setAttribute('transform', `translate(${midX},${midY})`);
    });
  }

  _wireZoomPan() {
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.08 : 0.92;
      this.zoom(delta);
    }, { passive: false });

    let panning = false, last = null;
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target === this.svg) { panning = true; last = { x: e.clientX, y: e.clientY }; }
    });
    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      const dx = (e.clientX - last.x) * (this.viewBox.w / this.svg.clientWidth);
      const dy = (e.clientY - last.y) * (this.viewBox.h / this.svg.clientHeight);
      this.viewBox.x -= dx; this.viewBox.y -= dy;
      last = { x: e.clientX, y: e.clientY };
      this._applyViewBox();
    });
    window.addEventListener('mouseup', () => { panning = false; });
  }

  _applyViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
  }

  zoom(factor) {
    const newW = Math.max(300, Math.min(2000, this.viewBox.w * factor));
    const newH = newW * (520 / 800);
    this.viewBox.x -= (newW - this.viewBox.w) / 2;
    this.viewBox.y -= (newH - this.viewBox.h) / 2;
    this.viewBox.w = newW; this.viewBox.h = newH;
    this._applyViewBox();
  }

  resetView() {
    this.viewBox = { x: 0, y: 0, w: 800, h: 520 };
    this._applyViewBox();
  }

  // ---- Visual state updates driven by algorithm steps ----------------------
  clearHighlights() {
    this.edgeEls.forEach(({ group, line }) => {
      group.classList.remove('edge-current', 'edge-accepted', 'edge-rejected');
      line.setAttribute('class', 'edge-line edge-unvisited');
    });
    this.nodeEls.forEach(({ circle, group }) => {
      circle.setAttribute('class', 'node-circle node-default');
      group.classList.remove('node-current');
    });
  }

  setEdgeState(edgeId, state) {
    const rec = this.edgeEls.get(edgeId);
    if (!rec) return;
    rec.line.setAttribute('class', `edge-line edge-${state}`);
  }

  setNodeState(nodeId, state) {
    const rec = this.nodeEls.get(nodeId);
    if (!rec) return;
    rec.circle.setAttribute('class', `node-circle node-${state}`);
  }

  applyMstEdges(edgeIds) {
    edgeIds.forEach(id => this.setEdgeState(id, 'accepted'));
  }

  applyVisitedNodes(nodeIds) {
    nodeIds.forEach(id => this.setNodeState(id, 'visited'));
  }
}

window.GraphRenderer = GraphRenderer;
