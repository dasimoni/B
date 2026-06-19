# 🧠 Brain Connectivity

A project to visualize how the brain is connected, in a completely **unfolded
and organized** fashion. It offers **three complementary views**, reachable from a
landing page (`index.html`):

| View | What it is | Best for |
|------|-----------|----------|
| 🧬 **The Unfolded Nervous System** (`unfolded/`) | The nervous system peeled flat: continuous cortical sheets with marked (adjoining) areas, the sense organs teased out, and the real wiring — optic chiasm, LGN & relays, corpus callosum, cortico-cortical and feedback fibers. | Seeing the real anatomy & wiring |
| 🗺️ **The Unfolded Brain** (`block/`) | The brain's wiring laid flat as a clean **layered network** — sensory input at the top, motor output at the bottom, crossings minimized. Abstract regions + named tracts. | Understanding the overall flow |
| 🔬 **Brain Fiber Circuit** (`fiber/`) | An anatomically **real circuit** of named nerves traced from the sense organs inward, where line thickness = the **measured number of fibers**. | Grasping the real scale of each nerve |

## View it

Open **`index.html`** in any browser (no build, no server, no network) and pick
a view. Each view has a **← Home** link back to the landing page.

For a hosted link, enable **GitHub Pages** (Settings → Pages → deploy from
`main` / root) → `https://dasimoni.github.io/B/`, or peek instantly via
`https://raw.githack.com/dasimoni/B/main/index.html`.

## The views

### 🧬 The Unfolded Nervous System — `unfolded/`
The nervous system drawn as if peeled open and laid flat. Each hemisphere is a
**continuous cortical sheet** partitioned into adjoining area patches (V1, A1,
S1, M1, Broca, prefrontal…) — continuous, as in real cortex, not detached
boxes. Around the edge, the **sense organs are teased out** (eyes, ears, nose,
tongue, skin) and wired into their target areas through the real relays:

- **Vision** — eyes → optic nerves → **optic chiasm** (partial crossing) →
  **LGN** → optic radiation → V1
- **Hearing** — ears → cochlear nerve → brainstem → **MGN** → A1
- **Smell** — nose → olfactory bulb → temporal pole (bypasses the thalamus)
- **Taste** — tongue → NTS → VPM → insula
- **Touch** — body → spinal cord → VPL → S1
- **Motor out** — M1 → corticospinal tract → brainstem → spinal cord → muscles

It also shows the **corpus callosum** between hemispheres, **cortico-cortical**
feed-forward fibers from area to area, and **feedback fibers** running back from
higher areas to lower ones (drawn dashed, in a distinct color). Every wiring
class can be toggled; hover an organ or area to trace what connects to it.
Measured fiber counts (optic, cochlear, olfactory, corticospinal, callosum)
carry their citations, same cited-counts rule as the fiber circuit.

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
index.html            landing page → links to all three views
shared/layout.js      layered layout + crossing minimization
unfolded/             The Unfolded Nervous System (anatomical map)
  index.html · anatomyData.js · app.js
block/                The Unfolded Brain (layered schematic)
  index.html · brainData.js · app.js
fiber/                Brain Fiber Circuit (cited fiber counts)
  index.html · brainData.js · app.js
```

The `block/` and `fiber/` views share the same generic graph model and layout
engine; the `unfolded/` view is a bespoke anatomical illustration with its own
data model (`anatomyData.js`).

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
