/*
 * app.js — "Brain in 3D" (Three.js)
 * ---------------------------------
 * A 3D realization of the unfolded nervous system: two cortical hemisphere
 * surfaces carrying the marked area patches, the sense organs in space, the
 * subcortical relays (LGN, chiasm, MGN, VPL, brainstem, spinal cord), and all
 * the wiring — sensory afferents, corpus callosum, cortico-cortical, and
 * feedback — drawn as 3D tubes. Orbit to rotate, hover to inspect.
 *
 * Reuses window.ANATOMY (from ../unfolded/anatomyData.js).
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const A = window.ANATOMY;

// ---------- scene setup ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#06090e");
scene.fog = new THREE.Fog("#06090e", 24, 46);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.5, 17);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 7;
controls.maxDistance = 40;

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(6, 10, 12);
scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
rim.position.set(-8, 4, -10);
scene.add(rim);

// ---------- coordinate mapping (2D scene px -> 3D world) ----------
const S = 70; // px per world unit
function base(px, py, z) { return new THREE.Vector3((px - 750) / S, (540 - py) / S, z); }

// hemisphere domes
const RX = 2.65, RY = 2.75, RZ = 2.35;
function hemiCenter(hemi) { return base(hemi.ox + 180, hemi.oy + 180, 0); }
function areaDir(area, hemi) {
  const u = (area.x + area.w / 2) / 360, v = (area.y + area.h / 2) / 360;
  const a = (u - 0.5) * 1.5 * (hemi.mirror ? -1 : 1);
  const b = (v - 0.5) * 1.6;
  return new THREE.Vector3(Math.sin(a), Math.sin(-b), Math.cos(a) * Math.cos(b)).normalize();
}
function areaPos(area, hemi, scale) {
  const c = hemiCenter(hemi), d = areaDir(area, hemi);
  return new THREE.Vector3(c.x + RX * d.x * scale, c.y + RY * d.y * scale, c.z + RZ * d.z * scale);
}

// position lookup for any wire endpoint key
const pos3 = new Map();
const meta = new Map(); // key -> {kind, label, system, hemi}
A.HEMIS.forEach((hemi) => {
  A.AREA_DEFS.forEach((area) => {
    const key = area.id + ":" + hemi.side;
    pos3.set(key, areaPos(area, hemi, 1.0));
    meta.set(key, { kind: "area", label: area.label, system: area.system, hemi: hemi.side, area });
  });
});
A.RELAYS.forEach((r) => { pos3.set(r.id, base(r.x, r.y, 0.3)); meta.set(r.id, { kind: "relay", label: r.label }); });
A.ORGANS.forEach((o) => { pos3.set(o.id, base(o.x, o.y, 2.6)); meta.set(o.id, { kind: "organ", label: o.label, icon: o.icon }); });

function sysColor(sys) { return new THREE.Color((A.SYSTEMS[sys] && A.SYSTEMS[sys].color) || "#9aa5b1"); }

// ---------- label sprites ----------
function makeLabel(text, opts) {
  opts = opts || {};
  const fs = opts.fs || 42, pad = 12, emoji = opts.emoji;
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
  const tex = new THREE.CanvasTexture(cnv);
  tex.anisotropy = 4;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const sc = (opts.world || 0.9);
  spr.scale.set((w / h) * sc, sc, 1);
  spr.renderOrder = 10;
  return spr;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- cortex ----------
const labelSprites = [];
const pickables = [];
const areaMeshes = new Map();

A.HEMIS.forEach((hemi) => {
  // translucent cortical body (ellipsoid)
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a2735, roughness: 0.9, metalness: 0.0,
      transparent: true, opacity: 0.55, flatShading: false })
  );
  const c = hemiCenter(hemi);
  body.position.copy(c); body.scale.set(RX, RY, RZ);
  scene.add(body);

  // area tiles on the surface
  A.AREA_DEFS.forEach((area) => {
    const key = area.id + ":" + hemi.side;
    const p = areaPos(area, hemi, 1.02);
    const d = areaDir(area, hemi);
    const geo = new THREE.CircleGeometry(0.62, 24);
    const mat = new THREE.MeshStandardMaterial({ color: sysColor(area.system), roughness: 0.6,
      metalness: 0.05, emissive: 0x000000, side: THREE.DoubleSide });
    const tile = new THREE.Mesh(geo, mat);
    tile.position.copy(p);
    tile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    tile.userData = { key };
    scene.add(tile);
    pickables.push(tile);
    areaMeshes.set(key, tile);

    const lab = makeLabel(area.short, { fs: 34, world: 0.62, color: "#0b121a" });
    lab.position.copy(p).addScaledVector(d, 0.05);
    scene.add(lab); labelSprites.push(lab);
  });

  const ht = makeLabel(hemi.side === "L" ? "Left" : "Right", { fs: 30, world: 0.8, color: "#7e96ab" });
  ht.position.copy(c).add(new THREE.Vector3(0, RY + 0.7, 0));
  scene.add(ht); labelSprites.push(ht);
});

// ---------- relays ----------
A.RELAYS.forEach((r) => {
  const p = pos3.get(r.id);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x9fb2c4, roughness: 0.5, emissive: 0x223044 }));
  m.position.copy(p); scene.add(m);
  const lab = makeLabel(r.label, { fs: 30, world: 0.7 });
  lab.position.copy(p).add(new THREE.Vector3(0, 0.45, 0));
  scene.add(lab); labelSprites.push(lab);
});

// spinal cord shaft
(() => {
  const a = pos3.get("brainstem"), b = pos3.get("spinal");
  const g = new THREE.CylinderGeometry(0.16, 0.13, a.distanceTo(b) + 1.5, 12);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb9c6d2, roughness: 0.7 }));
  const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.4, 0));
  m.position.copy(mid); scene.add(m);
})();

// ---------- organs ----------
A.ORGANS.forEach((o) => {
  const p = pos3.get(o.id);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.5, emissive: 0x101820 }));
  m.position.copy(p); m.userData = { key: o.id }; scene.add(m); pickables.push(m);
  const icon = makeLabel(o.icon, { emoji: true, fs: 34, world: 1.1 });
  icon.position.copy(p).add(new THREE.Vector3(0, 0.05, 0.05));
  scene.add(icon); labelSprites.push(icon);
  const lab = makeLabel(o.label, { fs: 28, world: 0.7 });
  lab.position.copy(p).add(new THREE.Vector3(0, -0.55, 0));
  scene.add(lab); labelSprites.push(lab);
});

// ---------- wiring ----------
const layerGroups = {
  sensory: new THREE.Group(), cortico: new THREE.Group(),
  feedback: new THREE.Group(), callosum: new THREE.Group(),
};
Object.values(layerGroups).forEach((g) => scene.add(g));
const wireRecs = []; // { mesh, from, to, baseOpacity }

function tubeRadius(fibers, kind) {
  if (kind === "cortico") return 0.028;
  if (kind === "feedback") return 0.026;
  if (kind === "callosum") return 0.05;
  if (!fibers) return 0.05;
  const t = Math.log10(fibers);
  return 0.045 + Math.max(0, Math.min(1, (t - 4) / 4.4)) * 0.2;
}
function ctrlPoint(a, b, kind, hemiCenterVec) {
  const mid = a.clone().lerp(b, 0.5);
  if (kind === "callosum") return mid.add(new THREE.Vector3(0, 1.4, 1.4));
  if (kind === "cortico" || kind === "feedback") {
    const out = mid.clone().sub(hemiCenterVec).normalize();
    return mid.add(out.multiplyScalar(kind === "feedback" ? 1.7 : 0.9));
  }
  return mid.add(new THREE.Vector3(0, 0.2, 1.1)); // sensory/motor bow toward viewer
}
function addWire(w, group, color, kind) {
  const a = pos3.get(w.from), b = pos3.get(w.to);
  if (!a || !b) return;
  // pick a hemisphere center for surface bowing (use endpoint's hemi if area)
  let hc = new THREE.Vector3(0, 1, 0);
  const fm = meta.get(w.from), tm = meta.get(w.to);
  const hemiSide = (fm && fm.hemi) || (tm && tm.hemi);
  if (hemiSide) hc = hemiCenter(A.HEMIS.find((h) => h.side === hemiSide));
  const curve = new THREE.QuadraticBezierCurve3(a, ctrlPoint(a, b, kind, hc), b);
  const geo = new THREE.TubeGeometry(curve, 28, tubeRadius(w.fibers, kind), 8, false);
  const baseOpacity = kind === "cortico" ? 0.5 : kind === "feedback" ? 0.6 : 0.82;
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5,
    emissive: new THREE.Color(color).multiplyScalar(0.18), transparent: true, opacity: baseOpacity });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  wireRecs.push({ mesh, from: w.from, to: w.to, baseOpacity, kind });
}

A.SENSORY.forEach((w) => addWire(w, layerGroups.sensory, (A.SYSTEMS[w.system] || {}).color || "#9aa5b1", w.kind === "relay" ? "relay" : "afferent"));
A.MOTOR.forEach((w) => addWire(w, layerGroups.sensory, "#FF9D4D", "motor"));
A.CALLOSUM_AREAS.forEach((id) =>
  addWire({ from: id + ":L", to: id + ":R", fibers: 200000000 }, layerGroups.callosum, "#36CFC9", "callosum"));
A.HEMIS.forEach((hemi) => {
  A.CORTICO_PAIRS.forEach(([s, t]) => addWire({ from: s + ":" + hemi.side, to: t + ":" + hemi.side }, layerGroups.cortico, "#aeb8c4", "cortico"));
  A.FEEDBACK_PAIRS.forEach(([s, t]) => addWire({ from: s + ":" + hemi.side, to: t + ":" + hemi.side }, layerGroups.feedback, "#cd7fe0", "feedback"));
});

// ---------- interaction (raycast hover) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

function allWiresData() {
  const out = [].concat(A.SENSORY, A.MOTOR);
  A.CALLOSUM_AREAS.forEach((id) => out.push({ from: id + ":L", to: id + ":R", kind: "callosum", tract: "Corpus callosum", fiberLabel: "~200,000,000", ref: "callosum" }));
  A.HEMIS.forEach((h) => {
    A.CORTICO_PAIRS.forEach(([s, t, note]) => out.push({ from: s + ":" + h.side, to: t + ":" + h.side, kind: "cortico", tract: note || "cortico-cortical" }));
    A.FEEDBACK_PAIRS.forEach(([s, t, note]) => out.push({ from: s + ":" + h.side, to: t + ":" + h.side, kind: "feedback", tract: note || "feedback projection" }));
  });
  return out;
}
function nameOf(ref) { const m = meta.get(ref); return m ? (m.kind === "area" ? m.label + " (" + m.hemi + ")" : m.label) : ref; }

function setHover(key) {
  if (hovered === key) return;
  hovered = key;
  const connected = new Set();
  if (key) {
    connected.add(key);
    wireRecs.forEach((r) => { if (r.from === key || r.to === key) { connected.add(r.from); connected.add(r.to); } });
  }
  // tiles
  areaMeshes.forEach((tile, k) => {
    const on = !key || connected.has(k);
    tile.material.emissive.setHex(k === key ? 0x666666 : 0x000000);
    tile.material.opacity = on ? 1 : 0.25;
    tile.material.transparent = !on;
  });
  // wires
  wireRecs.forEach((r) => {
    const on = !key || r.from === key || r.to === key;
    r.mesh.material.opacity = on ? Math.max(r.baseOpacity, key ? 0.95 : r.baseOpacity) : 0.05;
  });
  if (key) showInfo(key); else hideInfo();
}

function showInfo(key) {
  const m = meta.get(key); if (!m) return;
  const data = allWiresData();
  const inc = data.filter((w) => w.to === key);
  const out = data.filter((w) => w.from === key);
  const li = (w, dir) => `<li><span class="tract">${w.tract || w.kind}</span> ${dir === "in" ? "←" : "→"} ${nameOf(dir === "in" ? w.from : w.to)}${w.fiberLabel ? ` · <span class="count">${w.fiberLabel}</span>` : ""}</li>`;
  let head;
  if (m.kind === "area")
    head = `<div class="h"><span class="sw-dot" style="background:${(A.SYSTEMS[m.system] || {}).color}"></span>${m.label}</div><div class="sub">${A.SYSTEMS[m.system].name} · ${m.hemi === "L" ? "Left" : "Right"} hemisphere</div>`;
  else
    head = `<div class="h">${m.icon || ""} ${m.label}</div><div class="sub">Sense organ</div>`;
  const el = document.getElementById("info");
  el.innerHTML = head +
    (inc.length ? `<div class="sub">Incoming</div><ul>${inc.map((w) => li(w, "in")).join("")}</ul>` : "") +
    (out.length ? `<div class="sub">Outgoing</div><ul>${out.map((w) => li(w, "out")).join("")}</ul>` : "");
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
  [["sensory", "Senses & afferents"], ["cortico", "Cortico-cortical"], ["feedback", "Feedback fibers"], ["callosum", "Corpus callosum"]]
    .forEach(([k, label]) => {
      const l = document.createElement("label"); l.className = "toggle";
      l.innerHTML = `<input type="checkbox" checked> ${label}`;
      l.querySelector("input").addEventListener("change", (e) => { layerGroups[k].visible = e.target.checked; });
      lt.appendChild(l);
    });
  document.getElementById("t-labels").addEventListener("change", (e) => labelSprites.forEach((s) => (s.visible = e.target.checked)));
  document.getElementById("t-spin").addEventListener("change", (e) => (controls.autoRotate = e.target.checked));
  controls.autoRotateSpeed = 0.8;

  const lg = document.getElementById("legend");
  Object.entries(A.WIRE_KINDS).forEach(([k, v]) => {
    const color = v.color || "#5B8FF9";
    const row = document.createElement("div"); row.className = "lg-row";
    row.innerHTML = `<span class="sw" style="border-color:${color};${v.dash ? "border-top-style:dashed;" : ""}"></span> ${v.name}`;
    lg.appendChild(row);
  });
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
