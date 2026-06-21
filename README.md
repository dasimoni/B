# 🧠 Brain Connectivity

A project to visualize how the brain is connected, in a completely **unfolded
and organized** fashion. It offers **four complementary views**, reachable from a
landing page (`index.html`):

| View | What it is | Best for |
|------|-----------|----------|
| 🧠 **Brain in 3D** (`3d/`) | The unfolded view in 3D (Three.js): two **curved, parcellated cortical sheets** (the real flatmap regions, sized by cm²), the thalamus with its relay nuclei (LGN unfolded into layers) and the other sensory relay stations at true relative volume, and every wire as a 3D tube on one fiber→width standard. Orbit & zoom. Needs an internet connection (loads Three.js from a CDN). | Exploring it spatially |
| 🧬 **The Unfolded Cortex** (`unfolded/`) | Each hemisphere as a continuous parcellated sheet where every region's area is proportional to its real unfolded cm² (weighted-Voronoi flatmap), a to-scale thalamus with nested nuclei, a fixed fiber-count → width standard, and feed-forward vs feedback drawn in different colors. | Seeing realistic areas, sizes & wiring |
| 🗺️ **The Unfolded Brain** (`block/`) | The brain's wiring laid flat as a clean **layered network** — sensory input at the top, motor output at the bottom, crossings minimized. Abstract regions + named tracts. | Understanding the overall flow |
| 🔬 **Brain Fiber Circuit** (`fiber/`) | An anatomically **real circuit** of named nerves traced from the sense organs inward, where line thickness = the **measured number of fibers**. | Grasping the real scale of each nerve |

## View it

Open **`index.html`** in any browser (no build, no server, no network) and pick
a view. Each view has a **← Home** link back to the landing page.

For a hosted link, enable **GitHub Pages** (Settings → Pages → deploy from
`main` / root) → `https://dasimoni.github.io/B/`, or peek instantly via
`https://raw.githack.com/dasimoni/B/main/index.html`.

## The views

### 🧠 Brain in 3D — `3d/`
The unfolded view in three dimensions, built with **Three.js** — and it reuses
the *same* realistic dataset as the 2D flatmap (`../unfolded/atlas.js` +
`flatmapGeo.js`), so the two stay consistent. Each hemisphere is a **curved,
parcellated cortical sheet**: the real flatmap region polygons, sized by real
unfolded cm², bent into 3D as an "open book" — continuous regions, not caricature
tiles. The cortex stays anatomical while the nerves and cortico-cortical fibers
are stretched through space for legibility.

The thalamus and its relay nuclei (anterior, MD, VA/VL, VPL/VPM, pulvinar, MGN,
and the **LGN unfolded into six stacked layers**) are 3D glyphs whose size tracks
real volume (radius ∝ ∛volume); the other **sensory transduction stations** —
olfactory bulb, superior/inferior colliculi, named brainstem relays — sit in the
valley between the sheets, in front of the cortex (so depth separates them when
you orbit). Every wire is a 3D tube whose radius rides **one fiber→width
standard** (the same `9 px = 1,000,000 fibers` as 2D): olfactory thick, optic
medium, cochlear a hairline, corpus callosum capped, and cortico-cortical
area-pairs hairline-thin (estimated order of magnitude, strength shown by
opacity). Drag to orbit, scroll to zoom, hover a region/nucleus/organ to light up
everything wired to it, and toggle each wiring layer.

Extras for inspecting the wiring:
- **Trace a modality** — buttons for Vision / Hearing / Touch / Smell / Taste /
  Motor light up that sense's *entire* pathway (organ → relay → primary cortex →
  onward through the association stream) and dim everything else, so you can
  follow e.g. retina → LGN → V1 → V2/V3 → … all the way up.
- An **explode slider** pulls every connection endpoint radially apart — up to a
  wide blow-apart where the hemispheres separate, each thalamic nucleus stands on
  its own, and the organs fling to the periphery — so the dense circuitry spreads
  out in space (zoom out to follow it).
- **Labels** can be set to *On hover* (clean by default, names appear when you
  hover a node or trace a modality), *Always*, or *Off*.
