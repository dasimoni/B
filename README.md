# 🧠 Brain Connectivity

A project to visualize how the brain is connected, in a completely **unfolded
and organized** fashion. It offers **two complementary views**, reachable from a
landing page (`index.html`):

| View | What it is | Best for |
|------|-----------|----------|
| 🗺️ **The Unfolded Brain** (`block/`) | The brain's wiring laid flat as a clean **layered network** — sensory input at the top, motor output at the bottom, crossings minimized. Abstract regions + named tracts. | Understanding the overall flow |
| 🔬 **Brain Fiber Circuit** (`fiber/`) | An anatomically **real circuit** of named nerves traced from the sense organs inward, where line thickness = the **measured number of fibers**. | Grasping the real scale of each nerve |

## View it

Open **`index.html`** in any browser (no build, no server, no network) and pick
a view. Each view has a **← Home** link back to the landing page.

For a hosted link, enable **GitHub Pages** (Settings → Pages → deploy from
`main` / root) → `https://dasimoni.github.io/B/`, or peek instantly via
`https://raw.githack.com/dasimoni/B/main/index.html`.

## The two views

### 🗺️ The Unfolded Brain — `block/`
The processing hierarchy laid flat:

```
sensory periphery → thalamic relays → primary sensory cortex → unimodal
→ multimodal association → limbic/memory → executive → premotor → motor → output
```

34 regions across 10 functional layers, color-coded by system, with named
white-matter tracts (arcuate fasciculus, Papez circuit, corticospinal tract…).
Within-layer ordering minimizes edge crossings. Hover to trace wiring; click for
details; filter by system or connection type.

### 🔬 Brain Fiber Circuit — `fiber/`
Real named nerves from the actual sense organs (retina, cochlea, olfactory
epithelium, skin, viscera) inward, with **edge thickness = measured fiber
count** (log-scaled):

- Optic nerve ~1,000,000/eye · Cochlear nerve ~30–35k/ear · Olfactory ~6–10M/side
- Vestibular ~18–20k · Vagus ~100k · Corticospinal ~1M · Corpus callosum ~200M

**Cited counts only:** connections with a measured histological count are drawn
thick and labeled with the number + a literature citation; connections with no
measured count are drawn thin/dashed and labeled "not measured" — never guessed.

## Project layout

```
index.html            landing page → links to both views
shared/layout.js      layered layout + crossing minimization (shared by both)
block/                The Unfolded Brain
  index.html · brainData.js · app.js
fiber/                Brain Fiber Circuit
  index.html · brainData.js · app.js
```

Both views share the same generic data model (`node` / `edge` objects) and the
same layout engine, so each can evolve independently.

## Does anything like the fiber circuit already exist?

A *complete*, synapse-level connectome exists only for small brains — *C.
elegans* (302 neurons) and, since 2024, the adult **fruit fly** (FlyWire:
~139,000 neurons, >50M synapses). For **humans** there is no complete
connectome — only macro-scale diffusion-MRI tractography (tract *shapes* and
"streamline counts," not true axon counts) plus histological fiber counts
measured one tract at a time. The fiber circuit assembles those scattered human
counts into one interactive diagram.

## Possible next steps

- More cited cables (trigeminal, optic-chiasm split, individual cranial nerves).
- A "fiber budget" view sizing each sense by total inbound fibers.
- Both hemispheres with explicit decussation/chiasm crossings.
