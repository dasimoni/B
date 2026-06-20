/*
 * atlas.js — data for the realistic unfolded cortex + sensory-relay view
 * ----------------------------------------------------------------------
 * Shared by the Node build script (build_flatmap.js) and the browser.
 *
 * Design rules
 *   • Cortical AREAS are continuous regions of a flattened hemisphere, sized by
 *     their REAL unfolded surface area (cm²) and placed by REAL topography.
 *     Boundaries are smoothed in the build step so they read as sulci, not as
 *     angular "caricature" tiles.
 *   • Subcortical relays (thalamic nuclei) and the other sensory TRANSDUCTION
 *     stations (olfactory bulb, colliculi, brainstem nuclei) are drawn at
 *     realistic RELATIVE size — glyph area ∝ real volume (mm³).
 *   • ONE fiber→width standard (WIDTH, linear px per million fibers) is used for
 *     EVERY connection so relative fiber counts are honestly comparable. The big
 *     sensory nerves and the corpus callosum are measured; individual area-to-
 *     area cortico-cortical projections are NOT measured in humans, so they ride
 *     the same standard (hence hairline-thin) but are dashed + flagged, and their
 *     relative strength is shown by opacity, never by a fabricated number.
 *
 * Sources: Van Essen 2012 (~973–1100 cm²/hemisphere); Benson 2021 (V1/V2/V3);
 * Glasser HCP-MMP1 2016; von Economo & Koskinas; Iglesias 2018 thalamic atlas;
 * Jonas 1990 (optic); Spoendlin & Schrott 1989 (cochlear); Aboitiz 1992
 * (callosum); DeMyer/Lassek (pyramidal); Caminiti & Girard 2022 (cortico est.).
 * Numbers flagged "≈" are approximate; see README.
 */

