/*
 * layout.js — Layered ("Sugiyama-style") graph layout
 * ---------------------------------------------------
 * Nodes already carry a fixed `layer` (their rank in the sensory→motor
 * hierarchy). This module does the two remaining jobs:
 *
 *   1. Order the nodes WITHIN each layer to minimize edge crossings, using the
 *      iterated median/barycenter heuristic (down then up sweeps). This is what
 *      turns a tangled hairball into something "organized and unfolded".
 *   2. Assign pixel coordinates: layers are evenly spaced rows top→bottom,
 *      nodes spread across each row.
 *
 * Returns { nodes, edges, width, height } with x/y written onto each node.
 */

(function (global) {
  "use strict";

  function computeLayout(brain, opts) {
    opts = opts || {};
    const nodeW = opts.nodeW || 150;
    const nodeH = opts.nodeH || 30;
    const hGap = opts.hGap || 26; // horizontal gap between nodes in a row
    const vGap = opts.vGap || 92; // vertical gap between layers
    const padX = opts.padX || 40;
    const padY = opts.padY || 40;

    // Deep-ish copy so we never mutate the source dataset.
    const nodes = brain.NODES.map((n) => Object.assign({}, n));
    const edges = brain.EDGES.map((e) => Object.assign({}, e));
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // Group node ids by layer.
    const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
    const layers = [];
    for (let i = 0; i <= maxLayer; i++) layers.push([]);
    nodes.forEach((n) => layers[n.layer].push(n.id));

    // Adjacency for the ordering heuristic.
    const downAdj = new Map(); // node -> ids in the layer below it points to
    const upAdj = new Map(); // node -> ids in the layer above pointing to it
    nodes.forEach((n) => {
      downAdj.set(n.id, []);
      upAdj.set(n.id, []);
    });
    edges.forEach((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) return;
      // Treat the hierarchy as undirected for crossing purposes: a node's
      // "neighbors in the adjacent layer" are what matter, regardless of
      // feedforward/feedback direction.
      if (t.layer > s.layer) {
        downAdj.get(s.id).push(t.id);
        upAdj.get(t.id).push(s.id);
      } else if (s.layer > t.layer) {
        downAdj.get(t.id).push(s.id);
        upAdj.get(s.id).push(t.id);
      }
    });

    // position = current index of a node within its layer
    const pos = new Map();
    layers.forEach((ids) => ids.forEach((id, i) => pos.set(id, i)));

    function median(arr) {
      if (arr.length === 0) return -1;
      const s = arr.slice().sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function orderLayer(ids, adj) {
      const keyed = ids.map((id) => {
        const neighborPos = adj.get(id).map((nid) => pos.get(nid));
        const med = median(neighborPos);
        return { id, key: med < 0 ? pos.get(id) : med };
      });
      // Stable sort; nodes with no neighbors keep their relative slot.
      keyed.sort((a, b) => a.key - b.key);
      const ordered = keyed.map((k) => k.id);
      ordered.forEach((id, i) => pos.set(id, i));
      return ordered;
    }

    function countCrossings() {
      let crossings = 0;
      for (let L = 0; L < layers.length - 1; L++) {
        const pairs = [];
        edges.forEach((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return;
          const lo = s.layer < t.layer ? s : t;
          const hi = s.layer < t.layer ? t : s;
          if (lo.layer === L && hi.layer === L + 1) {
            pairs.push([pos.get(lo.id), pos.get(hi.id)]);
          }
        });
        for (let i = 0; i < pairs.length; i++)
          for (let j = i + 1; j < pairs.length; j++) {
            const a = pairs[i],
              b = pairs[j];
            if ((a[0] - b[0]) * (a[1] - b[1]) < 0) crossings++;
          }
      }
      return crossings;
    }

    // Iterate down/up sweeps, keep the best ordering seen.
    let best = layers.map((ids) => ids.slice());
    let bestCross = countCrossings();
    for (let iter = 0; iter < 8; iter++) {
      // Down sweep: order each layer by the median of the layer above.
      for (let L = 1; L < layers.length; L++) layers[L] = orderLayer(layers[L], upAdj);
      // Up sweep: order each layer by the median of the layer below.
      for (let L = layers.length - 2; L >= 0; L--) layers[L] = orderLayer(layers[L], downAdj);
      const c = countCrossings();
      if (c < bestCross) {
        bestCross = c;
        best = layers.map((ids) => ids.slice());
      }
    }
    layers.length = 0;
    best.forEach((ids) => layers.push(ids));
    layers.forEach((ids) => ids.forEach((id, i) => pos.set(id, i)));

    // --- Assign pixel coordinates ---
    const rowWidths = layers.map((ids) => ids.length * (nodeW + hGap) - hGap);
    const maxRowW = Math.max(...rowWidths, nodeW);
    const width = maxRowW + padX * 2;
    const height = layers.length * (nodeH + vGap) - vGap + padY * 2;

    layers.forEach((ids, L) => {
      const rowW = rowWidths[L];
      const startX = padX + (maxRowW - rowW) / 2; // center each row
      ids.forEach((id, i) => {
        const n = byId.get(id);
        n.x = startX + i * (nodeW + hGap);
        n.y = padY + L * (nodeH + vGap);
        n.w = nodeW;
        n.h = nodeH;
        n.cx = n.x + nodeW / 2;
        n.cy = n.y + nodeH / 2;
      });
    });

    return { nodes, edges, byId, width, height, layers, crossings: bestCross, nodeH, vGap, padX, padY };
  }

  global.Layout = { computeLayout };
})(typeof window !== "undefined" ? window : globalThis);
