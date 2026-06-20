/*
 * app.js — realistic unfolded cortex + sensory-relay renderer
 * -----------------------------------------------------------
 * Draws two flattened hemispheres as CONTINUOUS, smoothly-bordered parcellated
 * sheets (regions sized by real cm²), a to-scale thalamus with its relay nuclei
 * (LGN unfolded into its 6 layers), the other sensory transduction stations
 * (olfactory bulb, superior/inferior colliculi, brainstem relays) at realistic
 * relative size, the sense organs, and the wiring — with ONE fiber→width standard
 * applied to every connection so counts are honestly comparable.
 */

(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";
  const A = window.ATLAS, F = window.FLATMAP;
  const W = 2200, H = 1560;

  // hemisphere placement: local (≈0..616 x, ≈30..430 y) -> screen
  const SC = 1.13;
  const L = { ox: 128, oy: 120 };
  const R = { ox: 1352, oy: 120 };
  function hx(side, lx) { return side === "L" ? L.ox + lx * SC : R.ox + (600 - lx) * SC; }
  function hy(side, ly) { return (side === "L" ? L.oy : R.oy) + ly * SC; }

  // thalamus glyph boxes (one per hemisphere) in the widened center channel
  const THAL = {
    L: { x: 836, y: 600, w: 210, h: 182 },
    R: { x: 1112, y: 600, w: 210, h: 182 },
  };
  function relayPos(id, side) {
    const r = A.RELAYS.find((q) => q.id === id); if (!r) return null;
    const b = THAL[side]; const u = side === "L" ? r.local[0] : 1 - r.local[0];
    return { x: b.x + u * b.w, y: b.y + r.local[1] * b.h };
  }

  // non-thalamic relay/transduction stations (screen positions)
  const STATIONPOS = {
    sc:       { x: 1080, y: 868, vol: stVol("sc"),      label: "Sup. colliculus" },
    ic:       { x: 1080, y: 940, vol: stVol("ic"),      label: "Inf. colliculus" },
    olfbulbL: { x: 965,  y: 1240, vol: stVol("olfbulb"), label: "Olf. bulb" },
    olfbulbR: { x: 1195, y: 1240, vol: stVol("olfbulb"), label: "Olf. bulb" },
  };
  function stVol(id) { const s = A.STATIONS.find((q) => q.id === id); return s ? s.vol : 50; }
  function stMeta(id) { return A.STATIONS.find((q) => q.id === id); }

  // fixed positions for organs & midline output structures
  const FIXED = {
    eyeL: { x: 995, y: 1380, icon: "👁️", label: "Left eye" },
    eyeR: { x: 1165, y: 1380, icon: "👁️", label: "Right eye" },
    earL: { x: 95,  y: 690, icon: "👂", label: "Left ear" },
    earR: { x: 2105, y: 690, icon: "👂", label: "Right ear" },
    nose: { x: 1080, y: 1410, icon: "👃", label: "Nose" },
    tongue: { x: 1080, y: 1490, icon: "👅", label: "Tongue" },
    body: { x: 820, y: 1455, icon: "🖐️", label: "Body / skin" },
    brainstem: { x: 1080, y: 1075, label: "Brainstem" },
    spinal: { x: 1080, y: 1235, label: "Spinal cord" },
  };

  const areaIds = new Set(A.AREAS.map((a) => a.id));
  const relayIds = new Set(A.RELAYS.map((r) => r.id));
  const sysColor = (s) => (A.SYSTEMS[s] || {}).color || "#9aa5b1";

  // resolve any endpoint ref -> {x,y}
  function pos(ref) {
    if (FIXED[ref]) return { x: FIXED[ref].x, y: FIXED[ref].y };
    if (STATIONPOS[ref]) return { x: STATIONPOS[ref].x, y: STATIONPOS[ref].y };
    const [base, side] = ref.split(":");
    if (base === "olfbulb") { const s = STATIONPOS["olfbulb" + side]; return s ? { x: s.x, y: s.y } : null; }
    if (areaIds.has(base)) { const g = F.areas[base]; return { x: hx(side, g.cx), y: hy(side, g.cy) }; }
    if (relayIds.has(base)) return relayPos(base, side);
    if (STATIONPOS[base]) return { x: STATIONPOS[base].x, y: STATIONPOS[base].y };
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

  // ---- ONE width standard (linear px per million fibers) ----
  function measuredWidth(fibers) {
    const w = (fibers / 1e6) * A.WIDTH.pxPerMillion;
    return Math.max(A.WIDTH.floor, Math.min(A.WIDTH.cap, w));
  }

  function build() {
    const wrap = document.getElementById("canvas");
    wrap.innerHTML = "";
    svg = el("svg", { viewBox: `0 0 ${W} ${H}`, id: "scene" }, wrap);
    info = document.getElementById("info");

    gWire.callosum = el("g", null, svg);  // behind cortex — a bridge over the top
    const gCortex = el("g", null, svg);
    const gSub = el("g", null, svg);     // thalamus + stations
    gWire.sensory = el("g", null, svg);
    gWire.fb = el("g", null, svg);
    gWire.ff = el("g", null, svg);
    const gOrgans = el("g", null, svg);
    const gLabels = el("g", { class: "labels" }, svg);
    gWire.labels = gLabels;

    ["L", "R"].forEach((side) => drawHemisphere(side, gCortex, gLabels));
    ["L", "R"].forEach((side) => drawThalamus(side, gSub, gLabels));
    drawStations(gSub, gLabels);
    drawOrgans(gOrgans, gLabels);
    drawWires();

    svg.addEventListener("click", () => clearFocus());
    document.getElementById("crossing-note").textContent =
      `${A.AREAS.length} cortical regions/hemisphere · subcortical relays at true relative volume`;
  }

  // ---- cortex ----
  function drawHemisphere(side, g, gLabels) {
    el("path", { d: poly2path(F.outline, side), class: "sheet" }, g);

    A.AREAS.forEach((area) => {
      const geo = F.areas[area.id];
      const key = area.id + ":" + side;
      const path = el("path", { d: poly2path(geo.poly, side), class: "region",
        fill: sysColor(area.system), "data-key": key }, g);
      path.addEventListener("mouseenter", () => { if (!focused) highlight(key); });
      path.addEventListener("mouseleave", () => { if (!focused) clearHi(); });
      path.addEventListener("click", (e) => { e.stopPropagation(); setFocus(key); });
      areaEls.set(key, path);

      const t = el("text", { x: hx(side, geo.cx), y: hy(side, geo.cy) + 4, class: "region-label" }, gLabels);
      t.textContent = area.short;
    });

    // emphasize the central sulcus (M1|S1 border)
    const m1 = F.areas.m1, s1 = F.areas.s1;
    el("line", { x1: hx(side, (m1.cx + s1.cx) / 2), y1: hy(side, Math.min(m1.cy, s1.cy) - 26),
      x2: hx(side, (m1.cx + s1.cx) / 2), y2: hy(side, Math.max(m1.cy, s1.cy) + 26), class: "sulcus" }, g);

    const tt = el("text", { x: hx(side, 300), y: hy(side, 24) - 40, class: "hemi-title" }, gLabels);
    tt.textContent = side === "L" ? "Left hemisphere (unfolded)" : "Right hemisphere (unfolded)";
  }
  function poly2path(pts, side) {
    return pts.map((p, i) => `${i ? "L" : "M"}${hx(side, p[0]).toFixed(1)},${hy(side, p[1]).toFixed(1)}`).join("") + "Z";
  }

  // ---- thalamus with relay nuclei at true relative volume ----
  function drawThalamus(side, g, gLabels) {
    const b = THAL[side];
    el("ellipse", { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2 + 12, ry: b.h / 2 + 10,
      class: "thal-body" }, g);
    const tl = el("text", { x: b.x + b.w / 2, y: b.y - 16, class: "thal-title" }, gLabels);
    tl.textContent = "Thalamus";

    // glyph radius ∝ sqrt(volume); calibrate so the largest nuclei fill the box
    const k = (b.w / Math.sqrt(A.THALAMUS.vol)) * 0.40;
    A.RELAYS.forEach((r) => {
      const p = relayPos(r.id, side);
      const rad = k * Math.sqrt(r.vol);
      const col = sysColor(r.system);
      const ref = r.id + ":" + side;
      const ng = el("g", { class: "station", "data-relay": ref }, g);
      if (r.shape === "lgn") {
        drawLGN(ng, gLabels, p, rad, r, side);
      } else if (r.shape === "cushion") {
        el("ellipse", { cx: p.x, cy: p.y, rx: rad * 1.2, ry: rad * 0.82, class: "nucleus-shape", fill: col }, ng);
      } else {
        el("ellipse", { cx: p.x, cy: p.y, rx: rad, ry: rad * 0.8, class: "nucleus-shape", fill: col }, ng);
      }
      if (r.shape !== "lgn") {
        const above = r.local[1] < 0.48; // stagger labels to avoid collisions
        el("text", { x: p.x, y: above ? p.y - rad - 5 : p.y + rad + 11, class: "nucleus-label" }, gLabels)
          .textContent = r.label;
      }
      attachHover(ng, ref);
    });
  }
  // LGN drawn UNFOLDED: its 6 stacked layers (ventral 2 = magnocellular, dorsal 4 = parvocellular)
  function drawLGN(g, gLabels, p, rad, r, side) {
    const gg = el("g", { class: "nucleus", "data-relay": r.id + ":" + side }, g);
    const layers = 6, span = rad * 2.0, h = rad * 0.62;
    for (let i = 0; i < layers; i++) {
      const ww = span * (1 - i * 0.07);
      const yy = p.y + (i - 2.5) * (h * 0.34);
      const magno = i >= 4; // ventral two layers (1–2) are magnocellular
      el("path", { d: `M${p.x - ww / 2},${yy} A${ww / 2},${h * 0.34} 0 0 1 ${p.x + ww / 2},${yy}`,
        class: "lgn-layer", fill: "none",
        stroke: magno ? "#7d5fb8" : "#c9b6e6", "stroke-width": magno ? 2.4 : 1.6 }, gg);
    }
    const lt = el("text", { x: p.x, y: p.y + rad + 12, class: "nucleus-label" }, gLabels);
    lt.textContent = "LGN";
  }

  // ---- other sensory transduction / relay stations ----
  function drawStations(g, gLabels) {
    const k = (THAL.L.w / Math.sqrt(A.THALAMUS.vol)) * 0.40; // same volume standard as nuclei

    // superior & inferior colliculi — the quadrigeminal plate (paired bumps)
    ["sc", "ic"].forEach((id) => {
      const s = STATIONPOS[id], meta = stMeta(id), rad = Math.max(7, k * Math.sqrt(s.vol));
      const col = sysColor(meta.system);
      [-1, 1].forEach((sgn) => {
        const ng = el("g", { class: "station", "data-id": id }, g);
        el("ellipse", { cx: s.x + sgn * rad * 1.15, cy: s.y, rx: rad, ry: rad * 0.85,
          class: "nucleus-shape", fill: col }, ng);
        attachHover(ng, id);
      });
      el("text", { x: s.x + rad * 2.4 + 6, y: s.y + 4, class: "nucleus-label", "text-anchor": "start" }, gLabels)
        .textContent = s.label;
    });

    // olfactory bulbs (one per hemisphere) — elongated glomerular relay
    ["L", "R"].forEach((side) => {
      const s = STATIONPOS["olfbulb" + side], rad = Math.max(8, k * Math.sqrt(s.vol));
      const col = sysColor("olfactory");
      const ng = el("g", { class: "station", "data-id": "olfbulb:" + side }, g);
      el("ellipse", { cx: s.x, cy: s.y, rx: rad * 0.78, ry: rad * 1.5, class: "nucleus-shape", fill: col }, ng);
      // glomerular stipple along the leading (ventral) edge
      for (let i = -1; i <= 1; i++) {
        el("circle", { cx: s.x + i * rad * 0.42, cy: s.y + rad * 1.5, r: 2.1, fill: "#d9c7f2", stroke: "none" }, ng);
      }
      attachHover(ng, "olfbulb:" + side);
      el("text", { x: s.x, y: s.y - rad * 1.5 - 6, class: "nucleus-label" }, gLabels).textContent = s.label;
    });

    // compact brainstem relay band (labels only — small, named stations)
    const bx = FIXED.brainstem.x, by = FIXED.brainstem.y;
    el("rect", { x: bx - 60, y: by - 16, width: 120, height: 32, rx: 9, class: "mid-box" }, g);
    el("text", { x: bx, y: by - 1, class: "mid-label" }, gLabels).textContent = "Brainstem";
    el("text", { x: bx, y: by + 12, class: "mid-sub" }, gLabels).textContent =
      A.BRAINSTEM_RELAYS.map((r) => r.label.split("/")[0]).join(" · ");
    // spinal cord shaft
    el("rect", { x: FIXED.spinal.x - 30, y: FIXED.spinal.y - 12, width: 60, height: 24, rx: 7, class: "mid-box" }, g);
    el("text", { x: FIXED.spinal.x, y: FIXED.spinal.y + 4, class: "mid-label" }, gLabels).textContent = "Spinal cord";
    el("line", { x1: bx, y1: by + 16, x2: FIXED.spinal.x, y2: FIXED.spinal.y - 12, class: "cord" }, g);
  }
  function attachHover(node, id) {
    node.addEventListener("mouseenter", () => { if (!focused) highlight(id); });
    node.addEventListener("mouseleave", () => { if (!focused) clearHi(); });
    node.addEventListener("click", (e) => { e.stopPropagation(); setFocus(id); });
  }

  // ---- organs ----
  function drawOrgans(g, gLabels) {
    Object.entries(FIXED).forEach(([id, o]) => {
      if (!o.icon) return; // brainstem/spinal drawn in drawStations
      const ng = el("g", { class: "organ", "data-id": id }, g);
      el("text", { x: o.x, y: o.y, class: "organ-icon" }, ng).textContent = o.icon;
      el("text", { x: o.x, y: o.y + 30, class: "organ-label" }, gLabels).textContent = o.label;
      attachHover(ng, id);
    });
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
    const rec = { path, from: o.from, to: o.to, data: o.data };
    path.addEventListener("mouseenter", () => { if (!focused) hiWire(rec); });
    path.addEventListener("mouseleave", () => { if (!focused) clearHi(); });
    path.addEventListener("click", (e) => { e.stopPropagation(); showWireInfo(o.data); focused = "wire"; hiWire(rec); });
    wires.push(rec);
    return rec;
  }

  function drawWires() {
    // sensory inputs, relays & motor — measured ride the standard; unmeasured dashed
    A.PATHWAYS.forEach((p) => {
      const measured = !!p.fibers;
      const color = p.group === "motor" ? "#FF9D4D" : sysColor(p.system);
      addWire({ from: p.from, to: p.to, group: gWire.sensory, color,
        width: measured ? measuredWidth(p.fibers) : A.WIDTH.floor + 0.9, est: !measured,
        opacity: measured ? 0.88 : 0.5, bow: 14, data: p });
    });
    // optic taps to superior colliculus (orienting) — flagged estimate
    ["L", "R"].forEach((side) =>
      addWire({ from: "eye" + side, to: "sc", group: gWire.sensory, color: sysColor("visual"),
        width: A.WIDTH.floor + 0.6, est: true, opacity: 0.4, bow: side === "L" ? 30 : -30,
        data: { tract: "Retinotectal tap → superior colliculus", est: true } }));

    // corpus callosum (measured ~200M → drawn at the cap, flagged off-scale)
    A.CALLOSUM_AREAS.forEach((id) => {
      addWire({ from: id + ":L", to: id + ":R", group: gWire.callosum, color: "#36CFC9",
        width: measuredWidth(200000000), est: false, opacity: 0.16, bow: -90,
        data: { tract: "Corpus callosum", fibers: 200000000, ref: "callosum", group: "callosum",
          note: "drawn at the width cap — true width is ~20× off scale" } });
    });

    // cortico-cortical: ride the SAME standard via an estimated order-of-magnitude
    // (so an area-pair is honestly hairline next to a sensory nerve); relative
    // strength shown by OPACITY, direction by color, all dashed + flagged.
    const oOpacity = { 1: 0.32, 2: 0.5, 3: 0.7 };
    ["L", "R"].forEach((side) => {
      A.CORTICO.forEach(([s, t, strength]) => {
        const oom = A.EST_OOM[strength];
        const ww = measuredWidth(oom);
        addWire({ from: s + ":" + side, to: t + ":" + side, group: gWire.ff, color: A.DIR.ff,
          width: ww, est: true, opacity: oOpacity[strength], bow: 16,
          data: { tract: `${s} → ${t} (feed-forward)`, est: true, strength, estOOM: oom, ref: "arcuate_est", group: "ff" } });
        addWire({ from: t + ":" + side, to: s + ":" + side, group: gWire.fb, color: A.DIR.fb,
          width: ww, est: true, opacity: oOpacity[strength] * 0.85, bow: -16,
          data: { tract: `${t} → ${s} (feedback)`, est: true, strength, estOOM: oom, ref: "arcuate_est", group: "fb" } });
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
    if (STATIONPOS[ref]) return STATIONPOS[ref].label;
    const [base, side] = ref.split(":");
    if (base === "olfbulb") return "Olfactory bulb (" + side + ")";
    const ar = A.AREAS.find((a) => a.id === base); if (ar) return ar.label + " (" + side + ")";
    const rl = A.RELAYS.find((r) => r.id === base); if (rl) return rl.label + (side ? " (" + side + ")" : "");
    return ref;
  }
  function showNodeInfo(key) {
    const conns = wires.filter((w) => w.from === key || w.to === key);
    const ar = A.AREAS.find((a) => a.id === key.split(":")[0]);
    const rl = A.RELAYS.find((r) => r.id === key.split(":")[0]);
    const rows = conns.map((w) => {
      const other = w.from === key ? w.to : w.from;
      const dir = w.from === key ? "→" : "←";
      const d = w.data;
      const detail = d.fibers ? `<span class="count">${d.fibers.toLocaleString()} fibers</span>` :
        d.estOOM ? `<span class="est-tag">~${d.estOOM.toLocaleString()} (est.)</span>` :
        d.est ? `<span class="est-tag">not measured</span>` : "";
      return `<li>${dir} ${labelOf(other)} <span class="muted">${detail}</span></li>`;
    }).join("");
    let head;
    if (ar) head = `<div class="h"><span class="dot" style="background:${sysColor(ar.system)}"></span>${ar.label}</div>` +
      `<div class="sub">${A.SYSTEMS[ar.system].name} · ≈${ar.weight} cm² unfolded</div>`;
    else if (rl) head = `<div class="h"><span class="dot" style="background:${sysColor(rl.system)}"></span>${rl.label}</div>` +
      `<div class="sub">Thalamic relay · ≈${rl.vol} mm³</div>`;
    else head = `<div class="h">${labelOf(key)}</div>`;
    info.innerHTML = head + `<ul>${rows}</ul>`;
    info.classList.add("open");
  }
  function showWireInfo(d) {
    const cite = d.ref && A.CITATIONS[d.ref];
    let body;
    if (d.fibers) body = `<div class="cite"><strong>Measured:</strong> ${d.fibers.toLocaleString()} fibers` +
      (d.note ? `<br><span class="muted">${d.note}</span>` : "") +
      (cite ? `<br><span class="muted">${citeHtml(cite)}</span>` : "") + `</div>`;
    else if (d.estOOM) body = `<div class="cite est-cite"><strong>Estimated order of magnitude</strong> — ~${d.estOOM.toLocaleString()} axons.` +
      ` Human area-to-area fiber counts are <b>not directly measured</b>; this rides the same width standard (hence hairline-thin) and is dashed.` +
      (d.strength ? ` Relative strength: ${["", "weak", "moderate", "strong"][d.strength]} (shown by opacity).` : "") +
      (cite ? `<br><span class="muted">${citeHtml(cite)}</span>` : "") + `</div>`;
    else body = `<div class="cite est-cite"><strong>Not measured</strong> — drawn dashed; no reliable human axon count.` +
      (cite ? `<br><span class="muted">${citeHtml(cite)}</span>` : "") + `</div>`;
    info.innerHTML = `<div class="h">${d.tract}</div>` + body;
    info.classList.add("open");
  }
  function citeHtml(c) { return c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${c.text}</a>` : c.text; }

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

    // scale bar: ONE linear standard + reference widths
    const sb = document.getElementById("scalebar");
    const refs = [["Cochlear nerve", 31000], ["Optic / corticospinal", 1000000], ["Olfactory nerve", 7000000]];
    sb.innerHTML = `<div class="sb-note">One standard: <b>${A.WIDTH.pxPerMillion}px = 1,000,000 fibers</b> (linear), used for every wire.</div>`;
    refs.forEach(([name, n]) => {
      const w = measuredWidth(n);
      const row = document.createElement("div"); row.className = "sb-row";
      row.innerHTML = `<svg width="90" height="18"><line x1="3" y1="9" x2="87" y2="9" stroke="#cfd9e3" stroke-width="${w}" stroke-linecap="round"/></svg><span>${name} — ${n.toLocaleString()}</span>`;
      sb.appendChild(row);
    });
    const cap = document.createElement("div"); cap.className = "sb-note muted";
    cap.innerHTML = `Corpus callosum (~200M) is drawn at the cap — really ~20× thicker than shown. ` +
      `Cortico-cortical area-pairs (~10³–10⁵ axons, est.) sit at the floor: on the same honest scale they are hairlines next to the sensory nerves.`;
    sb.appendChild(cap);

    // legend
    const lg = document.getElementById("legend");
    [["Feed-forward (cortico)", A.DIR.ff, false], ["Feedback (cortico)", A.DIR.fb, false],
     ["Corpus callosum", "#36CFC9", false], ["Estimated / not measured (dashed)", "#9aa5b1", true]].forEach(([name, color, dash]) => {
      const row = document.createElement("div"); row.className = "lg-row";
      row.innerHTML = `<svg width="30" height="10"><line x1="2" y1="5" x2="28" y2="5" stroke="${color}" stroke-width="3" ${dash ? 'stroke-dasharray="5,4"' : ""}/></svg> ${name}`;
      lg.appendChild(row);
    });

    const src = document.getElementById("sources");
    Object.values(A.CITATIONS).forEach((c) => {
      const li = document.createElement("li");
      li.innerHTML = citeHtml(c);
      src.appendChild(li);
    });
  }

  document.addEventListener("DOMContentLoaded", () => { buildUI(); build(); });
})();
