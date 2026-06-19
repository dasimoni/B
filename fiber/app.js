/*
 * app.js — Render the human fiber-count circuit diagram + interactions
 * -------------------------------------------------------------------
 * Pure DOM/SVG, no libraries. Edge THICKNESS encodes the measured fiber count
 * (log scale); edges with no measured count are drawn thin and dashed and
 * labeled "not measured". Hover/click a nerve to read its tract name, fiber
 * count, and literature citation.
 */

(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";

  // Fiber count → stroke width (px), log-scaled across ~30k … 200M.
  const LOG_MIN = 4.0; // log10(10,000)
  const LOG_MAX = 8.4; // log10(~250,000,000)
  const W_MIN = 2.5;
  const W_MAX = 26;
  function strokeWidth(fibers) {
    if (!fibers) return 1.3; // not measured
    const t = Math.log10(fibers);
    const f = Math.max(0, Math.min(1, (t - LOG_MIN) / (LOG_MAX - LOG_MIN)));
    return W_MIN + f * (W_MAX - W_MIN);
  }

  const state = {
    activeSystems: new Set(Object.keys(BRAIN.SYSTEMS)),
    showLabels: true,
    showUnmeasured: true,
    focus: null,
  };

  let L, svg, gEdges, gNodes, gBands, gLabels;
  const nodeEls = new Map();
  const edgeEls = [];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function neighborsOf(id) {
    const set = new Set();
    L.edges.forEach((e) => {
      if (e.source === id) set.add(e.target);
      if (e.target === id) set.add(e.source);
    });
    return set;
  }

  function edgeVisible(e) {
    if (!e.fibers && !state.showUnmeasured) return false;
    const s = L.byId.get(e.source), t = L.byId.get(e.target);
    return state.activeSystems.has(s.system) && state.activeSystems.has(t.system);
  }
  function nodeVisible(n) {
    return state.activeSystems.has(n.system);
  }

  function build() {
    L = Layout.computeLayout(BRAIN, { nodeW: 168, hGap: 30, vGap: 104 });

    const wrap = document.getElementById("canvas");
    wrap.innerHTML = "";
    svg = el("svg", { viewBox: `0 0 ${L.width} ${L.height}`, id: "graph" }, wrap);

    gBands = el("g", { class: "bands" }, svg);
    gEdges = el("g", { class: "edges" }, svg);
    gLabels = el("g", { class: "edge-labels" }, svg);
    gNodes = el("g", { class: "nodes" }, svg);

    // Layer bands
    L.layers.forEach((ids, i) => {
      const y = L.padY + i * (L.nodeH + L.vGap) - L.vGap / 2;
      el("rect", { x: 0, y: y, width: L.width, height: L.nodeH + L.vGap,
        class: "band", fill: i % 2 ? "#0f1620" : "#121b27" }, gBands);
      const tx = el("text", { x: 12, y: y + (L.nodeH + L.vGap) / 2, class: "band-label" }, gBands);
      tx.textContent = `${i}  ${BRAIN.LAYERS[i]}`;
    });

    // Edges
    L.edges.forEach((e) => {
      const s = L.byId.get(e.source), t = L.byId.get(e.target);
      const measured = !!e.fibers;
      const path = el("path", {
        class: "edge" + (measured ? "" : " edge-unmeasured"),
        "stroke-width": strokeWidth(e.fibers),
        "stroke-dasharray": measured ? "" : "4,5",
      }, gEdges);
      path.setAttribute("d", edgePath(s, t));
      path.style.stroke = BRAIN.SYSTEMS[s.system].color;
      path.addEventListener("mouseenter", () => { if (!state.focus) highlightEdge(e); });
      path.addEventListener("mouseleave", () => { if (!state.focus) clearHighlight(); });
      path.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.focus = "edge:" + L.edges.indexOf(e);
        highlightEdge(e); showEdgeInfo(e); syncFocus();
      });

      // Fiber-count label at edge midpoint (only for measured edges)
      let label = null;
      if (measured) {
        const m = edgeMidpoint(s, t);
        const g = el("g", { class: "fiber-label", transform: `translate(${m.x},${m.y})` }, gLabels);
        const txt = e.fiberLabel || e.fibers.toLocaleString();
        const w = txt.length * 6.2 + 12;
        el("rect", { x: -w / 2, y: -9, width: w, height: 18, rx: 4, class: "fiber-bg" }, g);
        const tt = el("text", { x: 0, y: 4, class: "fiber-text" }, g);
        tt.textContent = txt;
        label = g;
      }

      edgeEls.push({ path, label, e, measured });
    });

    // Nodes
    L.nodes.forEach((n) => {
      const sys = BRAIN.SYSTEMS[n.system];
      const g = el("g", { class: "node", transform: `translate(${n.x},${n.y})` }, gNodes);
      el("rect", { width: n.w, height: n.h, rx: 6, class: "node-box", fill: sys.color }, g);
      const t = el("text", { x: n.w / 2, y: n.h / 2 + 4, class: "node-label" }, g);
      t.textContent = n.label;
      g.addEventListener("mouseenter", () => { if (!state.focus) highlightNode(n.id); });
      g.addEventListener("mouseleave", () => { if (!state.focus) clearHighlight(); });
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.focus = state.focus === "node:" + n.id ? null : "node:" + n.id;
        if (state.focus) { highlightNode(n.id); showNodeInfo(n); }
        else { clearHighlight(); hideInfo(); }
        syncFocus();
      });
      nodeEls.set(n.id, g);
    });

    svg.addEventListener("click", () => {
      if (state.focus) { state.focus = null; clearHighlight(); hideInfo(); syncFocus(); }
    });

    applyFilters();
  }

  // ---- geometry ----
  function edgePath(s, t) {
    if (s.layer === t.layer) {
      // commissural / same-layer: bow downward beneath the two boxes
      const x1 = s.cx, x2 = t.cx, yb = s.y + s.h, dip = yb + 46;
      return `M${x1},${yb} C${x1},${dip} ${x2},${dip} ${x2},${yb}`;
    }
    const x1 = s.cx, y1 = s.y + (t.layer >= s.layer ? s.h : 0);
    const x2 = t.cx, y2 = t.y + (t.layer >= s.layer ? 0 : t.h);
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }
  function edgeMidpoint(s, t) {
    if (s.layer === t.layer) return { x: (s.cx + t.cx) / 2, y: s.y + s.h + 40 };
    return { x: (s.cx + t.cx) / 2, y: (s.cy + t.cy) / 2 };
  }

  // ---- highlighting ----
  function highlightNode(id) {
    const nbrs = neighborsOf(id); nbrs.add(id);
    nodeEls.forEach((g, nid) => {
      g.classList.toggle("dim", !nbrs.has(nid));
      g.classList.toggle("hot", nid === id);
    });
    edgeEls.forEach((o) => {
      const on = o.e.source === id || o.e.target === id;
      o.path.classList.toggle("edge-hot", on);
      o.path.classList.toggle("edge-dim", !on);
      if (o.label) o.label.classList.toggle("lbl-dim", !on);
    });
  }
  function highlightEdge(e) {
    const ends = new Set([e.source, e.target]);
    nodeEls.forEach((g, nid) => {
      g.classList.toggle("dim", !ends.has(nid));
      g.classList.toggle("hot", ends.has(nid));
    });
    edgeEls.forEach((o) => {
      const on = o.e === e;
      o.path.classList.toggle("edge-hot", on);
      o.path.classList.toggle("edge-dim", !on);
      if (o.label) o.label.classList.toggle("lbl-dim", !on);
    });
  }
  function clearHighlight() {
    nodeEls.forEach((g) => g.classList.remove("dim", "hot"));
    edgeEls.forEach((o) => {
      o.path.classList.remove("edge-hot", "edge-dim");
      if (o.label) o.label.classList.remove("lbl-dim");
    });
  }

  // ---- info panel ----
  function showNodeInfo(n) {
    const sys = BRAIN.SYSTEMS[n.system];
    const out = L.edges.filter((e) => e.source === n.id);
    const inc = L.edges.filter((e) => e.target === n.id);
    const row = (e, dir) => {
      const other = L.byId.get(dir === "out" ? e.target : e.source);
      const count = e.fibers ? `<span class="count">${e.fiberLabel}</span>` : `<span class="muted">not measured</span>`;
      return `<li><span class="tract">${e.tract}</span> ${dir === "out" ? "→" : "←"} ${other.label}<br>${count}</li>`;
    };
    setInfo(
      `<div class="info-head"><span class="swatch" style="background:${sys.color}"></span><strong>${n.label}</strong></div>` +
      `<div class="info-sub">${sys.name} · Layer ${n.layer} — ${BRAIN.LAYERS[n.layer]}</div>` +
      `<p class="info-body">${n.info || ""}</p>` +
      `<h4>Outgoing nerves</h4><ul>${out.map((e) => row(e, "out")).join("") || "<li class='muted'>none</li>"}</ul>` +
      `<h4>Incoming nerves</h4><ul>${inc.map((e) => row(e, "in")).join("") || "<li class='muted'>none</li>"}</ul>`
    );
  }
  function showEdgeInfo(e) {
    const s = L.byId.get(e.source), t = L.byId.get(e.target);
    const cite = e.ref && BRAIN.CITATIONS[e.ref];
    const citeHtml = e.fibers
      ? `<div class="cite"><strong>Measured count:</strong> ${e.fiberLabel}<br>` +
        (cite ? `<span class="muted">Source: ${cite.url ? `<a href="${cite.url}" target="_blank" rel="noopener">${cite.text}</a>` : cite.text}</span>` : "") + `</div>`
      : `<div class="cite muted">Fiber count not measured in the literature — drawn thin & dashed.</div>`;
    setInfo(
      `<div class="info-head"><strong>${e.tract}</strong></div>` +
      `<div class="info-sub">${s.label} &nbsp;→&nbsp; ${t.label}</div>` +
      (e.info ? `<p class="info-body">${e.info}</p>` : "") +
      citeHtml
    );
  }
  function setInfo(html) {
    const p = document.getElementById("info");
    p.innerHTML = html; p.classList.add("open");
  }
  function hideInfo() { document.getElementById("info").classList.remove("open"); }
  function syncFocus() { document.body.classList.toggle("has-focus", !!state.focus); }

  function applyFilters() {
    L.nodes.forEach((n) => { nodeEls.get(n.id).style.display = nodeVisible(n) ? "" : "none"; });
    edgeEls.forEach((o) => {
      const vis = edgeVisible(o.e);
      o.path.style.display = vis ? "" : "none";
      if (o.label) o.label.style.display = vis && state.showLabels ? "" : "none";
    });
  }

  // ---- controls / legend ----
  function buildControls() {
    const sysWrap = document.getElementById("system-filters");
    Object.entries(BRAIN.SYSTEMS).forEach(([key, s]) => {
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML = `<input type="checkbox" checked><span class="swatch" style="background:${s.color}"></span>${s.name}`;
      label.querySelector("input").addEventListener("change", (ev) => {
        ev.target.checked ? state.activeSystems.add(key) : state.activeSystems.delete(key);
        applyFilters();
      });
      sysWrap.appendChild(label);
    });

    document.getElementById("toggle-labels").addEventListener("change", (e) => {
      state.showLabels = e.target.checked; applyFilters();
    });
    document.getElementById("toggle-unmeasured").addEventListener("change", (e) => {
      state.showUnmeasured = e.target.checked; applyFilters();
    });
    document.getElementById("reset").addEventListener("click", () => {
      state.activeSystems = new Set(Object.keys(BRAIN.SYSTEMS));
      state.focus = null;
      document.querySelectorAll("#system-filters input").forEach((i) => (i.checked = true));
      clearHighlight(); hideInfo(); syncFocus(); applyFilters();
    });

    // Thickness legend (sample cables)
    const samples = [
      { f: 30000, t: "~30k (cochlear nerve)" },
      { f: 1000000, t: "~1M (optic / corticospinal)" },
      { f: 200000000, t: "~200M (corpus callosum)" },
    ];
    const lg = document.getElementById("thickness-legend");
    samples.forEach((sm) => {
      const row = document.createElement("div");
      row.className = "tl-row";
      row.innerHTML =
        `<svg width="60" height="${W_MAX + 4}"><line x1="2" y1="${(W_MAX + 4) / 2}" x2="58" y2="${(W_MAX + 4) / 2}" stroke="#9aa5b1" stroke-width="${strokeWidth(sm.f)}" stroke-linecap="round"/></svg>` +
        `<span>${sm.t}</span>`;
      lg.appendChild(row);
    });
    const dash = document.createElement("div");
    dash.className = "tl-row";
    dash.innerHTML = `<svg width="60" height="16"><line x1="2" y1="8" x2="58" y2="8" stroke="#6b7785" stroke-width="1.3" stroke-dasharray="4,5"/></svg><span class="muted">not measured</span>`;
    lg.appendChild(dash);

    // Sources
    const src = document.getElementById("sources");
    Object.values(BRAIN.CITATIONS).forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${c.text}</a>` : c.text;
      src.appendChild(li);
    });
  }

  document.addEventListener("DOMContentLoaded", () => { buildControls(); build(); });
})();
