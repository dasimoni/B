/*
 * app.js — "Brain in 3D" (Three.js)
 * ---------------------------------
 * The realistic unfolded view, in 3D. Each hemisphere is a CURVED, parcellated
 * cortical sheet whose regions are the real flatmap polygons (from
 * ../unfolded/flatmapGeo.js), sized by real unfolded cm² — not caricature tiles.
 * The thalamus, its relay nuclei (LGN unfolded into layers), and the other
 * sensory transduction stations (olfactory bulb, superior/inferior colliculi,
 * brainstem relays) are 3D glyphs sized by real volume. Every wire is a 3D tube
 * whose radius rides ONE fiber→width standard, so counts are honestly comparable.
 * Nerves and cortico-cortical fibers are stretched through space for legibility.
 *
 * Reuses window.ATLAS (../unfolded/atlas.js) + window.FLATMAP (flatmapGeo.js).
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const A = window.ATLAS, F = window.FLATMAP;

// ---------- scene setup ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#06090e");
scene.fog = new THREE.Fog("#06090e", 22, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.4, 15.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.7, 1.4);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 44;

scene.add(new THREE.AmbientLight(0xffffff, 0.78));
const keyL = new THREE.DirectionalLight(0xffffff, 1.05); keyL.position.set(5, 9, 13); scene.add(keyL);
const rimL = new THREE.DirectionalLight(0x88aaff, 0.5); rimL.position.set(-8, 4, -10); scene.add(rimL);
const fillL = new THREE.DirectionalLight(0xffd9a8, 0.3); fillL.position.set(0, -6, 8); scene.add(fillL);

function sysColor(sys) { return new THREE.Color((A.SYSTEMS[sys] && A.SYSTEMS[sys].color) || "#9aa5b1"); }

// ---------- flatmap → 3D mapping (curved "unfolded" sheets) ----------
const S = 0.0108;                       // world units per flatmap px
const RB = 7.2;                         // bend radius (shallow cylinder)
const PHI = THREE.MathUtils.degToRad(19); // open-book half-angle
const XOFF = 3.7, YC = 1.75, ZOFF = 0;

// local bent point for a flatmap coord (before the per-hemisphere group transform)
function localBent(side, lx, ly) {
  let U = (lx - 300) * S;
  const V = (210 - ly) * S;
  if (side === "R") U = -U;             // mirror the right hemisphere
  const th = U / RB;
  return new THREE.Vector3(RB * Math.sin(th), V, -RB * (1 - Math.cos(th)));
}
// the two hemisphere groups (rotated + translated like an open book)
const hemiGroup = {
  L: new THREE.Group(),
  R: new THREE.Group(),
};
hemiGroup.L.rotation.y = PHI;  hemiGroup.L.position.set(-XOFF, YC, ZOFF);
hemiGroup.R.rotation.y = -PHI; hemiGroup.R.position.set(XOFF, YC, ZOFF);
scene.add(hemiGroup.L, hemiGroup.R);
hemiGroup.L.updateMatrixWorld(true);
hemiGroup.R.updateMatrixWorld(true);
// world position of a flatmap coord on a hemisphere
function worldArea(side, lx, ly) {
  return hemiGroup[side].localToWorld(localBent(side, lx, ly));
}

// ---------- label sprites ----------
const labelSprites = [];
function makeLabel(text, opts) {
  opts = opts || {};
  const fs = opts.fs || 40, pad = 12, emoji = opts.emoji;
  const cnv = document.createElement("canvas");
  const ctx = cnv.getContext("2d");
  ctx.font = `${emoji ? fs * 1.5 : fs}px ${emoji ? "serif" : "600 sans-serif"}`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = Math.ceil((emoji ? fs * 1.5 : fs) * 1.3) + pad;
  cnv.width = w; cnv.height = h;
  ctx.font = `${emoji ? "" : "600 "}${emoji ? fs * 1.5 : fs}px ${emoji ? "serif" : "sans-serif"}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (!emoji) {
    ctx.fillStyle = "rgba(8,14,22,.72)";
    roundRect(ctx, 1, 1, w - 2, h - 2, 9); ctx.fill();
    ctx.fillStyle = opts.color || "#e7edf3";
  } else { ctx.fillStyle = "#fff"; }
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cnv); tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  const sc = opts.world || 0.85;
  spr.scale.set((w / h) * sc, sc, 1);
  spr.renderOrder = 10;
  return spr;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function addLabel(text, worldPos, opts) {
  const s = makeLabel(text, opts);
  s.position.copy(worldPos);
  scene.add(s); labelSprites.push(s);
  return s;
}

// ---------- registries ----------
const pos3 = new Map();    // endpoint key -> world Vector3
const meta = new Map();    // key -> {kind, label, ...}
const pickables = [];      // meshes that respond to hover
const regionMeshes = new Map(); // "id:side" -> mesh
const nodeMeshes = new Map();    // key -> mesh (relays/stations/organs)

// ---------- cortex: curved parcellated sheets ----------
function buildShape(side, poly) {
  const shape = new THREE.Shape();
  poly.forEach((p, i) => {
    let U = (p[0] - 300) * S; const V = (210 - p[1]) * S;
    if (side === "R") U = -U;
    if (i === 0) shape.moveTo(U, V); else shape.lineTo(U, V);
  });
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {           // bend flat sheet into 3D
    const U = pos.getX(i), th = U / RB;
    pos.setX(i, RB * Math.sin(th));
    pos.setZ(i, -RB * (1 - Math.cos(th)));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.boundingSphere = null;                          // force raycast bounds refresh
  return g;
}
["L", "R"].forEach((side) => {
  const grp = hemiGroup[side];
  // dark backing sheet (shows through the sulcus gaps between regions)
  const back = new THREE.Mesh(buildShape(side, F.outline),
    new THREE.MeshStandardMaterial({ color: 0x0c1622, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  back.position.z -= 0.05;
  grp.add(back);

  A.AREAS.forEach((area) => {
    const geo = F.areas[area.id], key = area.id + ":" + side;
    const mesh = new THREE.Mesh(buildShape(side, geo.poly),
      new THREE.MeshStandardMaterial({ color: sysColor(area.system), roughness: 0.7, metalness: 0.04,
        emissive: 0x000000, side: THREE.DoubleSide }));
    mesh.userData = { key };
    grp.add(mesh);
    pickables.push(mesh); regionMeshes.set(key, mesh);
    pos3.set(key, worldArea(side, geo.cx, geo.cy));
    meta.set(key, { kind: "area", label: area.label, system: area.system, side, weight: area.weight });

    const lp = worldArea(side, geo.cx, geo.cy).add(new THREE.Vector3(0, 0, 0.05));
    addLabel(area.short, lp, { fs: 30, world: 0.5, color: "#0b121a" });
  });

  const ht = worldArea(side, 300, -40);
  addLabel(side === "L" ? "Left hemisphere" : "Right hemisphere", ht.add(new THREE.Vector3(0, 0.5, 0)),
    { fs: 28, world: 0.78, color: "#7e96ab" });
});

// ---------- thalamus + relay nuclei (3D, sized by real volume) ----------
const THAL_CTR = { L: new THREE.Vector3(-1.25, 1.35, 2.7), R: new THREE.Vector3(1.25, 1.35, 2.7) };
const TBOX = { w: 1.15, h: 1.05 };
const KV = 0.030;                          // glyph radius ∝ cbrt(volume)
function nucleusPos(side, r) {
  const c = THAL_CTR[side], sx = side === "L" ? 1 : -1;
  return new THREE.Vector3(
    c.x + sx * (r.local[0] - 0.5) * TBOX.w,
    c.y + (0.5 - r.local[1]) * TBOX.h,
    c.z);
}
["L", "R"].forEach((side) => {
  // translucent thalamus body
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0x16222f, roughness: 0.85, transparent: true, opacity: 0.32 }));
  body.position.copy(THAL_CTR[side]); body.scale.set(TBOX.w * 0.75, TBOX.h * 0.72, 0.55);
  scene.add(body);
  addLabel("Thalamus", THAL_CTR[side].clone().add(new THREE.Vector3(0, TBOX.h * 0.62, 0)), { fs: 24, world: 0.62, color: "#7e96ab" });

  A.RELAYS.forEach((r) => {
    const key = r.id + ":" + side, p = nucleusPos(side, r), rad = KV * Math.cbrt(r.vol);
    const col = sysColor(r.system);
    let mesh;
    if (r.shape === "lgn") {
      mesh = new THREE.Group();
      for (let i = 0; i < 6; i++) {                // LGN unfolded into 6 layers
        const magno = i >= 4;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(rad * (1 - i * 0.05), rad * (1 - i * 0.05), rad * 0.16, 18),
          new THREE.MeshStandardMaterial({ color: magno ? new THREE.Color("#7d5fb8") : new THREE.Color("#c9b6e6"), roughness: 0.6 }));
        disc.position.set(0, (i - 2.5) * rad * 0.2, 0);
        mesh.add(disc);
      }
      mesh.position.copy(p);
    } else {
      const geo = r.shape === "cushion"
        ? new THREE.SphereGeometry(rad, 18, 14)
        : new THREE.SphereGeometry(rad, 16, 12);
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col.clone().multiplyScalar(0.12) }));
      if (r.shape === "cushion") mesh.scale.set(1.25, 0.85, 0.85);
      mesh.position.copy(p);
    }
    mesh.userData = { key };
    scene.add(mesh);
    pickables.push(mesh.type === "Group" ? mesh.children[0] : mesh); // pick a child for groups
    if (mesh.type === "Group") mesh.children.forEach((ch) => (ch.userData = { key }));
    nodeMeshes.set(key, mesh);
    pos3.set(key, p.clone());
    meta.set(key, { kind: "relay", label: r.label, system: r.system, vol: r.vol });

    const above = r.local[1] < 0.48;
    addLabel(r.shape === "lgn" ? "LGN" : r.label,
      p.clone().add(new THREE.Vector3(0, above ? rad + 0.16 : -(rad + 0.16), 0)), { fs: 20, world: 0.42 });
  });
});

// ---------- other sensory transduction / relay stations ----------
const ST_POS = {
  sc: new THREE.Vector3(0, 0.5, 2.95),
  ic: new THREE.Vector3(0, 0.16, 2.95),
  "olfbulb:L": new THREE.Vector3(-0.6, -1.15, 3.25),
  "olfbulb:R": new THREE.Vector3(0.6, -1.15, 3.25),
};
function stVol(id) { const s = A.STATIONS.find((q) => q.id === id); return s ? s.vol : 50; }
// colliculi as paired bumps (quadrigeminal plate)
["sc", "ic"].forEach((id) => {
  const meta0 = A.STATIONS.find((q) => q.id === id), p = ST_POS[id], rad = Math.max(0.085, KV * Math.cbrt(meta0.vol));
  const col = sysColor(meta0.system);
  const grp = new THREE.Group();
  [-1, 1].forEach((sgn) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col.clone().multiplyScalar(0.12) }));
    m.position.set(sgn * rad * 1.1, 0, 0); m.userData = { key: id }; grp.add(m); pickables.push(m);
  });
  grp.position.copy(p); scene.add(grp); nodeMeshes.set(id, grp);
  pos3.set(id, p.clone());
  meta.set(id, { kind: "station", label: meta0.label, system: meta0.system, vol: meta0.vol });
  addLabel(meta0.label, p.clone().add(new THREE.Vector3(rad * 2.2 + 0.2, 0, 0)), { fs: 19, world: 0.4 });
});
// olfactory bulbs (one per hemisphere), elongated, with a glomerular tip
["L", "R"].forEach((side) => {
  const key = "olfbulb:" + side, p = ST_POS[key], rad = Math.max(0.1, KV * Math.cbrt(stVol("olfbulb")));
  const col = sysColor("olfactory");
  const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col.clone().multiplyScalar(0.12) }));
  m.scale.set(0.8, 1.5, 0.8); m.position.copy(p); m.userData = { key };
  scene.add(m); pickables.push(m); nodeMeshes.set(key, m);
  pos3.set(key, p.clone());
  meta.set(key, { kind: "station", label: "Olfactory bulb", system: "olfactory", vol: stVol("olfbulb") });
  addLabel("Olf. bulb", p.clone().add(new THREE.Vector3(0, rad * 1.5 + 0.18, 0)), { fs: 18, world: 0.38 });
});

// ---------- brainstem + spinal cord ----------
const NODE = {
  brainstem: new THREE.Vector3(0, -0.55, 2.7),
  spinal: new THREE.Vector3(0, -1.85, 2.4),
  eyeL: new THREE.Vector3(-0.6, -2.35, 3.6),
  eyeR: new THREE.Vector3(0.6, -2.35, 3.6),
  earL: new THREE.Vector3(-5.8, 0.5, 1.1),
  earR: new THREE.Vector3(5.8, 0.5, 1.1),
  nose: new THREE.Vector3(0, -2.7, 3.6),
  tongue: new THREE.Vector3(0, -3.1, 3.4),
  body: new THREE.Vector3(-1.6, -2.8, 3.1),
};
(function brainstem() {
  const a = NODE.brainstem, b = NODE.spinal;
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(0.17, 0.12, len + 0.5, 14);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb9c6d2, roughness: 0.7 }));
  m.position.copy(a.clone().lerp(b, 0.5));
  scene.add(m);
  ["brainstem", "spinal"].forEach((id) => {
    pos3.set(id, NODE[id].clone());
    meta.set(id, { kind: "node", label: id === "brainstem" ? "Brainstem" : "Spinal cord" });
  });
  addLabel("Brainstem", NODE.brainstem.clone().add(new THREE.Vector3(0.55, 0.05, 0)), { fs: 18, world: 0.4, color: "#cdd9e5" });
  addLabel(A.BRAINSTEM_RELAYS.map((r) => r.label.split("/")[0]).join(" · "),
    NODE.brainstem.clone().add(new THREE.Vector3(0.55, -0.22, 0)), { fs: 14, world: 0.32, color: "#7e93a6" });
  addLabel("Spinal cord", NODE.spinal.clone().add(new THREE.Vector3(0.5, -0.1, 0)), { fs: 18, world: 0.4, color: "#cdd9e5" });
})();

// ---------- sense organs ----------
const ORGANS = [
  ["eyeL", "👁️", "Left eye"], ["eyeR", "👁️", "Right eye"], ["earL", "👂", "Left ear"],
  ["earR", "👂", "Right ear"], ["nose", "👃", "Nose"], ["tongue", "👅", "Tongue"], ["body", "🖐️", "Body / skin"],
];
ORGANS.forEach(([id, icon, label]) => {
  const p = NODE[id];
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.5, emissive: 0x101820 }));
  m.position.copy(p); m.userData = { key: id }; scene.add(m); pickables.push(m); nodeMeshes.set(id, m);
  pos3.set(id, p.clone());
  meta.set(id, { kind: "organ", label, icon });
  addLabel(icon, p.clone().add(new THREE.Vector3(0, 0.04, 0.06)), { emoji: true, fs: 30, world: 0.95 });
  addLabel(label, p.clone().add(new THREE.Vector3(0, -0.5, 0)), { fs: 18, world: 0.42 });
});

// ---------- wiring: ONE fiber→width standard ----------
const layerGroups = { sensory: new THREE.Group(), ff: new THREE.Group(), fb: new THREE.Group(), callosum: new THREE.Group() };
Object.values(layerGroups).forEach((g) => scene.add(g));
const wireRecs = []; // { mesh, from, to, data }

function pxWidth(fibers) {
  const w = (fibers / 1e6) * A.WIDTH.pxPerMillion;
  return Math.max(A.WIDTH.floor, Math.min(A.WIDTH.cap, w));
}
const PX2R = 0.0034; // px stroke width -> world tube radius (same standard for all)
function tubeRadius(fibers) { return pxWidth(fibers || 0) * PX2R; }

function ctrlPoint(a, b, kind) {
  const mid = a.clone().lerp(b, 0.5);
  if (kind === "callosum") return mid.add(new THREE.Vector3(0, 1.8, -1.2)); // arc up & back over the top
  if (kind === "ff" || kind === "fb") {
    const out = new THREE.Vector3(mid.x, mid.y, mid.z + (kind === "fb" ? 0.9 : 0.5)); // bow toward viewer
    return out;
  }
  return mid.add(new THREE.Vector3(0, 0.1, 0.9)); // sensory/motor bow toward viewer
}
function addWire(o) {
  const a = pos3.get(o.from), b = pos3.get(o.to);
  if (!a || !b) return;
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), ctrlPoint(a, b, o.kind), b.clone());
  const geo = new THREE.TubeGeometry(curve, 26, o.radius, 8, false);
  const col = new THREE.Color(o.color);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5,
    emissive: col.clone().multiplyScalar(0.16), transparent: true, opacity: o.opacity });
  const mesh = new THREE.Mesh(geo, mat);
  o.group.add(mesh);
  wireRecs.push({ mesh, from: o.from, to: o.to, data: o.data, baseOpacity: o.opacity });
}

// sensory inputs, relays & motor
A.PATHWAYS.forEach((p) => {
  const measured = !!p.fibers;
  const color = p.group === "motor" ? "#FF9D4D" : (A.SYSTEMS[p.system] || {}).color || "#9aa5b1";
  addWire({ from: p.from, to: p.to, group: layerGroups.sensory, color, kind: "sensory",
    radius: measured ? tubeRadius(p.fibers) : A.WIDTH.floor * PX2R * 1.6,
    opacity: measured ? 0.9 : 0.5, data: p });
});
// optic taps to superior colliculus (flagged estimate)
["L", "R"].forEach((side) =>
  addWire({ from: "eye" + side, to: "sc", group: layerGroups.sensory, color: (A.SYSTEMS.visual || {}).color, kind: "sensory",
    radius: A.WIDTH.floor * PX2R * 1.3, opacity: 0.4, data: { tract: "Retinotectal tap → superior colliculus", est: true } }));
// corpus callosum (measured ~200M, at the cap)
A.CALLOSUM_AREAS.forEach((id) =>
  addWire({ from: id + ":L", to: id + ":R", group: layerGroups.callosum, color: "#36CFC9", kind: "callosum",
    radius: tubeRadius(200000000), opacity: 0.18,
    data: { tract: "Corpus callosum", fibers: 200000000, ref: "callosum", note: "drawn at the width cap — ~20× off scale" } }));
// cortico-cortical: same standard via estimated order-of-magnitude (hairlines), opacity = strength
const oOpacity = { 1: 0.34, 2: 0.5, 3: 0.68 };
["L", "R"].forEach((side) => {
  A.CORTICO.forEach(([s, t, strength]) => {
    const oom = A.EST_OOM[strength], rad = tubeRadius(oom);
    addWire({ from: s + ":" + side, to: t + ":" + side, group: layerGroups.ff, color: A.DIR.ff, kind: "ff",
      radius: rad, opacity: oOpacity[strength],
      data: { tract: `${s} → ${t} (feed-forward)`, est: true, strength, estOOM: oom, ref: "arcuate_est" } });
    addWire({ from: t + ":" + side, to: s + ":" + side, group: layerGroups.fb, color: A.DIR.fb, kind: "fb",
      radius: rad, opacity: oOpacity[strength] * 0.85,
      data: { tract: `${t} → ${s} (feedback)`, est: true, strength, estOOM: oom, ref: "arcuate_est" } });
  });
});

// ---------- interaction (raycast hover) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

function nameOf(ref) {
  const m = meta.get(ref);
  if (!m) return ref;
  return m.kind === "area" ? `${m.label} (${m.side})` : m.label;
}
function setHover(key) {
  if (hovered === key) return;
  hovered = key;
  const connected = new Set();
  if (key) { connected.add(key); wireRecs.forEach((r) => { if (r.from === key || r.to === key) { connected.add(r.from); connected.add(r.to); } }); }
  regionMeshes.forEach((mesh, k) => {
    const on = !key || connected.has(k);
    mesh.material.emissive.setHex(k === key ? 0x555555 : 0x000000);
    mesh.material.opacity = on ? 1 : 0.22;
    mesh.material.transparent = !on;
  });
  wireRecs.forEach((r) => {
    const on = !key || r.from === key || r.to === key;
    r.mesh.material.opacity = on ? Math.max(r.baseOpacity, key ? 0.95 : r.baseOpacity) : 0.04;
  });
  if (key) showInfo(key); else hideInfo();
}
function showInfo(key) {
  const m = meta.get(key); if (!m) return;
  const conns = wireRecs.filter((r) => r.from === key || r.to === key);
  const cite = A.CITATIONS;
  const li = (r) => {
    const other = r.from === key ? r.to : r.from, dir = r.from === key ? "→" : "←", d = r.data;
    const detail = d.fibers ? `<span class="count">${d.fibers.toLocaleString()} fibers</span>` :
      d.estOOM ? `<span class="muted">~${d.estOOM.toLocaleString()} (est.)</span>` :
      d.est ? `<span class="muted">not measured</span>` : "";
    return `<li><span class="tract">${nameOf(other)}</span> ${dir} ${detail}</li>`;
  };
  let head;
  if (m.kind === "area") head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div>` +
    `<div class="sub">${A.SYSTEMS[m.system].name} · ${m.side === "L" ? "Left" : "Right"} · ≈${m.weight} cm² unfolded</div>`;
  else if (m.kind === "relay") head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div>` +
    `<div class="sub">Thalamic relay · ≈${m.vol} mm³</div>`;
  else if (m.kind === "station") head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div>` +
    `<div class="sub">Sensory relay station · ≈${m.vol} mm³</div>`;
  else head = `<div class="h">${m.icon || ""} ${m.label}</div><div class="sub">${m.kind === "organ" ? "Sense organ" : ""}</div>`;
  const el = document.getElementById("info");
  el.innerHTML = head + (conns.length ? `<ul>${conns.map(li).join("")}</ul>` : "");
  el.classList.add("open");
}
function hideInfo() { document.getElementById("info").classList.remove("open"); }

canvas.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  setHover(hits.length ? hits[0].object.userData.key : null);
});

// ---------- controls UI ----------
(function buildUI() {
  const lt = document.getElementById("layer-toggles");
  [["sensory", "Senses, relays & motor"], ["ff", "Feed-forward (cortico)"], ["fb", "Feedback (cortico)"], ["callosum", "Corpus callosum"]]
    .forEach(([k, label]) => {
      const l = document.createElement("label"); l.className = "toggle";
      l.innerHTML = `<input type="checkbox" checked> ${label}`;
      l.querySelector("input").addEventListener("change", (e) => { layerGroups[k].visible = e.target.checked; });
      lt.appendChild(l);
    });
  document.getElementById("t-labels").addEventListener("change", (e) => labelSprites.forEach((s) => (s.visible = e.target.checked)));
  document.getElementById("t-spin").addEventListener("change", (e) => (controls.autoRotate = e.target.checked));
  controls.autoRotateSpeed = 0.7;

  const lg = document.getElementById("legend");
  [["Feed-forward (cortico)", A.DIR.ff], ["Feedback (cortico)", A.DIR.fb], ["Corpus callosum", "#36CFC9"], ["Sensory / motor (measured)", "#5B8FF9"]]
    .forEach(([name, color]) => {
      const row = document.createElement("div"); row.className = "lg-row";
      row.innerHTML = `<span class="sw" style="border-color:${color}"></span> ${name}`;
      lg.appendChild(row);
    });
  const note = document.createElement("p"); note.className = "hint";
  note.innerHTML = `Tube radius rides one standard (${A.WIDTH.pxPerMillion}px = 1M fibers). Olfactory (~7M) is thick, cochlear (~31k) a hairline, callosum (~200M) capped. Cortico area-pairs (~10³–10⁵, est.) are hairlines — strength shown by opacity.`;
  lg.parentNode.appendChild(note);
})();

// ---------- render loop ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.getElementById("loading").style.display = "none";
function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
