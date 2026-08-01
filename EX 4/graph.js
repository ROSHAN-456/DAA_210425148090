// ==========================================================================
// graph.js — graph data model + SVG visualization
// ==========================================================================

class GraphView {
  /**
   * @param {SVGSVGElement} svg
   * @param {object} opts { onChange, readOnlyDrag }
   */
  constructor(svg, opts = {}) {
    this.svg = svg;
    this.opts = opts;
    this.vertices = [];
    this.edges = [];
    this.viewBox = { x: 0, y: 0, w: 1200, h: 520 };
    this.nodeRadius = 26;
    this._layers = {};
    this._buildLayers();
    this._bindZoomPan();
    this._dragging = null;
  }

  _buildLayers() {
    this.svg.innerHTML = '';
    this.svg.setAttribute('viewBox', `0 0 ${this.viewBox.w} ${this.viewBox.h}`);

    const defs = Utils.svgEl('defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--edge-color)"></path>
      </marker>
      <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-2)"></path>
      </marker>
      <marker id="arrow-good" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--success)"></path>
      </marker>
      <marker id="arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)"></path>
      </marker>
      <marker id="arrow-path" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="var(--path-color)"></path>
      </marker>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4.5" result="blur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    `;
    this.svg.appendChild(defs);

    this.gRoot = Utils.svgEl('g', { class: 'viewport' });
    this.gEdges = Utils.svgEl('g', { class: 'edges-layer' });
    this.gNodes = Utils.svgEl('g', { class: 'nodes-layer' });
    this.gRoot.appendChild(this.gEdges);
    this.gRoot.appendChild(this.gNodes);
    this.svg.appendChild(this.gRoot);
  }

  setGraph(graph) {
    this.vertices = graph.vertices.map((v) => ({ ...v }));
    this.edges = graph.edges.map((e) => ({ ...e }));
    this.render();
  }

  getGraph() {
    return {
      vertices: this.vertices.map((v) => ({ ...v })),
      edges: this.edges.map((e) => ({ ...e })),
    };
  }

  addVertex() {
    const id = this.vertices.length
      ? Math.max(...this.vertices.map((v) => v.id)) + 1
      : 0;
    const angle = Math.random() * Math.PI * 2;
    const x = this.viewBox.w / 2 + Math.cos(angle) * 180;
    const y = this.viewBox.h / 2 + Math.sin(angle) * 140;
    this.vertices.push({ id, x, y });
    this.render();
    this._notify();
    return id;
  }

  addEdge(from, to, weight) {
    if (from === to) return null;
    if (!this.vertices.some((v) => v.id === from) || !this.vertices.some((v) => v.id === to)) return null;
    const existing = this.edges.find((e) => e.from === from && e.to === to);
    if (existing) {
      existing.weight = weight;
      this.render();
      this._notify();
      return existing.id;
    }
    const id = Utils.nextEdgeId();
    this.edges.push({ id, from, to, weight });
    this.render();
    this._notify();
    return id;
  }

  deleteEdge(edgeId) {
    this.edges = this.edges.filter((e) => e.id !== edgeId);
    this.render();
    this._notify();
  }

  deleteVertex(vertexId) {
    this.vertices = this.vertices.filter((v) => v.id !== vertexId);
    this.edges = this.edges.filter((e) => e.from !== vertexId && e.to !== vertexId);
    this.render();
    this._notify();
  }

  reset(graph) {
    this.setGraph(graph);
    this._notify();
  }

  _notify() {
    if (this.opts.onChange) this.opts.onChange(this.getGraph());
  }

  _edgePath(v1, v2) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const r = this.nodeRadius + 4;
    const x1 = v1.x + ux * r, y1 = v1.y + uy * r;
    const x2 = v2.x - ux * r, y2 = v2.y - uy * r;
    return { x1, y1, x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
  }

  render(highlight = {}) {
    this.gEdges.innerHTML = '';
    this.gNodes.innerHTML = '';

    const { visited = new Set(), current = null, source = null, dest = null,
      activeEdge = null, goodEdge = null, badEdge = null, pathEdges = new Set() } = highlight;

    this.edges.forEach((e) => {
      const v1 = this.vertices.find((v) => v.id === e.from);
      const v2 = this.vertices.find((v) => v.id === e.to);
      if (!v1 || !v2) return;
      const { x1, y1, x2, y2, mx, my } = this._edgePath(v1, v2);

      let cls = 'edge-line';
      let marker = 'url(#arrow)';
      if (pathEdges.has(e.id)) { cls += ' edge-path'; marker = 'url(#arrow-path)'; }
      else if (goodEdge === e.id) { cls += ' edge-good'; marker = 'url(#arrow-good)'; }
      else if (badEdge === e.id) { cls += ' edge-bad'; marker = 'url(#arrow-bad)'; }
      else if (activeEdge === e.id) { cls += ' edge-active'; marker = 'url(#arrow-active)'; }

      const line = Utils.svgEl('line', {
        x1, y1, x2, y2, class: cls, 'marker-end': marker, 'data-edge-id': e.id,
      });
      this.gEdges.appendChild(line);

      const labelBg = Utils.svgEl('circle', { cx: mx, cy: my, r: 13, class: 'edge-weight-bg' });
      const label = Utils.svgEl('text', { x: mx, y: my + 4, class: 'edge-weight-label' });
      label.textContent = e.weight;
      this.gEdges.appendChild(labelBg);
      this.gEdges.appendChild(label);

      if (this.opts.editable) {
        const hit = Utils.svgEl('line', {
          x1, y1, x2, y2, class: 'edge-hit', 'data-edge-id': e.id,
        });
        hit.addEventListener('click', () => this.opts.onEdgeClick && this.opts.onEdgeClick(e));
        this.gEdges.appendChild(hit);
      }
    });

    this.vertices.forEach((v) => {
      const g = Utils.svgEl('g', { class: 'node-group', 'data-vertex-id': v.id, transform: `translate(${v.x},${v.y})` });

      let cls = 'node-circle';
      if (v.id === source) cls += ' node-source';
      if (v.id === dest) cls += ' node-dest';
      if (v.id === current) cls += ' node-current';
      else if (visited.has(v.id)) cls += ' node-visited';

      const circle = Utils.svgEl('circle', { r: this.nodeRadius, class: cls });
      const text = Utils.svgEl('text', { class: 'node-label', y: 5 });
      text.textContent = v.id;

      g.appendChild(circle);
      g.appendChild(text);

      if (v.id === source || v.id === dest) {
        const badge = Utils.svgEl('text', { class: 'node-badge', y: -this.nodeRadius - 10 });
        badge.textContent = v.id === source ? 'SRC' : 'DEST';
        g.appendChild(badge);
      }

      g.addEventListener('pointerdown', (ev) => this._startDrag(ev, v));
      this.gNodes.appendChild(g);
    });
  }

  _startDrag(ev, vertex) {
    ev.stopPropagation();
    this._dragging = vertex;
    const move = (e2) => {
      const pt = this._clientToSvg(e2.clientX, e2.clientY);
      vertex.x = pt.x;
      vertex.y = pt.y;
      this.render(this._lastHighlight);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this._dragging = null;
      this._notify();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  _clientToSvg(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return {
      x: this.viewBox.x + nx * this.viewBox.w,
      y: this.viewBox.y + ny * this.viewBox.h,
    };
  }

  renderWithHighlight(h) {
    this._lastHighlight = h;
    this.render(h);
  }

  _bindZoomPan() {
    let panning = false;
    let last = null;

    this.svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const scale = ev.deltaY > 0 ? 1.1 : 0.9;
      const rect = this.svg.getBoundingClientRect();
      const cx = this.viewBox.x + ((ev.clientX - rect.left) / rect.width) * this.viewBox.w;
      const cy = this.viewBox.y + ((ev.clientY - rect.top) / rect.height) * this.viewBox.h;
      const newW = Utils.clamp(this.viewBox.w * scale, 300, 4000);
      const newH = newW * (this.viewBox.h / this.viewBox.w);
      this.viewBox.x = cx - ((cx - this.viewBox.x) / this.viewBox.w) * newW;
      this.viewBox.y = cy - ((cy - this.viewBox.y) / this.viewBox.h) * newH;
      this.viewBox.w = newW;
      this.viewBox.h = newH;
      this._applyViewBox();
    }, { passive: false });

    this.svg.addEventListener('pointerdown', (ev) => {
      if (this._dragging) return;
      if (ev.target !== this.svg && !ev.target.classList.contains('viewport')) return;
      panning = true;
      last = { x: ev.clientX, y: ev.clientY };
    });
    window.addEventListener('pointermove', (ev) => {
      if (!panning) return;
      const rect = this.svg.getBoundingClientRect();
      const dx = ((ev.clientX - last.x) / rect.width) * this.viewBox.w;
      const dy = ((ev.clientY - last.y) / rect.height) * this.viewBox.h;
      this.viewBox.x -= dx;
      this.viewBox.y -= dy;
      last = { x: ev.clientX, y: ev.clientY };
      this._applyViewBox();
    });
    window.addEventListener('pointerup', () => { panning = false; });
  }

  _applyViewBox() {
    this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
  }

  resetView() {
    this.viewBox = { x: 0, y: 0, w: 1200, h: 520 };
    this._applyViewBox();
  }

  zoomBy(factor) {
    const cx = this.viewBox.x + this.viewBox.w / 2;
    const cy = this.viewBox.y + this.viewBox.h / 2;
    const newW = Utils.clamp(this.viewBox.w * factor, 300, 4000);
    const newH = newW * (this.viewBox.h / this.viewBox.w);
    this.viewBox.x = cx - newW / 2;
    this.viewBox.y = cy - newH / 2;
    this.viewBox.w = newW;
    this.viewBox.h = newH;
    this._applyViewBox();
  }
}
