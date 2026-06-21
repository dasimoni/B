/*
 * app.js — "Brain in 3D" (Three.js)
 * ---------------------------------
 * The realistic unfolded view, in 3D. Each hemisphere is a CURVED, parcellated
 * cortical sheet (real flatmap polygons sized by cm²); the thalamus, its relay
 * nuclei (LGN unfolded into layers), and the other sensory transduction stations
 * are 3D glyphs sized by real volume; every wire is a 3D tube whose radius rides
 * ONE fiber→width standard. Two interaction features:
 *   • an EXPLODE slider that pulls every connection endpoint radially apart so
 *     the circuitry spreads out in space and can be inspected;
 *   • connections with no firm fiber count are drawn SOLID but with a striped
 *     texture (and listed as estimates), so they read as "not firmly measured"
 *     without being faint.
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
scene.fog = new THREE.Fog("#06090e", 26, 80);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 2.4, 15.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.7, 1.4);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 170;

scene.add(new THREE.AmbientLight(0xffffff, 0.78));
const keyL = new THREE.DirectionalLight(0xffffff, 1.05); keyL.position.set(5, 9, 13); scene.add(keyL);
const rimL = new THREE.DirectionalLight(0x88aaff, 0.5); rimL.position.set(-8, 4, -10); scene.add(rimL);
const fillL = new THREE.DirectionalLight(0xffd9a8, 0.3); fillL.position.set(0, -6, 8); scene.add(fillL);

function sysColor(sys) { return new THREE.Color((A.SYSTEMS[sys] && A.SYSTEMS[sys].color) || "#9aa5b1"); }

// ---------- flatmap → 3D mapping (curved "unfolded" sheets) ----------
const S = 0.0108, RB = 7.2, PHI = THREE.MathUtils.degToRad(19);
const XOFF = 3.7, YC = 1.75, ZOFF = 0;
function localBent(side, lx, ly) {
  let U = (lx - 300) * S; const V = (210 - ly) * S;
  if (side === "R") U = -U;
  const th = U / RB;
  return new THREE.Vector3(RB * Math.sin(th), V, -RB * (1 - Math.cos(th)));
}
const hemiGroup = { L: new THREE.Group(), R: new THREE.Group() };
const gBase = { L: new THREE.Vector3(-XOFF, YC, ZOFF), R: new THREE.Vector3(XOFF, YC, ZOFF) };
hemiGroup.L.rotation.y = PHI;  hemiGroup.L.position.copy(gBase.L);
hemiGroup.R.rotation.y = -PHI; hemiGroup.R.position.copy(gBase.R);
scene.add(hemiGroup.L, hemiGroup.R);
hemiGroup.L.updateMatrixWorld(true); hemiGroup.R.updateMatrixWorld(true);
function worldArea(side, lx, ly) { return hemiGroup[side].localToWorld(localBent(side, lx, ly)); }

// ---------- explode model ----------
const EXC = new THREE.Vector3(0, 0.5, 1.5);  // explosion center
let currentF = 1;                             // 1 = collapsed; grows with slider
const explodePos = (base) => EXC.clone().add(base.clone().sub(EXC).multiplyScalar(currentF));

// ---------- label sprites ----------
const labelSprites = [];
const labelByKey = new Map();   // node key -> [sprites] (for "on hover" mode)
const ambientLabels = [];       // hemisphere titles, "Thalamus", organ emojis
let labelMode = "hover";        // "hover" | "always" | "off"
function setLabelVis(nodeSet) {
  if (labelMode === "off") { labelSprites.forEach((s) => (s.visible = false)); return; }
  if (labelMode === "always") { labelSprites.forEach((s) => (s.visible = true)); return; }
  ambientLabels.forEach((s) => (s.visible = true)); // hover mode
  labelByKey.forEach((arr, key) => { const v = !!(nodeSet && nodeSet.has(key)); arr.forEach((s) => (s.visible = v)); });
}
function makeLabel(text, opts) {
  opts = opts || {};
  const emoji = opts.emoji, pad = 16;
  const fs = (opts.fs || 40) * 2;                 // 2× supersample for crisp text
  const font = emoji ? `${Math.round(fs * 1.35)}px serif` : `600 ${fs}px sans-serif`;
  const cnv = document.createElement("canvas");
  const ctx = cnv.getContext("2d");
  ctx.font = font;                                // SAME valid font for measure & draw
  const tw = Math.ceil(ctx.measureText(text).width);
  const w = tw + pad * 2, h = Math.ceil((emoji ? fs * 1.35 : fs) * 1.25) + pad;
  cnv.width = w; cnv.height = h;
  ctx.font = font;                                // re-set after resize clears it
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (!emoji) {
    ctx.fillStyle = "rgba(6,10,16,.82)";
    roundRect(ctx, 2, 2, w - 4, h - 4, 12); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(120,150,175,.35)"; ctx.stroke();
    ctx.fillStyle = opts.color || "#e7edf3";
  } else { ctx.fillStyle = "#fff"; }
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cnv);
  tex.anisotropy = 8; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  const worldH = opts.world || 0.5;
  spr.scale.set(worldH * (w / h), worldH, 1);     // preserve aspect → no squashing
  spr.renderOrder = 12;
  return spr;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function addLabelTo(parent, text, localPos, opts, key) {
  const s = makeLabel(text, opts); s.position.copy(localPos);
  parent.add(s); labelSprites.push(s);
  if (key) { if (!labelByKey.has(key)) labelByKey.set(key, []); labelByKey.get(key).push(s); }
  else ambientLabels.push(s);
  return s;
}

// ---------- registries ----------
const pos3 = new Map();        // endpoint key -> CURRENT world Vector3
const basePos3 = new Map();    // endpoint key -> collapsed world Vector3 (for nodes that move as a unit)
const meta = new Map();
const pickables = [];
const regionMeshes = new Map();
const nodeObjs = new Map();     // key -> THREE.Group that moves on explode (relays/stations/organs/stem)

// a movable node = an unscaled Group holding the glyph mesh(es) + its label(s)
function makeNode(key, worldPos) {
  const g = new THREE.Group(); g.position.copy(worldPos); scene.add(g);
  nodeObjs.set(key, g); basePos3.set(key, worldPos.clone()); pos3.set(key, worldPos.clone());
  return g;
}

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
  for (let i = 0; i < pos.count; i++) {
    const U = pos.getX(i), th = U / RB;
    pos.setX(i, RB * Math.sin(th)); pos.setZ(i, -RB * (1 - Math.cos(th)));
  }
  pos.needsUpdate = true; g.computeVertexNormals(); g.boundingSphere = null;
  return g;
}
["L", "R"].forEach((side) => {
  const grp = hemiGroup[side];
  const back = new THREE.Mesh(buildShape(side, F.outline),
    new THREE.MeshStandardMaterial({ color: 0x0c1622, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  back.position.z -= 0.05; grp.add(back);

  A.AREAS.forEach((area) => {
    const geo = F.areas[area.id], key = area.id + ":" + side;
    const mesh = new THREE.Mesh(buildShape(side, geo.poly),
      new THREE.MeshStandardMaterial({ color: sysColor(area.system), roughness: 0.7, metalness: 0.04, side: THREE.DoubleSide }));
    mesh.userData = { key }; grp.add(mesh);
    pickables.push(mesh); regionMeshes.set(key, mesh);
    pos3.set(key, worldArea(side, geo.cx, geo.cy));
    meta.set(key, { kind: "area", label: area.label, system: area.system, side, weight: area.weight });
    // label is a child of the rigid hemisphere group (moves with it on explode)
    addLabelTo(grp, area.short, localBent(side, geo.cx, geo.cy).add(new THREE.Vector3(0, 0, 0.08)), { fs: 28, world: 0.5, color: "#eef4f9" }, key);
  });
  addLabelTo(grp, side === "L" ? "Left hemisphere" : "Right hemisphere",
    localBent(side, 300, -40).add(new THREE.Vector3(0, 0.5, 0)), { fs: 28, world: 0.78, color: "#7e96ab" });
});

// ---------- thalamus + relay nuclei (sized by real volume) ----------
const THAL_CTR = { L: new THREE.Vector3(-1.25, 1.35, 2.7), R: new THREE.Vector3(1.25, 1.35, 2.7) };
const TBOX = { w: 1.15, h: 1.05 }, KV = 0.030;
const thalBodies = [];
function nucleusLocalOffset(side, r) {
  const sx = side === "L" ? 1 : -1;
  return new THREE.Vector3(sx * (r.local[0] - 0.5) * TBOX.w, (0.5 - r.local[1]) * TBOX.h, 0);
}
["L", "R"].forEach((side) => {
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0x16222f, roughness: 0.85, transparent: true, opacity: 0.3 }));
  const bScale = new THREE.Vector3(TBOX.w * 0.78, TBOX.h * 0.74, 0.58);
  body.position.copy(THAL_CTR[side]); body.scale.copy(bScale);
  scene.add(body);
  thalBodies.push({ mesh: body, base: THAL_CTR[side].clone(), baseScale: bScale.clone() });

  A.RELAYS.forEach((r) => {
    const key = r.id + ":" + side;
    const wp = THAL_CTR[side].clone().add(nucleusLocalOffset(side, r));
    const g = makeNode(key, wp);
    const rad = KV * Math.cbrt(r.vol), col = sysColor(r.system);
    if (r.shape === "lgn") {
      for (let i = 0; i < 6; i++) {
        const magno = i >= 4;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(rad * (1 - i * 0.05), rad * (1 - i * 0.05), rad * 0.16, 18),
          new THREE.MeshStandardMaterial({ color: new THREE.Color(magno ? "#7d5fb8" : "#c9b6e6"), roughness: 0.6 }));
        disc.position.set(0, (i - 2.5) * rad * 0.2, 0); disc.userData = { key }; g.add(disc); pickables.push(disc);
      }
    } else {
      const geo = new THREE.SphereGeometry(rad, 18, 14);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col.clone().multiplyScalar(0.12) }));
      if (r.shape === "cushion") m.scale.set(1.25, 0.85, 0.85);
      m.userData = { key }; g.add(m); pickables.push(m);
    }
    meta.set(key, { kind: "relay", label: r.label, system: r.system, vol: r.vol });
    const above = r.local[1] < 0.48;
    addLabelTo(g, r.shape === "lgn" ? "LGN" : r.label, new THREE.Vector3(0, above ? rad + 0.16 : -(rad + 0.16), 0), { fs: 20, world: 0.42 }, key);
  });
  addLabelTo(nodeObjs.get("pulvinar:" + side), "Thalamus", new THREE.Vector3(side === "L" ? -0.2 : 0.2, 0.55, 0), { fs: 22, world: 0.55, color: "#7e96ab" });
});

// ---------- other sensory transduction / relay stations ----------
const ST_POS = {
  sc: new THREE.Vector3(0, 0.5, 2.95), ic: new THREE.Vector3(0, 0.16, 2.95),
  "olfbulb:L": new THREE.Vector3(-0.6, -1.15, 3.25), "olfbulb:R": new THREE.Vector3(0.6, -1.15, 3.25),
};
function stVol(id) { const s = A.STATIONS.find((q) => q.id === id); return s ? s.vol : 50; }
["sc", "ic"].forEach((id) => {
  const m0 = A.STATIONS.find((q) => q.id === id), rad = Math.max(0.085, KV * Math.cbrt(m0.vol)), col = sysColor(m0.system);
  const g = makeNode(id, ST_POS[id]);
  [-1, 1].forEach((sgn) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col.clone().multiplyScalar(0.12) }));
    m.position.set(sgn * rad * 1.1, 0, 0); m.userData = { key: id }; g.add(m); pickables.push(m);
  });
  meta.set(id, { kind: "station", label: m0.label, system: m0.system, vol: m0.vol });
  addLabelTo(g, m0.label, new THREE.Vector3(rad * 2.2 + 0.25, 0, 0), { fs: 19, world: 0.4 }, id);
});
["L", "R"].forEach((side) => {
  const key = "olfbulb:" + side, rad = Math.max(0.1, KV * Math.cbrt(stVol("olfbulb"))), col = sysColor("olfactory");
  const g = makeNode(key, ST_POS[key]);
  const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col.clone().multiplyScalar(0.12) }));
  m.scale.set(0.8, 1.5, 0.8); m.userData = { key }; g.add(m); pickables.push(m);
  meta.set(key, { kind: "station", label: "Olfactory bulb", system: "olfactory", vol: stVol("olfbulb") });
  addLabelTo(g, "Olf. bulb", new THREE.Vector3(0, rad * 1.5 + 0.2, 0), { fs: 18, world: 0.38 }, key);
});

// ---------- brainstem + spinal cord (two movable anchors + a cord) ----------
const BS = { brainstem: new THREE.Vector3(0, -0.55, 2.7), spinal: new THREE.Vector3(0, -1.85, 2.4) };
const gBrain = makeNode("brainstem", BS.brainstem);
meta.set("brainstem", { kind: "node", label: "Brainstem" });
addLabelTo(gBrain, "Brainstem", new THREE.Vector3(0.55, 0.05, 0), { fs: 18, world: 0.4, color: "#cdd9e5" }, "brainstem");
addLabelTo(gBrain, A.BRAINSTEM_RELAYS.map((r) => r.label.split("/")[0]).join(" · "), new THREE.Vector3(0.55, -0.22, 0), { fs: 14, world: 0.32, color: "#7e93a6" }, "brainstem");
const gSpine = makeNode("spinal", BS.spinal);
meta.set("spinal", { kind: "node", label: "Spinal cord" });
addLabelTo(gSpine, "Spinal cord", new THREE.Vector3(0.5, -0.1, 0), { fs: 18, world: 0.4, color: "#cdd9e5" }, "spinal");
const cordMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 1, 14),
  new THREE.MeshStandardMaterial({ color: 0xb9c6d2, roughness: 0.7 }));
scene.add(cordMesh);
function updateCord() {
  const a = pos3.get("brainstem"), b = pos3.get("spinal"), len = a.distanceTo(b);
  cordMesh.position.copy(a.clone().lerp(b, 0.5));
  cordMesh.scale.set(1, len, 1);
  cordMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}
updateCord();

// ---------- sense organs ----------
[["eyeL", "👁️", "Left eye", new THREE.Vector3(-0.6, -2.35, 3.6)], ["eyeR", "👁️", "Right eye", new THREE.Vector3(0.6, -2.35, 3.6)],
 ["earL", "👂", "Left ear", new THREE.Vector3(-5.8, 0.5, 1.1)], ["earR", "👂", "Right ear", new THREE.Vector3(5.8, 0.5, 1.1)],
 ["nose", "👃", "Nose", new THREE.Vector3(0, -2.7, 3.6)], ["tongue", "👅", "Tongue", new THREE.Vector3(0, -3.1, 3.4)],
 ["body", "🖐️", "Body / skin", new THREE.Vector3(-1.6, -2.8, 3.1)]].forEach(([id, icon, label, wp]) => {
  const g = makeNode(id, wp);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.5, emissive: 0x101820 }));
  m.userData = { key: id }; g.add(m); pickables.push(m);
  meta.set(id, { kind: "organ", label, icon });
  addLabelTo(g, icon, new THREE.Vector3(0, 0.05, 0.06), { emoji: true, fs: 30, world: 0.95 });
  addLabelTo(g, label, new THREE.Vector3(0, -0.5, 0), { fs: 18, world: 0.42 }, id);
});

// ---------- wiring: ONE fiber→width standard; estimates solid + striped ----------
const layerGroups = { sensory: new THREE.Group(), ff: new THREE.Group(), fb: new THREE.Group(), callosum: new THREE.Group() };
Object.values(layerGroups).forEach((g) => scene.add(g));
const wireRecs = [];

function pxWidth(fibers) { const w = (fibers / 1e6) * A.WIDTH.pxPerMillion; return Math.max(A.WIDTH.floor, Math.min(A.WIDTH.cap, w)); }
const PX2R = 0.0034;
const tubeRadius = (fibers) => pxWidth(fibers || 0) * PX2R;

// striped texture marking an estimate (solid, but visibly "not firmly measured")
const stripeCache = new Map();
function stripeBase(hex) {
  if (stripeCache.has(hex)) return stripeCache.get(hex);
  const base = new THREE.Color(hex), mute = base.clone().lerp(new THREE.Color("#0a0f16"), 0.62);
  const c = document.createElement("canvas"); c.width = 16; c.height = 4;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `#${base.getHexString()}`; ctx.fillRect(0, 0, 16, 4);
  ctx.fillStyle = `#${mute.getHexString()}`; ctx.fillRect(9, 0, 7, 4); // band → dashed look
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  stripeCache.set(hex, t); return t;
}
const UP = new THREE.Vector3(0, 1, 0);
function ctrlPoint(a, b, kind) {
  const mid = a.clone().lerp(b, 0.5), bow = 0.7 + 0.3 * currentF;
  if (kind === "callosum") return mid.add(new THREE.Vector3(0, 1.4 * bow, -1.0 * bow));
  if (kind === "ff" || kind === "fb") {
    // separate the two directions into opposite lanes so they never overlap
    let perp = new THREE.Vector3().crossVectors(b.clone().sub(a), UP);
    if (perp.lengthSq() < 1e-4) perp.set(1, 0, 0);
    perp.normalize();
    const side = kind === "ff" ? 1 : -1;
    return mid.add(perp.multiplyScalar(side * 0.3 * bow)).add(new THREE.Vector3(0, 0, 0.34 * bow));
  }
  return mid.add(new THREE.Vector3(0, 0.1 * bow, 0.85 * bow)); // sensory / motor
}
// directional arrowhead (cone) near the target end of a wire
function makeArrow(curve, def) {
  if (def.kind === "callosum") return null;
  const len = Math.max(0.09, def.radius * 5.5), rad = Math.max(0.05, def.radius * 3.2);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color),
      emissive: new THREE.Color(def.color).multiplyScalar(0.28), roughness: 0.45, transparent: true, opacity: 1 }));
  def.group.add(cone);
  placeArrow(cone, curve);
  return cone;
}
function placeArrow(cone, curve) {
  cone.position.copy(curve.getPoint(0.9));
  cone.quaternion.setFromUnitVectors(UP, curve.getTangent(0.9).normalize());
}
function makeWireMesh(def) {
  const a = pos3.get(def.from), b = pos3.get(def.to);
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), ctrlPoint(a, b, def.kind), b.clone());
  const geo = new THREE.TubeGeometry(curve, 26, def.radius, 8, false);
  const col = new THREE.Color(def.color);
  let mat, tex = null;
  if (def.est) {
    tex = stripeBase(def.color).clone(); tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(2, Math.round(curve.getLength() / 0.2)), 1);
    mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.5,
      emissive: col.clone().multiplyScalar(0.12), transparent: true, opacity: 1.0 });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5,
      emissive: col.clone().multiplyScalar(0.16), transparent: true, opacity: def.opacity });
  }
  const mesh = new THREE.Mesh(geo, mat);
  def.group.add(mesh);
  const arrow = makeArrow(curve, def);
  return { mesh, arrow, def, tex, baseOpacity: def.est ? 1.0 : def.opacity };
}
function rebuildWires() {
  wireRecs.forEach((rec) => {
    const a = pos3.get(rec.def.from), b = pos3.get(rec.def.to); if (!a || !b) return;
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), ctrlPoint(a, b, rec.def.kind), b.clone());
    rec.mesh.geometry.dispose();
    rec.mesh.geometry = new THREE.TubeGeometry(curve, 26, rec.def.radius, 8, false);
    if (rec.tex) rec.tex.repeat.set(Math.max(2, Math.round(curve.getLength() / 0.2)), 1);
    if (rec.arrow) placeArrow(rec.arrow, curve);
  });
}
function defWire(d) { const a = pos3.get(d.from), b = pos3.get(d.to); if (!a || !b) return; wireRecs.push(makeWireMesh(d)); }

// sensory inputs, relays & motor
A.PATHWAYS.forEach((p) => {
  const measured = !!p.fibers;
  const color = p.group === "motor" ? "#FF9D4D" : (A.SYSTEMS[p.system] || {}).color || "#9aa5b1";
  defWire({ from: p.from, to: p.to, group: layerGroups.sensory, color, kind: "sensory",
    radius: measured ? tubeRadius(p.fibers) : A.WIDTH.floor * PX2R * 1.7, opacity: 0.9, est: !measured, data: p });
});
["L", "R"].forEach((side) =>
  defWire({ from: "eye" + side, to: "sc", group: layerGroups.sensory, color: (A.SYSTEMS.visual || {}).color, kind: "sensory",
    radius: A.WIDTH.floor * PX2R * 1.4, opacity: 0.9, est: true, data: { tract: "Retinotectal tap → superior colliculus", est: true } }));
A.CALLOSUM_AREAS.forEach((id) =>
  defWire({ from: id + ":L", to: id + ":R", group: layerGroups.callosum, color: "#36CFC9", kind: "callosum",
    radius: tubeRadius(200000000), opacity: 0.2, est: false,
    data: { tract: "Corpus callosum", fibers: 200000000, ref: "callosum", note: "drawn at the width cap — ~20× off scale" } }));
["L", "R"].forEach((side) => {
  A.CORTICO.forEach(([s, t, strength]) => {
    const rad = tubeRadius(A.EST_OOM[strength]);
    defWire({ from: s + ":" + side, to: t + ":" + side, group: layerGroups.ff, color: A.DIR.ff, kind: "ff",
      radius: rad, opacity: 0.97, est: true, data: { tract: `${s} → ${t} (feed-forward)`, est: true, strength, estOOM: A.EST_OOM[strength], ref: "arcuate_est" } });
    defWire({ from: t + ":" + side, to: s + ":" + side, group: layerGroups.fb, color: A.DIR.fb, kind: "fb",
      radius: rad, opacity: 0.97, est: true, data: { tract: `${t} → ${s} (feedback)`, est: true, strength, estOOM: A.EST_OOM[strength], ref: "arcuate_est" } });
  });
});

// ---------- explode update ----------
function updateExplode(t) {
  currentF = 1 + t * 4.0;                       // explode much farther
  scene.fog.near = 26 + 120 * t;                // push fog out so it stays visible
  scene.fog.far = 80 + 360 * t;
  ["L", "R"].forEach((s) => { hemiGroup[s].position.copy(explodePos(gBase[s])); hemiGroup[s].updateMatrixWorld(true); });
  ["L", "R"].forEach((s) => A.AREAS.forEach((a) => pos3.set(a.id + ":" + s, worldArea(s, F.areas[a.id].cx, F.areas[a.id].cy))));
  nodeObjs.forEach((g, key) => { const p = explodePos(basePos3.get(key)); g.position.copy(p); pos3.set(key, p.clone()); });
  thalBodies.forEach((tb) => { tb.mesh.position.copy(explodePos(tb.base)); tb.mesh.scale.copy(tb.baseScale).multiplyScalar(currentF); });
  updateCord();
  rebuildWires();
}

// ---------- interaction (raycast hover) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null, activeModality = null;
const modBtns = new Map();
function nameOf(ref) { const m = meta.get(ref); return m ? (m.kind === "area" ? `${m.label} (${m.side})` : m.label) : ref; }

// forward adjacency (afferent/relay/motor + feed-forward) for pathway tracing
const fwdAdj = new Map();
wireRecs.forEach((r) => {
  if (r.def.kind === "sensory" || r.def.kind === "ff") {
    if (!fwdAdj.has(r.def.from)) fwdAdj.set(r.def.from, []);
    fwdAdj.get(r.def.from).push(r);
  }
});
const MODS = [
  { id: "vision", label: "Vision", sys: "visual", starts: ["eyeL", "eyeR"] },
  { id: "hearing", label: "Hearing", sys: "auditory", starts: ["earL", "earR"] },
  { id: "touch", label: "Touch", sys: "somatosensory", starts: ["body"] },
  { id: "smell", label: "Smell", sys: "olfactory", starts: ["nose"] },
  { id: "taste", label: "Taste", sys: "gustatory", starts: ["tongue"] },
  { id: "motor", label: "Motor", sys: "motor", starts: ["m1:L", "m1:R"] },
];
// BFS forward from the organ; for the senses, stop expanding once the stream
// reaches executive/motor cortex (so each modality stays distinct, not flooding
// all the way to muscles — except the Motor button itself).
function traceModality(mod) {
  const nodeSet = new Set(), recSet = new Set(), order = [], q = [...mod.starts];
  mod.starts.forEach((s) => { nodeSet.add(s); order.push(s); });
  for (let qi = 0; qi < q.length; qi++) {
    const n = q[qi], m = meta.get(n);
    if (mod.id !== "motor" && m && m.kind === "area" && (m.system === "executive" || m.system === "motor")) continue;
    (fwdAdj.get(n) || []).forEach((r) => {
      recSet.add(r);
      if (!nodeSet.has(r.def.to)) { nodeSet.add(r.def.to); order.push(r.def.to); q.push(r.def.to); }
    });
  }
  return { nodeSet, recSet, order };
}
function applyHighlight(nodeSet, recSet) {
  pickables.forEach((m) => {
    const on = !nodeSet || nodeSet.has(m.userData.key);
    m.material.transparent = true; m.material.opacity = on ? 1 : 0.1;
    if (regionMeshes.has(m.userData.key)) m.material.emissive.setHex(0x000000);
  });
  wireRecs.forEach((r) => {
    const on = !recSet || recSet.has(r);
    r.mesh.material.opacity = on ? r.baseOpacity : 0.03;
    if (r.arrow) { r.arrow.material.transparent = true; r.arrow.material.opacity = on ? 1 : 0.03; }
  });
  setLabelVis(nodeSet);
}
function clearHighlight() { applyHighlight(null, null); }
function refreshLabels() {
  let ns = null;
  if (hovered) { ns = new Set([hovered]); wireRecs.forEach((r) => { if (r.def.from === hovered || r.def.to === hovered) { ns.add(r.def.from); ns.add(r.def.to); } }); }
  else if (activeModality) ns = traceModality(MODS.find((m) => m.id === activeModality)).nodeSet;
  setLabelVis(ns);
}
function applyModality(id) {
  const mod = MODS.find((m) => m.id === id); if (!mod) return;
  const { nodeSet, recSet, order } = traceModality(mod);
  applyHighlight(nodeSet, recSet);
  const col = (A.SYSTEMS[mod.sys] || {}).color || "#9aa5b1";
  const el = document.getElementById("info");
  el.innerHTML = `<div class="h"><span class="sw-dot" style="background:${col}"></span>${mod.label} pathway</div>` +
    `<div class="sub">${order.length} stations · organ → relay → cortex → onward</div>` +
    `<ul>${order.slice(0, 18).map((k) => `<li>${nameOf(k)}</li>`).join("")}${order.length > 18 ? "<li>…</li>" : ""}</ul>`;
  el.classList.add("open");
}
function setModality(id) {
  activeModality = id;
  modBtns.forEach((b, bid) => { const on = bid === id; b.classList.toggle("active", on); b.style.background = on ? b.dataset.col : ""; });
  if (id) applyModality(id); else { clearHighlight(); hideInfo(); }
}
function toggleModality(id) { setModality(activeModality === id ? null : id); }

function setHover(key) {
  if (hovered === key) return;
  hovered = key;
  if (key) {
    const nodeSet = new Set([key]), recSet = new Set();
    wireRecs.forEach((r) => { if (r.def.from === key || r.def.to === key) { recSet.add(r); nodeSet.add(r.def.from); nodeSet.add(r.def.to); } });
    applyHighlight(nodeSet, recSet);
    if (regionMeshes.has(key)) regionMeshes.get(key).material.emissive.setHex(0x555555);
    showInfo(key);
  } else if (activeModality) {
    applyModality(activeModality);
  } else { clearHighlight(); hideInfo(); }
}
function showInfo(key) {
  const m = meta.get(key); if (!m) return;
  const conns = wireRecs.filter((r) => r.def.from === key || r.def.to === key);
  const li = (r) => {
    const d = r.def.data, other = r.def.from === key ? r.def.to : r.def.from, dir = r.def.from === key ? "→" : "←";
    const detail = d.fibers ? `<span class="count">${d.fibers.toLocaleString()} fibers</span>` :
      d.estOOM ? `<span class="muted">~${d.estOOM.toLocaleString()} (est.)</span>` :
      d.est ? `<span class="muted">not measured</span>` : "";
    const cite = d.ref && A.CITATIONS[d.ref];
    const src = cite && cite.url ? ` <a href="${cite.url}" target="_blank" rel="noopener">src</a>` : "";
    return `<li><span class="tract">${nameOf(other)}</span> ${dir} ${detail}${src}</li>`;
  };
  let head;
  if (m.kind === "area") head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div><div class="sub">${A.SYSTEMS[m.system].name} · ${m.side === "L" ? "Left" : "Right"} · ≈${m.weight} cm² unfolded</div>`;
  else if (m.kind === "relay") head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div><div class="sub">Thalamic relay · ≈${m.vol} mm³</div>`;
  else if (m.kind === "station") head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div><div class="sub">Sensory relay station · ≈${m.vol} mm³</div>`;
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
let pendingT = 0, appliedT = -1;
(function buildUI() {
  const mb = document.getElementById("modality-btns");
  MODS.forEach((mod) => {
    const col = (A.SYSTEMS[mod.sys] || {}).color || "#9aa5b1";
    const b = document.createElement("button"); b.className = "modbtn"; b.dataset.col = col;
    b.innerHTML = `<span class="swd" style="background:${col}"></span>${mod.label}`;
    b.addEventListener("click", () => toggleModality(mod.id));
    modBtns.set(mod.id, b); mb.appendChild(b);
  });
  const allb = document.createElement("button"); allb.className = "modbtn"; allb.textContent = "Show all";
  allb.addEventListener("click", () => setModality(null)); mb.appendChild(allb);

  const lt = document.getElementById("layer-toggles");
  [["sensory", "Senses, relays & motor"], ["ff", "Feed-forward (cortico)"], ["fb", "Feedback (cortico)"], ["callosum", "Corpus callosum"]]
    .forEach(([k, label]) => {
      const l = document.createElement("label"); l.className = "toggle";
      l.innerHTML = `<input type="checkbox" checked> ${label}`;
      l.querySelector("input").addEventListener("change", (e) => { layerGroups[k].visible = e.target.checked; });
      lt.appendChild(l);
    });
  document.getElementById("label-mode").addEventListener("change", (e) => { labelMode = e.target.value; refreshLabels(); });
  document.getElementById("t-spin").addEventListener("change", (e) => (controls.autoRotate = e.target.checked));
  controls.autoRotateSpeed = 0.7;

  const slider = document.getElementById("explode"), val = document.getElementById("explode-val");
  slider.addEventListener("input", (e) => { pendingT = +e.target.value / 100; val.textContent = e.target.value + "%"; });

  const lg = document.getElementById("legend");
  [["Feed-forward (cortico)", A.DIR.ff], ["Feedback (cortico)", A.DIR.fb], ["Corpus callosum", "#36CFC9"], ["Sensory / motor (measured)", "#5B8FF9"]]
    .forEach(([name, color]) => {
      const row = document.createElement("div"); row.className = "lg-row";
      row.innerHTML = `<span class="sw" style="border-color:${color}"></span> ${name}`;
      lg.appendChild(row);
    });
  const est = document.createElement("div"); est.className = "lg-row";
  est.innerHTML = `<span class="sw-striped"></span> Estimated — solid but striped (not firmly measured)`;
  lg.appendChild(est);
  const arr = document.createElement("div"); arr.className = "lg-row";
  arr.innerHTML = `<span style="color:#cdd9e5">►</span> Arrowheads show signal direction · feed-forward & feedback run in separate lanes`;
  lg.appendChild(arr);
  const note = document.createElement("p"); note.className = "hint";
  note.innerHTML = `Tube radius rides one standard (${A.WIDTH.pxPerMillion}px = 1M fibers): olfactory (~7M) thick, cochlear (~31k) a hairline, callosum (~200M) capped, cortico area-pairs (~10³–10⁵, est.) hairline.`;
  lg.parentNode.appendChild(note);

  // source papers for the data (same citations as the 2D view)
  const src = document.getElementById("sources");
  Object.values(A.CITATIONS).forEach((c) => {
    const liEl = document.createElement("li");
    liEl.innerHTML = c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${c.text}</a>` : c.text;
    src.appendChild(liEl);
  });

  refreshLabels(); // apply default label mode ("on hover")
})();

// ---------- render loop ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.getElementById("loading").style.display = "none";
function tick() {
  if (pendingT !== appliedT) { updateExplode(pendingT); appliedT = pendingT; }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
