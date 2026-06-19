/*
 * app.js — Render the layered brain-connectivity graph + interactions
 * -------------------------------------------------------------------
 * Pure DOM/SVG, no libraries. Draws layer bands, curved edges, and labeled
 * nodes; wires up hover/click highlighting, a focus mode, an info panel, and
 * filters for functional systems and edge kinds.
 */

(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const EDGE_KINDS = {
    feedforward: { name: "Feed-forward", dash: null, color: "#9aa5b1" },
    feedback:    { name: "Feedback",     dash: "5,4", color: "#c98fd0" },
    modulatory:  { name: "Modulatory",   dash: "2,4", color: "#e8a23d" },
    commissural: { name: "Commissural",  dash: "8,3", color: "#74c0fc" },
  };

  const state = {
    activeSystems: new Set(Object.keys(BRAIN.SYSTEMS)),
    activeKinds: new Set(Object.keys(EDGE_KINDS)),
    focus: null, // node id pinned by click
  };

  let L, svg, gEdges, gNodes, gBands;
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
    if (!state.activeKinds.has(e.kind)) return false;
    const s = L.byId.get(e.source),
      t = L.byId.get(e.target);
    return state.activeSystems.has(s.system) && state.activeSystems.has(t.system);
  }

  function nodeVisible(n) {
    return state.activeSystems.has(n.system);
  }

  function build() {
    L = Layout.computeLayout(BRAIN, {});

    const wrap = document.getElementById("canvas");
    wrap.innerHTML = "";
    svg = el("svg", { viewBox: `0 0 ${L.width} ${L.height}`, id: "graph" }, wrap);

    // arrowhead marker
    const defs = el("defs", null, svg);
    const mk = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "#9aa5b1" }, mk);

    gBands = el("g", { class: "bands" }, svg);
    gEdges = el("g", { class: "edges" }, svg);
    gNodes = el("g", { class: "nodes" }, svg);

    // Layer bands + labels
    L.layers.forEach((ids, i) => {
      const y = L.padY + i * (L.nodeH + L.vGap) - L.vGap / 2;
      el("rect", { x: 0, y: y, width: L.width, height: L.nodeH + L.vGap,
        class: "band", fill: i % 2 ? "#0f1620" : "#121b27" }, gBands);
      const tx = el("text", { x: 10, y: y + (L.nodeH + L.vGap) / 2,
        class: "band-label" }, gBands);
      tx.textContent = `${i}  ${BRAIN.LAYERS[i]}`;
    });

    // Edges (curved cubic beziers, drawn before nodes)
    L.edges.forEach((e) => {
      const s = L.byId.get(e.source),
        t = L.byId.get(e.target);
      const kind = EDGE_KINDS[e.kind] || EDGE_KINDS.feedforward;
      const path = el("path", { class: "edge", "data-source": e.source,
        "data-target": e.target, stroke: kind.color,
        "stroke-dasharray": kind.dash || "" }, gEdges);
      path.setAttribute("d", edgePath(s, t));
      const ttl = el("title", null, path);
      ttl.textContent = `${s.label} → ${t.label}\n${e.tract} (${kind.name})` +
        (e.info ? `\n${e.info}` : "");
      edgeEls.push({ path, e });
    });

    // Nodes
    L.nodes.forEach((n) => {
      const sys = BRAIN.SYSTEMS[n.system];
      const g = el("g", { class: "node", "data-id": n.id,
        transform: `translate(${n.x},${n.y})` }, gNodes);
      el("rect", { width: n.w, height: n.h, rx: 6, ry: 6,
        class: "node-box", fill: sys.color }, g);
      const t = el("text", { x: n.w / 2, y: n.h / 2 + 4, class: "node-label" }, g);
      t.textContent = n.label;
      g.addEventListener("mouseenter", () => { if (!state.focus) highlight(n.id); });
      g.addEventListener("mouseleave", () => { if (!state.focus) clearHighlight(); });
      g.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.focus = state.focus === n.id ? null : n.id;
        if (state.focus) { highlight(n.id); showInfo(n); }
        else { clearHighlight(); hideInfo(); }
        syncFocusButton();
      });
      nodeEls.set(n.id, g);
    });

    svg.addEventListener("click", () => {
      if (state.focus) { state.focus = null; clearHighlight(); hideInfo(); syncFocusButton(); }
    });

    document.getElementById("crossings").textContent = L.crossings;
    applyFilters();
  }

  // Cubic bezier that bows vertically between two node centers.
  function edgePath(s, t) {
    const x1 = s.cx, y1 = s.y + (t.layer >= s.layer ? s.h : 0);
    const x2 = t.cx, y2 = t.y + (t.layer >= s.layer ? 0 : t.h);
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }

  function highlight(id) {
    const nbrs = neighborsOf(id);
    nbrs.add(id);
    nodeEls.forEach((g, nid) => {
      g.classList.toggle("dim", !nbrs.has(nid));
      g.classList.toggle("hot", nid === id);
    });
    edgeEls.forEach(({ path, e }) => {
      const on = e.source === id || e.target === id;
      path.classList.toggle("edge-hot", on);
      path.classList.toggle("edge-dim", !on);
    });
  }

  function clearHighlight() {
    nodeEls.forEach((g) => g.classList.remove("dim", "hot"));
    edgeEls.forEach(({ path }) => path.classList.remove("edge-hot", "edge-dim"));
  }

  function showInfo(n) {
    const panel = document.getElementById("info");
    const sys = BRAIN.SYSTEMS[n.system];
    const outgoing = L.edges.filter((e) => e.source === n.id);
    const incoming = L.edges.filter((e) => e.target === n.id);
    const list = (arr, dir) =>
      arr.map((e) => {
        const other = L.byId.get(dir === "out" ? e.target : e.source);
        return `<li><span class="tract">${e.tract}</span> ${dir === "out" ? "→" : "←"} ${other.label}</li>`;
      }).join("") || "<li class='muted'>none</li>";

    panel.innerHTML =
      `<div class="info-head"><span class="swatch" style="background:${sys.color}"></span>` +
      `<strong>${n.label}</strong></div>` +
      `<div class="info-sub">${sys.name} · Layer ${n.layer} — ${BRAIN.LAYERS[n.layer]}</div>` +
      `<p class="info-body">${n.info || ""}</p>` +
      `<div class="info-cols"><div><h4>Projects to</h4><ul>${list(outgoing, "out")}</ul></div>` +
      `<div><h4>Receives from</h4><ul>${list(incoming, "in")}</ul></div></div>`;
    panel.classList.add("open");
  }

  function hideInfo() {
    document.getElementById("info").classList.remove("open");
  }

  function syncFocusButton() {
    document.body.classList.toggle("has-focus", !!state.focus);
  }

  function applyFilters() {
    L.nodes.forEach((n) => {
      const g = nodeEls.get(n.id);
      g.style.display = nodeVisible(n) ? "" : "none";
    });
    edgeEls.forEach(({ path, e }) => {
      path.style.display = edgeVisible(e) ? "" : "none";
    });
  }

  // --- Controls ---
  function buildControls() {
    const sysWrap = document.getElementById("system-filters");
    Object.entries(BRAIN.SYSTEMS).forEach(([key, s]) => {
      const id = "sys-" + key;
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML =
        `<input type="checkbox" id="${id}" checked>` +
        `<span class="swatch" style="background:${s.color}"></span>${s.name}`;
      label.querySelector("input").addEventListener("change", (ev) => {
        if (ev.target.checked) state.activeSystems.add(key);
        else state.activeSystems.delete(key);
        applyFilters();
      });
      sysWrap.appendChild(label);
    });

    const kindWrap = document.getElementById("kind-filters");
    Object.entries(EDGE_KINDS).forEach(([key, k]) => {
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML =
        `<input type="checkbox" checked>` +
        `<span class="line-swatch" style="border-color:${k.color};${k.dash ? "border-style:dashed" : ""}"></span>${k.name}`;
      label.querySelector("input").addEventListener("change", (ev) => {
        if (ev.target.checked) state.activeKinds.add(key);
        else state.activeKinds.delete(key);
        applyFilters();
      });
      kindWrap.appendChild(label);
    });

    document.getElementById("reset").addEventListener("click", () => {
      state.activeSystems = new Set(Object.keys(BRAIN.SYSTEMS));
      state.activeKinds = new Set(Object.keys(EDGE_KINDS));
      state.focus = null;
      document.querySelectorAll("#system-filters input, #kind-filters input")
        .forEach((i) => (i.checked = true));
      clearHighlight();
      hideInfo();
      syncFocusButton();
      applyFilters();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildControls();
    build();
  });
})();