(function (global) {
  "use strict";

  const SYSTEMS = {
    visual:        { name: "Visual (occipital)",     color: "#5B8FF9" },
    auditory:      { name: "Auditory",               color: "#5AD8A6" },
    somatosensory: { name: "Somatosensory/parietal", color: "#5D7092" },
    motor:         { name: "Motor",                  color: "#FF9D4D" },
    executive:     { name: "Prefrontal",             color: "#6DC8EC" },
    language:      { name: "Language",               color: "#F6BD16" },
    temporal:      { name: "Temporal assoc.",        color: "#C586C0" },
    limbic:        { name: "Limbic / medial",        color: "#E8684A" },
    olfactory:     { name: "Olfactory",              color: "#9270CA" },
    gustatory:     { name: "Insula / taste",         color: "#F08BB4" },
  };

  // Cortical areas as continuous regions of a flattened hemisphere.
  //   weight = approx real unfolded surface area (cm², one hemisphere) → region SIZE
  //   seed   = anatomically-suggestive position in local flatmap coords
  //            (x: 0 anterior/frontal → 600 posterior/occipital;
  //             y: 0 dorsal → 420 ventral). The ventral band (y>320) is the
  //            temporal lobe; the dorsal band the fronto-parietal convexity.
  // weight values reconciled with: Benson 2021 (V1/V2/V3 retinotopic — MEASURED),
  // Glasser 2016 / von Economo (non-visual areas — APPROX per-parcel cm²).
  const AREAS = [
    { id: "prefrontal",   label: "Prefrontal cortex",        short: "PFC",     system: "executive",     weight: 95,  seed: [62, 150] },
    { id: "orbitofrontal",label: "Orbitofrontal",            short: "OFC",     system: "executive",     weight: 20,  seed: [70, 320] },
    { id: "broca",        label: "Broca's area (IFG)",       short: "Broca",   system: "language",      weight: 8,   seed: [140, 250] },
    { id: "premotor",     label: "Premotor / SMA",           short: "PM/SMA",  system: "motor",         weight: 36,  seed: [182, 120] },
    { id: "m1",           label: "M1 — primary motor",       short: "M1",      system: "motor",         weight: 28,  seed: [248, 110] },
    { id: "s1",           label: "S1 — primary somatosens.", short: "S1",      system: "somatosensory", weight: 30,  seed: [304, 110] },
    { id: "spl",          label: "Superior parietal",        short: "SPL",     system: "somatosensory", weight: 36,  seed: [388, 112] },
    { id: "ipl",          label: "Inferior parietal (AG/SMG)", short: "IPL",   system: "somatosensory", weight: 46,  seed: [392, 200] },
    { id: "insula",       label: "Insula (gustatory)",       short: "Insula",  system: "gustatory",     weight: 18,  seed: [222, 235] },
    { id: "a1",           label: "A1 — primary auditory",    short: "A1",      system: "auditory",      weight: 4,   seed: [300, 298] },
    { id: "wernicke",     label: "Wernicke / post-STG",      short: "Wern.",   system: "auditory",      weight: 14,  seed: [362, 285] },
    { id: "mitg",         label: "Middle/inferior temporal", short: "MTG/ITG", system: "temporal",      weight: 58,  seed: [300, 362] },
    { id: "fusiform",     label: "Fusiform",                 short: "Fus.",    system: "temporal",      weight: 24,  seed: [432, 352] },
    { id: "tpole",        label: "Temporal pole",            short: "T-pole",  system: "temporal",      weight: 11,  seed: [172, 360] },
    { id: "mt",           label: "MT / V5 (motion)",         short: "MT",      system: "visual",        weight: 2,   seed: [470, 250] },
    { id: "v4",           label: "V4 / ventral occ.",        short: "V4",      system: "visual",        weight: 4,   seed: [496, 312] },
    { id: "v2v3",         label: "V2 / V3",                  short: "V2/3",    system: "visual",        weight: 23,  seed: [536, 200] },
    { id: "v1",           label: "V1 — primary visual",      short: "V1",      system: "visual",        weight: 20,  seed: [576, 205] },
    { id: "cingulate",    label: "Cingulate",                short: "Cing.",   system: "limbic",        weight: 48,  seed: [262, 46] },
    { id: "entorhinal",   label: "Entorhinal",               short: "Ento.",   system: "limbic",        weight: 4,   seed: [150, 398] },
    { id: "piriform",     label: "Piriform (olfactory ctx)", short: "Pir.",    system: "olfactory",     weight: 2,   seed: [112, 372] },
  ];

  // Local flatmap outline — a realistic flatmap silhouette (NOT a plain ellipse):
  // a rounded fronto-parieto-occipital convexity with a ventral temporal-lobe
  // extension. Generated parametrically in build_flatmap.js from these controls.
  const OUTLINE = {
    cx: 300, cy: 200, rx: 292, ry: 150,
    // temporal-lobe bulge: extra ventral radius centered around angle θ (rad),
    // width σ (rad), magnitude added to ry on the ventral side.
    temporal: { theta: 1.95, sigma: 0.62, mag: 120 },
    // gentle occipital point (posterior, +x): radius gain near θ≈0
    occipital: { sigma: 0.5, mag: 24 },
  };

  // ---- Thalamus & its relay nuclei — realistic relative volume (mm³) ----
  // `local` = position inside the thalamus glyph box (0..1 each axis;
  //  x: 0 anterior → 1 posterior, y: 0 dorsal → 1 ventral). glyph area ∝ vol.
  const THALAMUS = { vol: 5571 }; // whole-thalamus volume (Iglesias 2018)
  // volumes from Iglesias et al. 2018 thalamic atlas (mm³, one side).
  const RELAYS = [
    { id: "anterior", label: "Anterior",    system: "limbic",        vol: 110,  shape: "ovoid",   local: [0.22, 0.20] },
    { id: "md",       label: "MD",          system: "executive",     vol: 850,  shape: "ovoid",   local: [0.34, 0.46] },
    { id: "vavl",     label: "VA/VL",       system: "motor",         vol: 800,  shape: "ovoid",   local: [0.46, 0.34] },
    { id: "vpl",      label: "VPL/VPM",     system: "somatosensory", vol: 500,  shape: "ovoid",   local: [0.56, 0.52] },
    { id: "pulvinar", label: "Pulvinar",    system: "visual",        vol: 1100, shape: "cushion", local: [0.76, 0.44] },
    { id: "lgn",      label: "LGN",         system: "visual",        vol: 124,  shape: "lgn",     local: [0.86, 0.76] },
    { id: "mgn",      label: "MGN",         system: "auditory",      vol: 99,   shape: "ovoid",   local: [0.70, 0.82] },
  ];
  // which relays carry which modality forward (for the unfolded-LGN layering etc.)
  const RELAY_OF = { lgn: "visual", mgn: "auditory", vpl: "somatosensory", pulvinar: "visual", md: "executive", vavl: "motor", anterior: "limbic" };

  // ---- Other sensory transduction / relay stations (non-thalamic) ----
  // Drawn at realistic relative size (glyph area ∝ vol, mm³). `at` = screen-ish
  // anchor resolved per-hemisphere in app.js; `mid` = single midline glyph.
  // volumes from 7T brainstem atlas (Front Neuroanat 2019) & olfactory-bulb MRI.
  const STATIONS = [
    { id: "olfbulb", label: "Olfactory bulb", system: "olfactory", vol: 46, shape: "bulb",  per: "hemi", note: "glomerular relay; no thalamic relay — projects straight to piriform" },
    { id: "sc",      label: "Sup. colliculus", system: "visual",   vol: 72, shape: "ovoid", per: "mid",  note: "midbrain tectum — orienting/visual relay" },
    { id: "ic",      label: "Inf. colliculus", system: "auditory", vol: 50, shape: "ovoid", per: "mid",  note: "midbrain tectum — obligatory auditory relay → MGN" },
  ];
  // small named brainstem relay nuclei (labels only, drawn as a compact band)
  const BRAINSTEM_RELAYS = [
    { id: "cochlearnuc", label: "Cochlear nuclei",   system: "auditory" },
    { id: "dcn",         label: "Gracile/cuneate",   system: "somatosensory" },
    { id: "nts",         label: "Solitary nucleus",  system: "gustatory" },
  ];

  const CITATIONS = {
    surface:      { text: "Van Essen et al. 2012 — human hemisphere unfolded surface ≈ 973–1100 cm²", url: "https://pubmed.ncbi.nlm.nih.gov/22209522/" },
    benson:       { text: "Benson et al. 2021 — V1/V2/V3 retinotopic surface areas", url: "https://pubmed.ncbi.nlm.nih.gov/33464304/" },
    iglesias:     { text: "Iglesias et al. 2018 — probabilistic thalamic nuclei atlas (volumes mm³)", url: "https://pubmed.ncbi.nlm.nih.gov/30121337/" },
    optic:        { text: "Jonas et al. 1990 — optic nerve ≈ 1.0M axons/eye", url: "https://pubmed.ncbi.nlm.nih.gov/2780002/" },
    cochlear:     { text: "Spoendlin & Schrott 1989 — cochlear nerve ≈ 30–35k fibers", url: "https://pubmed.ncbi.nlm.nih.gov/2613564/" },
    olfactory:    { text: "StatPearls CN I — ≈ 6–10M olfactory receptor neurons/side", url: "https://www.ncbi.nlm.nih.gov/books/NBK556051/" },
    corticospinal:{ text: "DeMyer 1959; Lassek 1940 — pyramidal tract ≈ 1.0M (~700k myelinated)", url: "https://www.neurology.org/doi/10.1212/wnl.9.1.42" },
    callosum:     { text: "Aboitiz et al. 1992 — corpus callosum ≈ 200M axons", url: "https://pubmed.ncbi.nlm.nih.gov/1486477/" },
    ac:           { text: "Tomasch 1957 — anterior commissure ≈ 3.5M fibers", url: "" },
    olfbulb:      { text: "Olfactory bulb volume ≈ 40–58 mm³ (normative MRI; declines with age)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11596477/" },
    colliculi:    { text: "7T brainstem atlas 2019 — sup. colliculus ≈ 72, inf. colliculus ≈ 50, MGN ≈ 60 mm³", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6694208/" },
    arcuate_est:  { text: "Schüz/Wang et al. 2022 (PLOS Biology) — human cortical areas are sparsely connected: a single area-pair ≈ 10³–10⁵ axons (median ~6,200 intra-, ~1,300 inter-hemispheric); dMRI estimate calibrated to histology, NOT a direct count", url: "https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3001575" },
  };

  // ---- sensory inputs, relays & motor output ----
  // fibers: measured count (cited) | null = not measured (drawn dashed, "not measured")
  const PATHWAYS = [
    // VISION: eye → (SC tap) → LGN → V1
    { from: "eyeL", to: "lgn:L", group: "afferent", system: "visual", tract: "Optic nerve (CN II)", fibers: 1000000, ref: "optic" },
    { from: "eyeR", to: "lgn:R", group: "afferent", system: "visual", tract: "Optic nerve (CN II)", fibers: 1000000, ref: "optic" },
    { from: "lgn:L", to: "v1:L", group: "relay", system: "visual", tract: "Optic radiation", fibers: null, est: true },
    { from: "lgn:R", to: "v1:R", group: "relay", system: "visual", tract: "Optic radiation", fibers: null, est: true },

    // HEARING: ear → IC → MGN → A1
    { from: "earL", to: "ic", group: "afferent", system: "auditory", tract: "Cochlear nerve (CN VIII) → brainstem → IC", fibers: 31000, ref: "cochlear" },
    { from: "earR", to: "ic", group: "afferent", system: "auditory", tract: "Cochlear nerve (CN VIII) → brainstem → IC", fibers: 31000, ref: "cochlear" },
    { from: "ic", to: "mgn:L", group: "relay", system: "auditory", tract: "Brachium of IC", fibers: null, est: true },
    { from: "ic", to: "mgn:R", group: "relay", system: "auditory", tract: "Brachium of IC", fibers: null, est: true },
    { from: "mgn:L", to: "a1:L", group: "relay", system: "auditory", tract: "Acoustic radiation", fibers: null, est: true },
    { from: "mgn:R", to: "a1:R", group: "relay", system: "auditory", tract: "Acoustic radiation", fibers: null, est: true },

    // SMELL: nose → olfactory bulb → piriform (UNIQUE: no thalamic relay)
    { from: "nose", to: "olfbulb:L", group: "afferent", system: "olfactory", tract: "Olfactory nerve (CN I)", fibers: 7000000, ref: "olfactory" },
    { from: "nose", to: "olfbulb:R", group: "afferent", system: "olfactory", tract: "Olfactory nerve (CN I)", fibers: 7000000, ref: "olfactory" },
    { from: "olfbulb:L", to: "piriform:L", group: "relay", system: "olfactory", tract: "Lateral olfactory tract", fibers: null, est: true },
    { from: "olfbulb:R", to: "piriform:R", group: "relay", system: "olfactory", tract: "Lateral olfactory tract", fibers: null, est: true },

    // TOUCH: body → dorsal columns/medial lemniscus → VPL → S1
    { from: "body", to: "vpl:L", group: "afferent", system: "somatosensory", tract: "Dorsal columns → medial lemniscus", fibers: null, est: true, note: "no reliable human axon count" },
    { from: "body", to: "vpl:R", group: "afferent", system: "somatosensory", tract: "Dorsal columns → medial lemniscus", fibers: null, est: true, note: "no reliable human axon count" },
    { from: "vpl:L", to: "s1:L", group: "relay", system: "somatosensory", tract: "Thalamocortical radiation", fibers: null, est: true },
    { from: "vpl:R", to: "s1:R", group: "relay", system: "somatosensory", tract: "Thalamocortical radiation", fibers: null, est: true },

    // TASTE: tongue → solitary nucleus → VPM → insula
    { from: "tongue", to: "vpl:L", group: "afferent", system: "gustatory", tract: "VII/IX/X → solitary nucleus → VPM", fibers: null, est: true },
    { from: "vpl:L", to: "insula:L", group: "relay", system: "gustatory", tract: "→ gustatory cortex (insula)", fibers: null, est: true },

    // MOTOR OUT: M1 → corticospinal → cord
    { from: "m1:L", to: "brainstem", group: "motor", system: "motor", tract: "Corticospinal tract", fibers: 1000000, ref: "corticospinal" },
    { from: "m1:R", to: "brainstem", group: "motor", system: "motor", tract: "Corticospinal tract", fibers: 1000000, ref: "corticospinal" },
    { from: "brainstem", to: "spinal", group: "motor", system: "motor", tract: "Corticospinal (descends)", fibers: null, est: true },
  ];

  // ---- cortico-cortical [a, b, strength 1..3] : a→b feed-forward, b→a feedback ----
  // strength is a RELATIVE estimate only (shown by opacity); the width rides the
  // single fiber standard via an estimated order-of-magnitude (EST_OOM) → so an
  // area-pair is honestly hairline next to the optic nerve / corpus callosum.
  const CORTICO = [
    ["v1", "v2v3", 3], ["v2v3", "v4", 3], ["v4", "fusiform", 2], ["v2v3", "mt", 2],
    ["mt", "ipl", 2], ["v4", "mitg", 2], ["a1", "wernicke", 3], ["wernicke", "broca", 2],
    ["wernicke", "ipl", 2], ["s1", "spl", 3], ["spl", "ipl", 2], ["spl", "premotor", 2],
    ["ipl", "prefrontal", 2], ["mitg", "tpole", 2], ["mitg", "prefrontal", 1], ["fusiform", "mitg", 2],
    ["prefrontal", "premotor", 3], ["premotor", "m1", 3], ["broca", "premotor", 2], ["prefrontal", "broca", 2],
    ["prefrontal", "orbitofrontal", 2], ["orbitofrontal", "insula", 1], ["cingulate", "prefrontal", 2],
    ["ipl", "wernicke", 1], ["tpole", "entorhinal", 2],
  ];
  // estimated order-of-magnitude axon count per area-pair, by strength tier
  // (within the cited 10³–10⁵ range, median ~6k — NOT a measured number; dashed).
  const EST_OOM = { 1: 3000, 2: 10000, 3: 50000 };

  // Homologous areas joined across the midline by the corpus callosum.
  const CALLOSUM_AREAS = ["v1", "v2v3", "spl", "s1", "m1", "premotor", "prefrontal", "ipl", "wernicke", "cingulate"];

  // Width standard (LINEAR): pixels per 1,000,000 fibers, with floor & soft cap.
  // The SAME standard is applied to every wire so widths are comparable.
  const WIDTH = { pxPerMillion: 9, floor: 1.1, cap: 70 };

  // Direction colors for cortico-cortical wires
  const DIR = { ff: "#ffae5c", fb: "#b98bff" }; // feed-forward (warm) vs feedback (cool)

  global.ATLAS = {
    SYSTEMS, AREAS, OUTLINE, THALAMUS, RELAYS, RELAY_OF, STATIONS, BRAINSTEM_RELAYS,
    CITATIONS, PATHWAYS, CORTICO, EST_OOM, CALLOSUM_AREAS, WIDTH, DIR,
  };
})(typeof window !== "undefined" ? window : globalThis);
