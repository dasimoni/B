# 🧠 The Unfolded Brain

An interactive visualization of **how the brain is connected**, laid completely
flat and organized so nothing hides behind the brain's 3D folds.

Instead of the tangled physical organ, regions are arranged as a **layered
network graph** running top-to-bottom through the brain's processing hierarchy:

```
sensory periphery → thalamic relays → primary sensory cortex
→ unimodal association → multimodal association → limbic/memory
→ executive/prefrontal → premotor & planning → primary motor → output
```

Within each layer, regions are reordered to **minimize edge crossings**, so the
wiring reads cleanly rather than as a hairball. Color encodes the functional
system; line style encodes the kind of connection.

## View it

Just open **`index.html`** in any browser — no build step, no server, no
network. Everything is vanilla JS + SVG.

- **Hover** a region to trace its wiring.
- **Click** to pin it and read what it does, what it projects to, and what it
  receives from.
- **Filter** by functional system (visual, auditory, language, limbic, …) or by
  connection type (feed-forward, feedback, modulatory).

## What you're looking at

Each connection is annotated with the real **white-matter tract** that carries
it — e.g. the *arcuate fasciculus* linking Wernicke's and Broca's areas, the
*optic radiation* feeding V1, the *corticospinal tract* from M1 to the cord, and
the *Papez circuit* through the hippocampus and cingulate.

This first version is a **curated anatomical schematic**: hand-built from
established neuroanatomy (major regions + named pathways), correct at the level
of *which big region connects to which via which tract*. It is not derived from
a measured connectivity matrix — see "Extending" below.

## Project layout

| File | Role |
|------|------|
| `index.html`        | Page shell + styling |
| `src/brainData.js`  | The curated dataset: nodes (regions) and edges (tracts) |
| `src/layout.js`     | Layered ("Sugiyama-style") layout + crossing minimization |
| `src/app.js`        | SVG rendering, highlighting, filters, info panel |

## Data model

```js
node = { id, label, system, layer, info }
edge = { source, target, tract, kind, info }
//  layer  0 = sensory input … 9 = motor output
//  system visual | auditory | somatosensory | olfactory | language |
//         limbic | executive | motor | subcortical   (drives color)
//  kind   feedforward | feedback | modulatory | commissural   (drives line style)
```

## Extending → real connectome data

The schema is deliberately generic so a published connectome can be dropped in
without touching layout or rendering. To swap in real data, regenerate
`src/brainData.js` from an atlas + connectivity matrix:

1. Pick a parcellation (e.g. Desikan-Killiany, AAL) → one `node` per parcel.
2. Assign each parcel a `layer` (e.g. by cortical hierarchy level) and a
   `system`.
3. Threshold the connectivity matrix → one `edge` per surviving connection;
   carry the weight in `info` (and later, edge thickness).

The layout engine already accepts arbitrary node/edge counts.

## Status

First working prototype. Curated-anatomy dataset, layered layout, full
interactivity. Possible next steps: edge weights → line thickness, both
hemispheres with commissural (corpus callosum) links, search box, and a
real-connectome data import.
