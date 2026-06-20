/*
 * build_flatmap.js — generate the flattened-cortex parcellation (Node, build-time)
 * --------------------------------------------------------------------------------
 * Computes a weighted Voronoi (power diagram) of one hemisphere outline so that
 * each cortical area becomes a CONTINUOUS region whose area is proportional to
 * its real unfolded surface area (ATLAS.AREAS[].weight, in cm²). Two changes make
 * it read as real cortex instead of "caricature patches":
 *   1. The outline is a realistic flatmap SILHOUETTE (rounded fronto-parieto-
 *      occipital convexity + a ventral temporal-lobe extension), not a plain
 *      ellipse.
 *   2. Region boundaries are CHAIKIN-smoothed so the borders curve like sulci
 *      rather than meeting at straight Voronoi edges.
 *
 * Run:  node unfolded/build_flatmap.js   → writes unfolded/flatmapGeo.js
 */

require("./atlas.js");
const fs = require("fs");
const path = require("path");
const { AREAS, OUTLINE } = globalThis.ATLAS;

// ---- polygon helpers ----
function area(poly) {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
function centroid(poly) {
  let cx = 0, cy = 0, A = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const cr = a[0] * b[1] - b[0] * a[1];
    A += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr;
  }
  A *= 0.5;
  if (Math.abs(A) < 1e-9) return null;
  return [cx / (6 * A), cy / (6 * A)];
}
// clip polygon by half-plane  A*x + B*y <= C  (Sutherland–Hodgman, one edge)
function clipHalf(poly, A, B, C) {
  const out = [];
  const inside = (p) => A * p[0] + B * p[1] <= C + 1e-9;
  const inter = (p, q) => {
    const fp = A * p[0] + B * p[1] - C, fq = A * q[0] + B * q[1] - C;
    const t = fp / (fp - fq);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };
  for (let i = 0, n = poly.length; i < n; i++) {
    const cur = poly[i], nxt = poly[(i + 1) % n];
    const ci = inside(cur), ni = inside(nxt);
    if (ci) out.push(cur);
    if (ci !== ni) out.push(inter(cur, nxt));
  }
  return out;
}

// ---- realistic flatmap silhouette ----
// Base ellipse, plus a ventral temporal-lobe bulge and a gentle occipital point.
function angDiff(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}
function flatmapOutline(o, n) {
  const T = o.temporal, Oc = o.occipital;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    let x = o.cx + o.rx * Math.cos(th);
    let y = o.cy + o.ry * Math.sin(th);
    // temporal lobe: push ventral (+y) and slightly anterior (−x)
    const gt = T.mag * Math.exp(-(angDiff(th, T.theta) ** 2) / (2 * T.sigma * T.sigma));
    y += gt;
    x -= 0.35 * gt;
    // occipital point: push posterior (+x) near θ≈0
    const go = Oc.mag * Math.exp(-(angDiff(th, 0) ** 2) / (2 * Oc.sigma * Oc.sigma));
    x += go;
    pts.push([x, y]);
  }
  return pts;
}

// ---- Chaikin corner-cutting (organic, sulcus-like borders) ----
function chaikin(poly, iters) {
  let p = poly;
  for (let k = 0; k < iters; k++) {
    const out = [];
    for (let i = 0, n = p.length; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

const outline = flatmapOutline(OUTLINE, 132);
const totalArea = Math.abs(area(outline));
const sumW = AREAS.reduce((s, a) => s + a.weight, 0);

// sites: {x,y,w, target}
const sites = AREAS.map((a) => ({
  id: a.id, x: a.seed[0], y: a.seed[1], w: 0,
  target: totalArea * (a.weight / sumW),
  ax: a.seed[0], ay: a.seed[1], // anchor (original seed)
}));

function powerCell(i) {
  let poly = outline;
  const s = sites[i];
  for (let j = 0; j < sites.length; j++) {
    if (j === i) continue;
    const t = sites[j];
    const A = 2 * (t.x - s.x), B = 2 * (t.y - s.y);
    const C = (t.x * t.x + t.y * t.y - t.w) - (s.x * s.x + s.y * s.y - s.w);
    poly = clipHalf(poly, A, B, C);
    if (poly.length === 0) break;
  }
  return poly;
}

let cells = [];
for (let iter = 0; iter < 200; iter++) {
  cells = sites.map((_, i) => powerCell(i));
  for (let i = 0; i < sites.length; i++) {
    const poly = cells[i];
    const cur = poly.length ? Math.abs(area(poly)) : 0;
    const s = sites[i];
    const err = (s.target - cur) / totalArea; // fraction
    s.w += err * 9000 * (iter < 150 ? 1 : 0.3); // grow/shrink cell
    if (poly.length >= 3) {
      const c = centroid(poly);
      if (c) {
        const k = 0.22;
        s.x += (c[0] - s.x) * k;
        s.y += (c[1] - s.y) * k;
        // spring back toward anatomical anchor so layout stays meaningful
        s.x += (s.ax - s.x) * 0.06;
        s.y += (s.ay - s.y) * 0.06;
      }
    }
  }
  const minW = Math.min(...sites.map((s) => s.w));
  sites.forEach((s) => (s.w -= minW));
}

// final cells: keep RAW cell for area/centroid accuracy, SMOOTH copy for drawing
cells = sites.map((_, i) => powerCell(i));
const areasOut = {};
let empties = 0, worstErr = 0;
sites.forEach((s, i) => {
  const raw = cells[i];
  const a = raw.length ? Math.abs(area(raw)) : 0;
  if (a === 0) empties++;
  const errPct = Math.abs(a - s.target) / s.target * 100;
  worstErr = Math.max(worstErr, errPct);
  const c = raw.length ? centroid(raw) : [s.x, s.y];
  const smooth = raw.length >= 3 ? chaikin(raw, 2) : raw;
  const poly = smooth.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
  areasOut[s.id] = {
    poly, cx: Math.round(c[0] * 10) / 10, cy: Math.round(c[1] * 10) / 10,
    areaCm2: AREAS[i].weight, areaPx: Math.round(a),
  };
});

const outPoly = chaikin(outline, 1).map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
const out =
  "/* AUTO-GENERATED by build_flatmap.js — do not edit by hand. */\n" +
  "(function (g) {\n  g.FLATMAP = " +
  JSON.stringify({ outline: outPoly, areas: areasOut }) +
  ";\n})(typeof window !== \"undefined\" ? window : globalThis);\n";

fs.writeFileSync(path.join(__dirname, "flatmapGeo.js"), out);
console.log(`wrote flatmapGeo.js — ${Object.keys(areasOut).length} areas, empties=${empties}, worst area error=${worstErr.toFixed(1)}%`);