- **Direction is explicit:** every wire carries an **arrowhead** showing which
  way the signal flows, and feed-forward vs feedback run in **separate lanes**
  (offset to opposite sides) so the two never overlap.
- Connections with no firm fiber count are drawn **solid but striped** — listed
  as estimates — so they read clearly as "not firmly measured" instead of being
  faint translucent tubes.

> Note: this view loads Three.js from a CDN, so it needs an internet connection
> (the other three views are fully offline).

### 🧬 The Unfolded Cortex — `unfolded/`
The most realistic view. Each hemisphere is a **continuous parcellated sheet**:
not caricature patches, but ~21 areas drawn as continuous, border-sharing
**regions** whose **areas are proportional to real unfolded cortical surface
area** (V1 ~20 cm², A1 ~4 cm², prefrontal ~95 cm² and dominant). The
parcellation is a **weighted Voronoi** computed at build time
(`build_flatmap.js` → `flatmapGeo.js`) so region sizes match published cm² to
within ~2%, then drawn on a **realistic flatmap silhouette** (rounded fronto-
parieto-occipital convexity with a ventral temporal-lobe extension) with
**Chaikin-smoothed borders** so the boundaries read as sulci, not Voronoi
shards. Cortical areas stay anatomical even though the *wiring* is stretched for
legibility.

Subcortical relays are drawn at **true relative size and shape** (glyph area ∝
real volume): a to-scale thalamus holding the **anterior** nucleus, **MD**
(~850 mm³, → prefrontal), **VA/VL** (motor), **VPL/VPM** (~500 mm³, touch/taste),
the big **pulvinar** cushion (~1,100 mm³), an **MGN** (~99 mm³), and the **LGN**
(~124 mm³) drawn *unfolded* into its six layers (the ventral two magnocellular,
the dorsal four parvocellular) — all inside the whole-thalamus egg (~5,571 mm³,
Iglesias 2018). The other **sensory transduction stations** are shown too, at
realistic relative size: the **olfactory bulb** (~46 mm³, with a glomerular
edge), the **superior & inferior colliculi** as the quadrigeminal plate (~72 /
~50 mm³), and the named **brainstem relays** (cochlear nuclei, gracile/cuneate,
solitary nucleus). Smell is wired correctly as the one sense with **no thalamic
relay** — nose → olfactory bulb → piriform.

**Wiring rides ONE width standard, and is directional:**
- A single **linear width standard** — `9 px = 1,000,000 fibers` — applied to
  *every* wire so counts are honestly comparable: optic ~1M, cochlear ~31k,
  olfactory ~7M (thicker than optic!), corticospinal ~1M, corpus callosum ~200M
  (drawn at a cap, labeled ~20× off-scale).
- **Feed-forward vs feedback in different colors**, so you can see which way the
  cortico-cortical fibers run.
- Because **human area-to-area fiber counts are essentially unmeasured**,
  cortico-cortical links ride the *same* standard via a cited order-of-magnitude
  estimate (~10³–10⁵ axons/area-pair; median ~6k, Schüz/Wang 2022) — so on an
  honest scale they are **hairlines next to the sensory nerves**, drawn
  **dashed**, with relative strength shown by **opacity**, never a fabricated
  number. Click any wire for its measured count + citation, or its estimate basis.

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
index.html            landing page → links to all four views
shared/layout.js      layered layout + crossing minimization
3d/                   Brain in 3D (Three.js)
  index.html · app.js          (reuses ../unfolded/anatomyData.js)
unfolded/             The Unfolded Cortex (realistic 2D flatmap)
  index.html · atlas.js · app.js
  build_flatmap.js → flatmapGeo.js   (weighted-Voronoi parcellation, build-time)
  anatomyData.js                     (older schematic dataset; still used by 3d/)
block/                The Unfolded Brain (layered schematic)
  index.html · brainData.js · app.js
fiber/                Brain Fiber Circuit (cited fiber counts)
  index.html · brainData.js · app.js
```

The `block/` and `fiber/` views share the same generic graph model and layout
engine. The `unfolded/` view is a bespoke anatomical illustration with its own
data model (`anatomyData.js`), and the `3d/` view reuses that same data in a
Three.js scene.

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
