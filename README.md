# 🧠 Brain Fiber Circuit

An interactive circuit diagram of the human brain's major **input and output
cables**, traced from the actual sense organs — retina, cochlea, olfactory
epithelium, skin, viscera — inward to cortex and back out to the body.

Unlike an abstract box-and-arrow schematic, here every connection is a **real
named nerve or tract**, and the **thickness of each line is the measured number
of nerve fibers** it carries (log-scaled). The contrast is the whole point:

- **Optic nerve** — ~1,000,000 fibers per eye
- **Cochlear nerve** — ~30,000–35,000 per ear (a ~30× thinner cable than vision)
- **Olfactory nerve** — ~6–10 million receptor axons per side
- **Vestibular nerve** — ~18,000–20,000 per side
- **Vagus nerve** — ~100,000 (mostly carrying signals *from* the body)
- **Corticospinal tract** — ~1,000,000 (the motor output cable)
- **Corpus callosum** — ~200,000,000 (the giant bridge between hemispheres)

## View it

Open **`index.html`** in any browser — no build, no server, no network.

- **Hover or click any nerve** to see its tract name, fiber count, and the
  paper the count comes from.
- **Click a region** for its full incoming/outgoing wiring.
- Toggle fiber-count labels, hide un-measured links, or filter by system.

## Honesty rule: cited counts only

Only connections with a **measured histological fiber count** are drawn thick
and labeled with a number; each is backed by a literature citation (see the
"Sources" panel in the app). Connections that have **no measured count** in the
published literature (e.g. the optic radiation, medial lemniscus, most
cortico-cortical links) are drawn **thin and dashed** and labeled "not
measured" — never guessed.

### Sources for the measured counts

| Pathway | Count | Source |
|---|---|---|
| Optic nerve | ~1,000,000 / eye | Jonas et al. 1990 |
| Cochlear nerve | ~30,000–35,000 / ear | Spoendlin & Schrott 1989 |
| Vestibular nerve | ~18,000–20,000 / side | Bergström 1973 |
| Olfactory nerve | ~6–10 million / side | StatPearls (Cranial Nerve I) |
| Vagus nerve | ~100,000 (~85% afferent) | Foley & DuBois 1937 |
| Corpus callosum | ~200,000,000 | Aboitiz et al. 1992 |
| Corticospinal tract | ~1,000,000 (~700k myelinated) | Lassek 1940 |

## Does anything like this already exist?

A *complete*, synapse-level wiring diagram exists only for small brains — the
roundworm *C. elegans* (302 neurons) and, as of 2024, the adult **fruit fly**
(FlyWire: ~139,000 neurons, >50 million synapses). For **humans** there is **no**
complete connectome — only macro-scale diffusion-MRI tractography (which gives
tract *shapes* and "streamline counts," not true axon counts) plus
histological fiber counts measured one tract at a time. This project assembles
those scattered per-tract human counts into a single interactive circuit — a
niche nobody had filled.

## Project layout

| File | Role |
|------|------|
| `index.html`        | Page shell + styling |
| `src/brainData.js`  | Nodes (regions), edges (named tracts + fiber counts), citations |
| `src/layout.js`     | Layered layout + crossing minimization |
| `src/app.js`        | SVG rendering (thickness = log fiber count), highlighting, info panel |

## Data model

```js
node = { id, label, system, layer, info }
edge = { source, target, tract, fibers, fiberLabel, ref, kind, info }
//  fibers     measured axon count, or null if not measured in the literature
//  ref        key into CITATIONS (only present on counted edges)
//  kind       sensory | central | motor | commissural
```

## Possible next steps

- Add more cited cables (e.g. trigeminal, optic chiasm split, individual
  cranial nerves) as counts are sourced.
- Show both eyes/ears and the chiasm/decussation crossings explicitly.
- A "fiber budget" view that sizes each sense by total inbound fibers.
- Optional toggle to overlay diffusion-MRI streamline estimates (clearly
  distinguished from true counts).
