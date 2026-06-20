/*
 * app.js — realistic unfolded cortex renderer
 * -------------------------------------------
 * Draws two flattened hemispheres as CONTINUOUS parcellated sheets (regions from
 * flatmapGeo.js, sized by real cm²), a to-scale thalamus with nested relay
 * nuclei, the sense organs, and the wiring — with:
 *   • measured tracts on a fixed LINEAR width standard (px per million fibers)
 *   • cortico-cortical connections as flagged ESTIMATES (dashed), feed-forward
 *     and feedback drawn in different colors so direction is visible
 *   • a scale bar and legend.
 */

(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";
  const A = window.ATLAS, F = window.FLATMAP;
  const W = 2200, H = 1500;

  // hemisphere placement: local (0..600 x, 0..420 y) -> screen
  const SC = 1.2;
  const L = { ox: 140, oy: 150 };          // left hemisphere origin
  const R = { ox: 1340, oy: 150 };         // right hemisphere origin (mirrored x)
  function hx(side, lx) { return side === "L" ? L.ox + lx * SC : R.ox + (600 - lx) * SC; }
  function hy(side, ly) { return (side === "L" ? L.oy : R.oy) + ly * SC; }

  // thalamus glyph boxes (one per hemisphere) in the center channel
  const THAL = {
    L: { x: 905, y: 660, w: 175, h: 135 },
    R: { x: 1120, y: 660, w: 175, h: 135 },
  };
  function relayPos(id, side) {
    const r = A.RELAYS.find((q) => q.id === id); if (!r) return null;
    const b = THAL[side]; const u = side === "L" ? r.local[0] : 1 - r.local[0];
    return { x: b.x + u * b.w, y: b.y + r.local[1] * b.h };
  }

  // fixed positions for organs & midline output structures
  const FIXED = {
    eyeL: { x: 1010, y: 1330, icon: "👁️", label: "Left eye" },
    eyeR: { x: 1190, y: 1330, icon: "👁️", label: "Right eye" },
    earL: { x: 90, y: 720, icon: "👂", label: "Left ear" },
    earR: { x: 2110, y: 720, icon: "👂", label: "Right ear" },
    nose: { x: 1340, y: 1360, icon: "👃", label: "Nose" },
    tongue: { x: 860, y: 1360, icon: "👅", label: "Tongue" },
    body: { x: 1100, y: 1455, icon: "🖐️", label: "Body / skin" },
    olfbulbL: { x: 1150, y: 1235, label: "Olf. bulb" },
    olfbulbR: { x: 1250, y: 1235, label: "Olf. bulb" },
    brainstem: { x: 1100, y: 1235, label: "Brainstem" },
    spinal: { x: 1100, y: 1410, label: "Spinal cord" },
  };

  const areaIds = new Set(A.AREAS.map((a) => a.id));
  const relayIds = new Set(A.RELAYS.map((r) => r.id));
  const sysColor = (s) => (A.SYSTEMS[s] || {}).color || "#9aa5b1";

  // resolve any endpoint ref -> {x,y}
  function pos(ref) {
    if (FIXED[ref]) return { x: FIXED[ref].x, y: FIXED[ref].y };
    const [base, side] = ref.split(":");
    if (areaIds.has(base)) {
      const g = F.areas[base]; return { x: hx(side, g.cx), y: hy(side, g.cy) };
    }
    if (relayIds.has(base)) return relayPos(base, side);
    return null;
  }

  let svg, gWire = {}, info;
  const areaEls = new Map(); // "id:side" -> path
  const wires = [];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // ---- width standard ----
  function measuredWidth(fibers) {
    const w = (fibers / 1e6) * A.WIDTH.pxPerMillion;
    return Math.max(A.WIDTH.floor, Math.min(A.WIDTH.cap, w));
  }
  function estWidth(strength) { return 1.6 + strength * 2.0; }

  function build() {
    const wrap = document.getElementById("canvas");
    wrap.innerHTML = "";
    svg = el("svg", { viewBox: `0 0 ${W} ${H}`, id: "scene" }, wrap);
    info = document.getElementById("info");

    const gCortex = el("g", null, svg);
    const gThal = el("g", null, svg);
    gWire.callosum = el("g", null, svg);
    gWire.sensory = el("g", null, svg);
    gWire.fb = el("g", null, svg);
    gWire.ff = el("g", null, svg);
    const gOrgans = el("g", null, svg);
    const gLabels = el("g", { class: "labels" }, svg);
    gWire.labels = gLabels;

    ["L", "R"].forEach((side) => drawHemisphere(side, gCortex, gLabels));
    ["L", "R"].forEach((side) => drawThalamus(side, gThal, gLabels));
    drawOrgans(gOrgans, gLabels);
    drawWires();

    svg.addEventListener("click", () => clearFocus());
    document.getElementById("crossing-note").textContent =
      `${A.AREAS.length} areas/hemisphere · regions sized by real cm²`;
  }

  // ---- cortex ----
  function drawHemisphere(side, g, gLabels) {
    // sheet outline
    el("path", { d: F.outline.map((p, i) => `${i ? "L" : "M"}${hx(side, p[0]).toFixed(1)},${hy(side, p[1]).toFixed(1)}`).join("") + "Z",
      class: "sheet" }, g);

    A.AREAS.forEach((area) => {
      const geo = F.areas[area.id];
      const key = area.id + ":" + side;
      const d = geo.poly.map((p, i) => `${i ? "L" : "M"}${hx(side, p[0]).toFixed(1)},${hy(side, p[1]).toFixed(1)}`).join("") + "Z";
      const path = el("path", { d, class: "region", fill: sysColor(area.system), "data-key": key }, g);
      path.addEventListener("mouseenter", () => { if (!focused) highlight(key); });
      path.addEventListener("mouseleave", () => { if (!focused) clearHi(); });
      path.addEventListener("click", (e) => { e.stopPropagation(); setFocus(key); });
      areaEls.set(key, path);

      const t = el("text", { x: hx(side, geo.cx), y: hy(side, geo.cy) + 4, class: "region-label" }, gLabels);
      t.textContent = area.short;
    });

    // emphasize central sulcus (M1|S1 border) — draw a thick segment between their centroids midpoint
    const m1 = F.areas.m1, s1 = F.areas.s1;
    el("line", { x1: hx(side, (m1.cx + s1.cx) / 2), y1: hy(side, Math.min(m1.cy, s1.cy) - 28),
      x2: hx(side, (m1.cx + s1.cx) / 2), y2: hy(side, Math.max(m1.cy, s1.cy) + 28), class: "sulcus" }, g);

    const tt = el("text", { x: hx(side, 300), y: hy(side, 0) - 26, class: "hemi-title" }, gLabels);
    tt.textContent = side === "L" ? "Left hemisphere (flattened)" : "Right hemisphere (flattened)";
  }

  // ---- thalamus with realistically-scaled nuclei ----
  function drawThalamus(side, g, gLabels) {
    const b = THAL[side];
    el("ellipse", { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2 + 14, ry: b.h / 2 + 14,
      class: "thal-body" }, g);
    const tl = el("text", { x: b.x + b.w / 2, y: b.y - 22, class: "thal-title" }, gLabels);
    tl.textContent = "Thalamus";

    // size scale: glyph radius ∝ sqrt(volume); calibrate so whole thalamus ~ box
    const k = (b.w / 2 + 14) / Math.sqrt(A.THALAMUS.vol);
    A.RELAYS.forEach((r) => {
      const p = relayPos(r.id, side);
      const rad = k * Math.sqrt(r.vol);
      if (r.shape === "lgn") {
        // 6-layered knee: stacked arcs
        const gg = el("g", { class: "nucleus", "data-relay": r.id }, g);
        for (let i = 0; i < 6; i++) {
          el("path", { d: arcLayer(p.x, p.y, rad * (1 - i * 0.13), rad * 0.5), class: "lgn-layer",
            fill: i < 4 ? "#c9b6e6" : "#9270CA" }, gg);
        }
      } else if (r.shape === "cushion") {
        el("ellipse", { cx: p.x, cy: p.y, rx: rad * 1.15, ry: rad * 0.8, class: "nucleus-shape",
          fill: "#7f93a6" }, g);
      } else {
        el("ellipse", { cx: p.x, cy: p.y, rx: rad, ry: rad * 0.78, class: "nucleus-shape",
          fill: r.id === "mgn" ? "#5AD8A6" : "#5D7092" }, g);
      }
      const lt = el("text", { x: p.x, y: p.y + (r.shape === "cushion" ? 0 : rad + 11), class: "nucleus-label" }, gLabels);
      lt.textContent = r.label;
    });
  }
  function arcLayer(cx, cy, r, h) {
    return `M${cx - r},${cy} A${r},${h} 0 0 1 ${cx + r},${cy}`;
  }

  // ---- organs ----
  function drawOrgans(g, gLabels) {
    Object.entries(FIXED).forEach(([id, o]) => {
      if (!o.icon) { // relay-like bubble (olf bulb, brainstem, spinal)
        el("rect", { x: o.x - 34, y: o.y - 12, width: 68, height: 24, rx: 7, class: "mid-box" }, g);
        const t = el("text", { x: o.x, y: o.y + 4, class: "mid-label" }, gLabels);
        t.textContent = o.label; return;
      }
      const ng = el("g", { class: "organ", "data-id": id }, g);
      el("text", { x: o.x, y: o.y, class: "organ-icon" }, ng).textContent = o.icon;
      el("text", { x: o.x, y: o.y + 30, class: "organ-label" }, gLabels).textContent = o.label;
      ng.addEventListener("mouseenter", () => { if (!focused) highlight(id); });
      ng.addEventListener("mouseleave", () => { if (!focused) clearHi(); });
      ng.addEventListener("click", (e) => { e.stopPropagation(); setFocus(id); });
    });
    // spinal cord shaft
    el("line", { x1: FIXED.brainstem.x, y1: FIXED.brainstem.y + 12, x2: FIXED.spinal.x, y2: FIXED.spinal.y - 12, class: "cord" }, g);
  }

  // ---- wiring ----
  function wirePath(a, b, bow) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return `M${a.x},${a.y} Q${mx + (-dy / len) * bow},${my + (dx / len) * bow} ${b.x},${b.y}`;
  }
  function addWire(o) {
    const a = pos(o.from), b = pos(o.to); if (!a || !b) return;
    const path = el("path", { d: wirePath(a, b, o.bow || 0), class: "wire" + (o.est ? " est" : ""),
      stroke: o.color, "stroke-width": o.width, fill: "none" }, o.group);
    if (o.est) path.setAttribute("stroke-dasharray", "7,5");
    path.style.opacity = o.opacity;
    path.addEventListener("mouseenter", () => { if (!focused) hiWire(rec); });
    path.addEventListener("mouseleave", () => { if (!focused) clearHi(); });
    path.addEventListener("click", (e) => { e.stopPropagation(); showWireInfo(o.data); focused = "wire"; hiWire(rec); });
    const rec = { path, from: o.from, to: o.to, data: o.data };
    wires.push(rec);
    return rec;
  }

  function drawWires() {
    // sensory + motor (measured standard / flagged estimate)
    A.PATHWAYS.forEach((p) => {
      const measured = !!p.fibers;
      const color = p.group === "motor" ? "#FF9D4D" : sysColor(p.system);
      addWire({ from: p.from, to: p.to, group: gWire.sensory, color,
        width: measured ? measuredWidth(p.fibers) : 2.2, est: !measured,
        opacity: measured ? 0.85 : 0.5, bow: 12, data: p });
    });
    // corpus callosum (measured ~200M -> capped, flagged off-scale)
    A.CALLOSUM_AREAS.forEach((id) => {
      addWire({ from: id + ":L", to: id + ":R", group: gWire.callosum, color: "#36CFC9",
        width: measuredWidth(200000000), est: false, opacity: 0.5, bow: -80,
        data: { tract: "Corpus callosum", fibers: 200000000, ref: "callosum", group: "callosum",
          note: "drawn at the width cap — true width is ~20× off scale" } });
    });
    // cortico-cortical: feed-forward + feedback in different colors (flagged estimates)
    ["L", "R"].forEach((side) => {
      A.CORTICO.forEach(([s, t, strength]) => {
        addWire({ from: s + ":" + side, to: t + ":" + side, group: gWire.ff, color: A.DIR.ff,
          width: estWidth(strength), est: true, opacity: 0.6, bow: 16,
          data: { tract: `${s} → ${t} (feed-forward)`, est: true, strength, ref: "arcuate_est", group: "ff" } });
        addWire({ from: t + ":" + side, to: s + ":" + side, group: gWire.fb, color: A.DIR.fb,
          width: estWidth(strength) * 0.7, est: true, opacity: 0.55, bow: -16,
          data: { tract: `${t} → ${s} (feedback)`, est: true, strength, ref: "arcuate_est", group: "fb" } });
      });
    });
  }

  // ---- highlight / focus ----
  let focused = null;
  function neighbors(key) {
    const s = new Set([key]);
    wires.forEach((w) => { if (w.from === key || w.to === key) { s.add(w.from); s.add(w.to); } });
    return s;
  }
  function highlight(key) {
    const nb = neighbors(key);
    areaEls.forEach((p, k) => p.classList.toggle("dim", !nb.has(k)));
    wires.forEach((w) => {
      const on = w.from === key || w.to === key;
      w.path.classList.toggle("wire-hot", on);
      w.path.classList.toggle("wire-dim", !on);
    });
  }
  function hiWire(rec) {
    wires.forEach((w) => { const on = w === rec; w.path.classList.toggle("wire-hot", on); w.path.classList.toggle("wire-dim", !on); });
    areaEls.forEach((p, k) => p.classList.toggle("dim", k !== rec.from && k !== rec.to));
  }
  function clearHi() {
    areaEls.forEach((p) => p.classList.remove("dim"));
    wires.forEach((w) => w.path.classList.remove("wire-hot", "wire-dim"));
  }
  function setFocus(key) { focused = key; highlight(key); showNodeInfo(key); }
  function clearFocus() { if (focused) { focused = null; clearHi(); info.classList.remove("open"); } }

  // ---- info panel ----
  function labelOf(ref) {
    if (FIXED[ref]) return FIXED[ref].label;
    const [base, side] = ref.split(":");
    const ar = A.AREAS.find((a) => a.id === base); if (ar) return ar.label + " (" + side + ")";
    const rl = A.RELAYS.find((r) => r.id === base); if (rl) return rl.label + (side ? " (" + side + ")" : "");
    return ref;
  }
  function showNodeInfo(key) {
    const conns = wires.filter((w) => w.from === key || w.to === key);
    const ar = A.AREAS.find((a) => a.id === key.split(":")[0]);
    const rows = conns.map((w) => {
      const other = w.from === key ? w.to : w.from;
      const dir = w.from === key ? "→" : "←";
      const d = w.data;
      const detail = d.fibers ? `<span class="count">${d.fibers.toLocaleString()} fibers</span>` :
        d.est ? `<span class="est-tag">estimate</span>` : "";
      return `<li>${dir} ${labelOf(other)} <span class="muted">${detail}</span></li>`;
    }).join("");
    let head = ar ? `<div class="h"><span class="dot" style="background:${sysColor(ar.system)}"></span>${ar.label}</div>` +
      `<div class="sub">${A.SYSTEMS[ar.system].name} · ≈${ar.weight} cm² unfolded</div>` :
      `<div class="h">${FIXED[key] ? FIXED[key].label : labelOf(key)}</div>`;
    info.innerHTML = head + `<ul>${rows}</ul>`;
    info.classList.add("open");
  }
  function showWireInfo(d) {
    const cite = d.ref && A.CITATIONS[d.ref];
    let body;
    if (d.fibers) body = `<div class="cite"><strong>Measured:</strong> ${d.fibers.toLocaleString()} fibers` +
      (d.note ? `<br><span class="muted">${d.note}</span>` : "") +
      (cite ? `<br><span class="muted">${cite.url ? `<a href="${cite.url}" target="_blank" rel="noopener">${cite.text}</a>` : cite.text}</span>` : "") + `</div>`;
    else body = `<div class="cite est-cite"><strong>Estimated</strong> — human area-to-area fiber counts are not directly measured.` +
      (d.strength ? ` Relative strength: ${["", "weak", "moderate", "strong"][d.strength]}.` : "") +
      (cite ? `<br><span class="muted">${cite.url ? `<a href="${cite.url}" target="_blank" rel="noopener">${cite.text}</a>` : cite.text}</span>` : "") + `</div>`;
    info.innerHTML = `<div class="h">${d.tract}</div>` + body;
    info.classList.add("open");
  }

  // ---- controls / scale bar / legend ----
  function buildUI() {
    const toggles = [["sensory", "Sensory inputs & motor"], ["ff", "Feed-forward (cortico)"],
      ["fb", "Feedback (cortico)"], ["callosum", "Corpus callosum"]];
    const box = document.getElementById("layer-toggles");
    toggles.forEach(([k, label]) => {
      const l = document.createElement("label"); l.className = "toggle";
      const sw = k === "ff" ? `<span class="sw" style="background:${A.DIR.ff}"></span>` :
        k === "fb" ? `<span class="sw" style="background:${A.DIR.fb}"></span>` :
        k === "callosum" ? `<span class="sw" style="background:#36CFC9"></span>` : "";
      l.innerHTML = `<input type="checkbox" checked> ${sw}${label}`;
      l.querySelector("input").addEventListener("change", (e) => { gWire[k].style.display = e.target.checked ? "" : "none"; });
      box.appendChild(l);
    });
    document.getElementById("t-labels").addEventListener("change", (e) => {
      gWire.labels.style.display = e.target.checked ? "" : "none";
    });

    // scale bar: linear standard + reference widths
    const sb = document.getElementById("scalebar");
    const refs = [["Cochlear nerve", 31000], ["Optic / corticospinal", 1000000], ["Olfactory nerve", 7000000]];
    sb.innerHTML = `<div class="sb-note">Width standard: <b>${A.WIDTH.pxPerMillion}px = 1,000,000 fibers</b> (linear)</div>`;
    refs.forEach(([name, n]) => {
      const w = measuredWidth(n);
      const row = document.createElement("div"); row.className = "sb-row";
      row.innerHTML = `<svg width="90" height="18"><line x1="3" y1="9" x2="87" y2="9" stroke="#cfd9e3" stroke-width="${w}" stroke-linecap="round"/></svg><span>${name} — ${n.toLocaleString()}</span>`;
      sb.appendChild(row);
    });
    const cap = document.createElement("div"); cap.className = "sb-note muted";
    cap.innerHTML = `Corpus callosum (~200M) is drawn at the cap — it is really ~20× thicker than shown.`;
    sb.appendChild(cap);

    // legend
    const lg = document.getElementById("legend");
    [["Feed-forward", A.DIR.ff, false], ["Feedback", A.DIR.fb, false], ["Corpus callosum", "#36CFC9", false],
     ["Estimated (dashed)", "#9aa5b1", true]].forEach(([name, color, dash]) => {
      const row = document.createElement("div"); row.className = "lg-row";
      row.innerHTML = `<svg width="30" height="10"><line x1="2" y1="5" x2="28" y2="5" stroke="${color}" stroke-width="3" ${dash ? 'stroke-dasharray="5,4"' : ""}/></svg> ${name}`;
      lg.appendChild(row);
    });

    const src = document.getElementById("sources");
    Object.values(A.CITATIONS).forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${c.text}</a>` : c.text;
      src.appendChild(li);
    });
  }

  document.addEventListener("DOMContentLoaded", () => { buildUI(); build(); });
})();
