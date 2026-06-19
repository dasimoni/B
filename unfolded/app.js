/*
 * app.js — Render "The Unfolded Nervous System"
 * ---------------------------------------------
 * Draws two continuous cortical sheets (hemispheres) with adjoining area
 * patches, the sense organs around the edge, subcortical relays, and every
 * class of wiring (sensory afferents, thalamic relays, cortico-cortical,
 * feedback, corpus callosum, motor output) — each visually distinct.
 */

(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const A = window.ANATOMY;
  const W = 1500, H = 1080;

  // fiber count → stroke width (log scale)
  function strokeW(fibers, base) {
    if (!fibers) return base || 2.6;
    const t = Math.log10(fibers);
    return 2.5 + Math.max(0, Math.min(1, (t - 4) / 4.4)) * 11.5;
  }

  const state = {
    layers: { sensory: true, cortico: true, feedback: true, callosum: true },
    showLabels: true, showCounts: true, focus: null,
  };

  let svg, gWire = {}, posMap = new Map();
  const areaEls = new Map();   // "id:Side" -> <g>
  const organEls = new Map();
  const wires = [];            // { el, label, from, to, kind }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- geometry resolution ----
  function patchRect(area, hemi) {
    const x = hemi.mirror ? hemi.ox + 360 - area.x - area.w : hemi.ox + area.x;
    const y = hemi.oy + area.y;
    return { x, y, w: area.w, h: area.h, cx: x + area.w / 2, cy: y + area.h / 2 };
  }
  function resolve(ref) {
    return posMap.get(ref);
  }

  function buildPositions() {
    posMap.clear();
    A.HEMIS.forEach((hemi) => {
      A.AREA_DEFS.forEach((area) => {
        const r = patchRect(area, hemi);
        posMap.set(area.id + ":" + hemi.side, { x: r.cx, y: r.cy, rect: r, area, hemi });
      });
    });
    A.RELAYS.forEach((r) => posMap.set(r.id, { x: r.x, y: r.y, relay: r }));
    A.ORGANS.forEach((o) => posMap.set(o.id, { x: o.x, y: o.y, organ: o }));
  }

  // quadratic arc with perpendicular bow
  function wirePath(a, b, bow) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * bow, oy = (dx / len) * bow;
    return `M${a.x},${a.y} Q${mx + ox},${my + oy} ${b.x},${b.y}`;
  }

  function build() {
    buildPositions();
    const wrap = document.getElementById("canvas");
    wrap.innerHTML = "";
    svg = el("svg", { viewBox: `0 0 ${W} ${H}`, id: "scene" }, wrap);

    // defs: hemisphere clips + arrow markers
    const defs = el("defs", null, svg);
    A.HEMIS.forEach((hemi) => {
      const cp = el("clipPath", { id: "clip-" + hemi.side }, defs);
      el("ellipse", { cx: hemi.ox + 180, cy: hemi.oy + 180, rx: 184, ry: 192 }, cp);
    });
    mkArrow(defs, "arrow-ff", "#aeb8c4");
    mkArrow(defs, "arrow-fb", "#cd7fe0");

    // wire layer groups (drawn under cortex so sheets sit on top of subcortical wires,
    // but cortico/feedback go above). Order: callosum, sensory, motor, then cortex, then cortico/feedback.
    const gCallosum = el("g", { class: "layer-callosum" }, svg);
    const gSensory = el("g", { class: "layer-sensory" }, svg);
    const gMotor = el("g", { class: "layer-motor" }, svg);
    const gRelays = el("g", { class: "relays" }, svg);
    const gCortexL = el("g", null, svg);
    const gCortexR = el("g", null, svg);
    const gCortico = el("g", { class: "layer-cortico" }, svg);
    const gFeedback = el("g", { class: "layer-feedback" }, svg);
    const gOrgans = el("g", { class: "organs" }, svg);
    const gLabels = el("g", { class: "wire-labels" }, svg);
    gWire = { callosum: gCallosum, sensory: gSensory, motor: gMotor, cortico: gCortico, feedback: gFeedback, labels: gLabels };

    drawHemisphere(A.HEMIS[0], gCortexL);
    drawHemisphere(A.HEMIS[1], gCortexR);
    drawRelays(gRelays);
    drawOrgans(gOrgans);

    // ---- wiring ----
    A.SENSORY.forEach((w) => addWire(w, gSensory, sysColor(w.system), bowFor(w), state.layers.sensory ? "" : "none"));
    A.MOTOR.forEach((w) => addWire(w, gMotor, "#FF9D4D", bowFor(w), state.layers.sensory ? "" : "none"));

    // corpus callosum — fan of arcs between homologous areas, bowing up
    A.CALLOSUM_AREAS.forEach((id) => {
      addWire({ from: id + ":L", to: id + ":R", kind: "callosum", system: "callosum",
        tract: "Corpus callosum", fibers: 200000000, fiberLabel: "~200,000,000 (whole tract)", ref: "callosum" },
        gCallosum, "#36CFC9", -120, state.layers.callosum ? "" : "none");
    });

    // cortico-cortical + feedback, both hemispheres
    A.HEMIS.forEach((hemi) => {
      A.CORTICO_PAIRS.forEach(([s, t, note]) =>
        addWire({ from: s + ":" + hemi.side, to: t + ":" + hemi.side, kind: "cortico",
          system: posMap.get(s + ":" + hemi.side).area.system, tract: note || "cortico-cortical" },
          gCortico, A.WIRE_KINDS.cortico.color, 26, state.layers.cortico ? "" : "none"));
      A.FEEDBACK_PAIRS.forEach(([s, t, note]) =>
        addWire({ from: s + ":" + hemi.side, to: t + ":" + hemi.side, kind: "feedback",
          system: "feedback", tract: note || "feedback projection" },
          gFeedback, A.WIRE_KINDS.feedback.color, -46, state.layers.feedback ? "" : "none"));
    });

    svg.addEventListener("click", () => { if (state.focus) { state.focus = null; clearHi(); hideInfo(); } });
    applyLabels();
  }

  function mkArrow(defs, id, color) {
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: "8", refY: "5",
      markerWidth: "5", markerHeight: "5", orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: color }, m);
  }

  function sysColor(sys) { return (A.SYSTEMS[sys] && A.SYSTEMS[sys].color) || "#9aa5b1"; }
  function bowFor(w) {
    if (w.kind === "relay") return 14;
    if (w.kind === "motor") return 10;
    return 8;
  }

  // ---- cortex ----
  function drawHemisphere(hemi, g) {
    // sheet backdrop
    el("ellipse", { cx: hemi.ox + 180, cy: hemi.oy + 180, rx: 184, ry: 192,
      class: "sheet" }, g);
    const clip = el("g", { "clip-path": `url(#clip-${hemi.side})` }, g);

    A.AREA_DEFS.forEach((area) => {
      const r = patchRect(area, hemi);
      const key = area.id + ":" + hemi.side;
      const ng = el("g", { class: "area", "data-key": key }, clip);
      el("rect", { x: r.x, y: r.y, width: r.w, height: r.h, class: "patch",
        fill: sysColor(area.system) }, ng);
      const t = el("text", { x: r.cx, y: r.cy + 4, class: "patch-label" }, ng);
      t.textContent = area.short;
      ng.addEventListener("mouseenter", () => { if (!state.focus) highlight(key); });
      ng.addEventListener("mouseleave", () => { if (!state.focus) clearHi(); });
      ng.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.focus = state.focus === key ? null : key;
        if (state.focus) { highlight(key); showAreaInfo(key); } else { clearHi(); hideInfo(); }
      });
      areaEls.set(key, ng);
    });

    // organic outline on top
    el("ellipse", { cx: hemi.ox + 180, cy: hemi.oy + 180, rx: 184, ry: 192,
      class: "sheet-outline" }, g);
    // emphasize the central sulcus (M1 | S1 border)
    const m1 = patchRect(A.AREA_DEFS.find((a) => a.id === "m1"), hemi);
    el("line", { x1: hemi.mirror ? m1.x : m1.x + m1.w, y1: m1.y,
      x2: hemi.mirror ? m1.x : m1.x + m1.w, y2: m1.y + m1.h,
      class: "central-sulcus" }, g);
    // hemisphere title
    const tt = el("text", { x: hemi.ox + 180, y: hemi.oy - 14, class: "hemi-title" }, g);
    tt.textContent = hemi.side === "L" ? "Left hemisphere" : "Right hemisphere";
  }

  function drawRelays(g) {
    A.RELAYS.forEach((r) => {
      const ng = el("g", { class: "relay" }, g);
      el("rect", { x: r.x - 30, y: r.y - 11, width: 60, height: 22, rx: 6, class: "relay-box" }, ng);
      const t = el("text", { x: r.x, y: r.y + 4, class: "relay-label" }, ng);
      t.textContent = r.label;
    });
  }

  function drawOrgans(g) {
    A.ORGANS.forEach((o) => {
      const ng = el("g", { class: "organ", "data-id": o.id }, g);
      const ic = el("text", { x: o.x, y: o.y, class: "organ-icon" }, ng);
      ic.textContent = o.icon;
      const t = el("text", { x: o.x, y: o.y + 26, class: "organ-label" }, ng);
      t.textContent = o.label;
      ng.addEventListener("mouseenter", () => { if (!state.focus) highlight(o.id); });
      ng.addEventListener("mouseleave", () => { if (!state.focus) clearHi(); });
      ng.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.focus = state.focus === o.id ? null : o.id;
        if (state.focus) { highlight(o.id); showOrganInfo(o); } else { clearHi(); hideInfo(); }
      });
      organEls.set(o.id, ng);
    });
  }

  // ---- wires ----
  function addWire(w, g, color, bow, display) {
    const a = resolve(w.from), b = resolve(w.to);
    if (!a || !b) return;
    const measured = !!w.fibers;
    const kind = A.WIRE_KINDS[w.kind] || {};
    const path = el("path", {
      class: "wire wire-" + w.kind,
      d: wirePath(a, b, bow),
      stroke: color,
      "stroke-width": w.kind === "cortico" ? 1.5 : w.kind === "feedback" ? 1.5 : w.kind === "callosum" ? 2.4 : strokeW(w.fibers),
      "stroke-dasharray": kind.dash || (w.kind === "relay" ? "" : ""),
      fill: "none",
    }, g);
    path.style.display = display;
    if (w.kind === "cortico") path.setAttribute("marker-end", "url(#arrow-ff)");
    if (w.kind === "feedback") path.setAttribute("marker-end", "url(#arrow-fb)");

    path.addEventListener("mouseenter", () => { if (!state.focus) hiWire(rec); });
    path.addEventListener("mouseleave", () => { if (!state.focus) clearHi(); });
    path.addEventListener("click", (ev) => { ev.stopPropagation(); state.focus = "w"; hiWire(rec); showWireInfo(w); });

    let label = null;
    if (measured) {
      const mx = (a.x + b.x) / 2 + (-(b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1)) * bow * 0.5;
      const my = (a.y + b.y) / 2 + ((b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1)) * bow * 0.5;
      const lg = el("g", { class: "wire-label", transform: `translate(${mx},${my})` }, gWire.labels);
      const txt = w.fiberLabel;
      const wid = txt.length * 6.0 + 12;
      el("rect", { x: -wid / 2, y: -9, width: wid, height: 18, rx: 4, class: "wlbl-bg" }, lg);
      const tt = el("text", { x: 0, y: 4, class: "wlbl-text" }, lg);
      tt.textContent = txt;
      label = lg;
    }
    const rec = { el: path, label, from: w.from, to: w.to, kind: w.kind };
    wires.push(rec);
  }

  // ---- highlight ----
  function endpointsTouch(rec, key) { return rec.from === key || rec.to === key; }
  function highlight(key) {
    const connected = new Set([key]);
    wires.forEach((r) => { if (endpointsTouch(r, key)) { connected.add(r.from); connected.add(r.to); } });
    areaEls.forEach((g, k) => { g.classList.toggle("dim", !connected.has(k)); g.classList.toggle("hot", k === key); });
    organEls.forEach((g, k) => { g.classList.toggle("dim", !connected.has(k)); g.classList.toggle("hot", k === key); });
    wires.forEach((r) => {
      const on = endpointsTouch(r, key);
      r.el.classList.toggle("wire-hot", on);
      r.el.classList.toggle("wire-dim", !on);
      if (r.label) r.label.classList.toggle("wlbl-dim", !on);
    });
  }
  function hiWire(rec) {
    const ends = new Set([rec.from, rec.to]);
    areaEls.forEach((g, k) => { g.classList.toggle("dim", !ends.has(k)); g.classList.toggle("hot", ends.has(k)); });
    organEls.forEach((g, k) => { g.classList.toggle("dim", !ends.has(k)); g.classList.toggle("hot", ends.has(k)); });
    wires.forEach((r) => { const on = r === rec; r.el.classList.toggle("wire-hot", on); r.el.classList.toggle("wire-dim", !on); if (r.label) r.label.classList.toggle("wlbl-dim", !on); });
  }
  function clearHi() {
    areaEls.forEach((g) => g.classList.remove("dim", "hot"));
    organEls.forEach((g) => g.classList.remove("dim", "hot"));
    wires.forEach((r) => { r.el.classList.remove("wire-hot", "wire-dim"); if (r.label) r.label.classList.remove("wlbl-dim"); });
  }

  // ---- info panel ----
  function nameOf(ref) {
    const p = resolve(ref);
    if (!p) return ref;
    if (p.area) return p.area.label + " (" + p.hemi.side + ")";
    if (p.relay) return p.relay.label;
    if (p.organ) return p.organ.label;
    return ref;
  }
  function allWiresData() {
    return [].concat(
      A.SENSORY, A.MOTOR,
      A.CALLOSUM_AREAS.map((id) => ({ from: id + ":L", to: id + ":R", kind: "callosum", tract: "Corpus callosum", fiberLabel: "~200,000,000", ref: "callosum" })),
      flatPairs(A.CORTICO_PAIRS, "cortico"), flatPairs(A.FEEDBACK_PAIRS, "feedback")
    );
  }
  function flatPairs(pairs, kind) {
    const out = [];
    A.HEMIS.forEach((h) => pairs.forEach(([s, t, note]) =>
      out.push({ from: s + ":" + h.side, to: t + ":" + h.side, kind, tract: note || kind })));
    return out;
  }
  function showAreaInfo(key) {
    const p = resolve(key); if (!p || !p.area) return;
    const data = allWiresData();
    const inc = data.filter((w) => w.to === key);
    const out = data.filter((w) => w.from === key);
    const li = (w, dir) => `<li><span class="k k-${w.kind}">${A.WIRE_KINDS[w.kind].name}</span> ${dir === "in" ? "←" : "→"} ${nameOf(dir === "in" ? w.from : w.to)}<br><span class="tract">${w.tract || ""}</span>${w.fiberLabel ? ` · <span class="count">${w.fiberLabel}</span>` : ""}</li>`;
    setInfo(
      `<div class="info-head"><span class="swatch" style="background:${sysColor(p.area.system)}"></span><strong>${p.area.label}</strong></div>` +
      `<div class="info-sub">${A.SYSTEMS[p.area.system].name} · ${p.hemi.side === "L" ? "Left" : "Right"} hemisphere</div>` +
      `<h4>Incoming</h4><ul>${inc.map((w) => li(w, "in")).join("") || "<li class='muted'>none</li>"}</ul>` +
      `<h4>Outgoing</h4><ul>${out.map((w) => li(w, "out")).join("") || "<li class='muted'>none</li>"}</ul>`
    );
  }
  function showOrganInfo(o) {
    const data = allWiresData();
    const out = data.filter((w) => w.from === o.id);
    setInfo(
      `<div class="info-head"><span class="organ-mini">${o.icon}</span><strong>${o.label}</strong></div>` +
      `<div class="info-sub">Sense organ</div>` +
      `<h4>Sends signals via</h4><ul>${out.map((w) => `<li><span class="tract">${w.tract || ""}</span> → ${nameOf(w.to)}${w.fiberLabel ? `<br><span class="count">${w.fiberLabel}</span>` : ""}</li>`).join("") || "<li class='muted'>—</li>"}</ul>`
    );
  }
  function showWireInfo(w) {
    const cite = w.ref && A.CITATIONS[w.ref];
    setInfo(
      `<div class="info-head"><strong>${w.tract || A.WIRE_KINDS[w.kind].name}</strong></div>` +
      `<div class="info-sub">${nameOf(w.from)} &nbsp;→&nbsp; ${nameOf(w.to)}</div>` +
      `<div class="info-sub">${A.WIRE_KINDS[w.kind].name}</div>` +
      (w.fiberLabel ? `<div class="cite"><strong>Measured:</strong> ${w.fiberLabel}<br>${cite ? `<span class="muted">${cite.url ? `<a href="${cite.url}" target="_blank" rel="noopener">${cite.text}</a>` : cite.text}</span>` : ""}</div>` : "")
    );
  }
  function setInfo(html) { const p = document.getElementById("info"); p.innerHTML = html; p.classList.add("open"); }
  function hideInfo() { document.getElementById("info").classList.remove("open"); }

  // ---- layer toggles ----
  function setLayer(name, on) {
    state.layers[name] = on;
    const disp = on ? "" : "none";
    if (name === "sensory") { gWire.sensory.style.display = disp; gWire.motor.style.display = disp; }
    else gWire[name].style.display = disp;
    applyLabels();
  }
  function applyLabels() {
    gWire.labels.style.display = state.showCounts ? "" : "none";
    document.querySelectorAll(".patch-label, .organ-label, .hemi-title, .relay-label")
      .forEach((e) => (e.style.display = state.showLabels ? "" : "none"));
  }

  function buildControls() {
    const toggles = [
      ["sensory", "Senses & afferents"], ["cortico", "Cortico-cortical"],
      ["feedback", "Feedback fibers"], ["callosum", "Corpus callosum"],
    ];
    const box = document.getElementById("layer-toggles");
    toggles.forEach(([k, label]) => {
      const l = document.createElement("label"); l.className = "toggle";
      l.innerHTML = `<input type="checkbox" checked> ${label}`;
      l.querySelector("input").addEventListener("change", (e) => setLayer(k, e.target.checked));
      box.appendChild(l);
    });
    document.getElementById("t-labels").addEventListener("change", (e) => { state.showLabels = e.target.checked; applyLabels(); });
    document.getElementById("t-counts").addEventListener("change", (e) => { state.showCounts = e.target.checked; applyLabels(); });
    document.getElementById("reset").addEventListener("click", () => {
      Object.keys(state.layers).forEach((k) => setLayer(k, true));
      state.focus = null; clearHi(); hideInfo();
      document.querySelectorAll("#layer-toggles input").forEach((i) => (i.checked = true));
    });

    // legend
    const lg = document.getElementById("legend");
    Object.entries(A.WIRE_KINDS).forEach(([k, v]) => {
      const color = v.color || "#5B8FF9";
      const row = document.createElement("div"); row.className = "lg-row";
      row.innerHTML = `<svg width="34" height="12"><line x1="2" y1="6" x2="32" y2="6" stroke="${color}" stroke-width="${k === "callosum" ? 3 : 2.2}" ${v.dash ? `stroke-dasharray="${v.dash}"` : ""}/></svg> ${v.name}`;
      lg.appendChild(row);
    });
    // sources
    const src = document.getElementById("sources");
    Object.values(A.CITATIONS).forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${c.text}</a>` : c.text;
      src.appendChild(li);
    });
  }

  document.addEventListener("DOMContentLoaded", () => { buildControls(); build(); });
})();
