/*
 * atlas.js — data for the realistic unfolded cortex
 * -------------------------------------------------
 * Shared by the Node build script (build_flatmap.js) and the browser.
 *
 * AREAS:  cortical areas as continuous regions of a flattened hemisphere.
 *         `weight` = approximate real unfolded surface area (cm²) — drives the
 *         relative SIZE of each region in the weighted-Voronoi parcellation.
 *         `seed`   = anatomically-suggestive position in local flatmap coords
 *         (x: 0 anterior → 600 posterior, y: 0 dorsal → 420 ventral).
 *         Sizes from Benson 2021 (V1/V2/V3), Glasser HCP-MMP1, von Economo,
 *         Van Essen 2012 (~973 cm²/hemisphere). Approximate; see README.
 *
 * RELAYS: subcortical structures drawn at realistic RELATIVE size. `vol` = real
 *         volume (mm³); glyph size ∝ sqrt(vol). Thalamic nuclei from Iglesias
 *         2018 atlas (LGN 124, MGN 99, pulvinar ~1700, VPL ~600, thalamus 5571).
 *
 * CONNECTIONS: each wire carries a measured fiber count (with citation) OR is a
 *         flagged estimate. `dir` distinguishes feed-forward vs feedback so the
 *         two directions can be drawn in different colors.
 */

(function (global) {
  "use strict";

  const SYSTEMS = {
    visual:        { name: "Visual (occipital)",   color: "#5B8FF9" },
    auditory:      { name: "Auditory",             color: "#5AD8A6" },
    somatosensory: { name: "Somatosensory/parietal", color: "#5D7092" },
    motor:         { name: "Motor",                color: "#FF9D4D" },
    executive:     { name: "Prefrontal",           color: "#6DC8EC" },
    language:      { name: "Language",             color: "#F6BD16" },
    temporal:      { name: "Temporal assoc.",      color: "#C586C0" },
    limbic:        { name: "Limbic / medial",      color: "#E8684A" },
    olfactory:     { name: "Olfactory",            color: "#9270CA" },
    gustatory:     { name: "Insula / taste",       color: "#F08BB4" },
  };

  // id, label, short, system, weight(cm²), seed[x,y]
  const AREAS = [
    { id: "prefrontal",   label: "Prefrontal cortex",        short: "PFC",     system: "executive",     weight: 90,  seed: [60, 150] },
    { id: "orbitofrontal",label: "Orbitofrontal",            short: "OFC",     system: "executive",     weight: 22,  seed: [62, 330] },
    { id: "broca",        label: "Broca's area",             short: "Broca",   system: "language",      weight: 7,   seed: [138, 250] },
    { id: "premotor",     label: "Premotor / SMA",           short: "PM",      system: "motor",         weight: 30,  seed: [180, 120] },
    { id: "m1",           label: "M1 — primary motor",       short: "M1",      system: "motor",         weight: 18,  seed: [250, 108] },
    { id: "s1",           label: "S1 — primary somatosens.", short: "S1",      system: "somatosensory", weight: 20,  seed: [306, 108] },
    { id: "spl",          label: "Superior parietal",        short: "SPL",     system: "somatosensory", weight: 30,  seed: [388, 110] },
    { id: "ipl",          label: "Inferior parietal (angular/SMG)", short: "IPL", system: "somatosensory", weight: 28, seed: [392, 200] },
    { id: "insula",       label: "Insula (gustatory)",       short: "Insula",  system: "gustatory",     weight: 15,  seed: [220, 235] },
    { id: "a1",           label: "A1 — primary auditory",    short: "A1",      system: "auditory",      weight: 3,   seed: [300, 300] },
    { id: "wernicke",     label: "Wernicke / post-STG",      short: "Wern.",   system: "auditory",      weight: 12,  seed: [362, 285] },
    { id: "mitg",         label: "Middle/inferior temporal", short: "MTG",     system: "temporal",      weight: 35,  seed: [300, 362] },
    { id: "fusiform",     label: "Fusiform",                 short: "Fus.",    system: "temporal",      weight: 18,  seed: [432, 355] },
    { id: "tpole",        label: "Temporal pole",            short: "T-pole",  system: "temporal",      weight: 8,   seed: [175, 362] },
    { id: "mt",           label: "MT / V5 (motion)",         short: "MT",      system: "visual",        weight: 2,   seed: [470, 250] },
    { id: "v4",           label: "V4 / ventral occ.",        short: "V4",      system: "visual",        weight: 8,   seed: [496, 312] },
    { id: "v2v3",         label: "V2 / V3",                  short: "V2/3",    system: "visual",        weight: 35,  seed: [536, 200] },
    { id: "v1",           label: "V1 — primary visual",      short: "V1",      system: "visual",        weight: 22,  seed: [576, 200] },
    { id: "cingulate",    label: "Cingulate",                short: "Cing.",   system: "limbic",        weight: 35,  seed: [262, 46] },
    { id: "entorhinal",   label: "Entorhinal",               short: "Ento.",   system: "limbic",        weight: 3,   seed: [150, 400] },
    { id: "piriform",     label: "Piriform (olfactory)",     short: "Pir.",    system: "olfactory",     weight: 1.2, seed: [110, 372] },
  ];

  // Local flatmap outline (ellipse), shared by build + render. 0..600 x, 0..420 y.
  const OUTLINE = { cx: 300, cy: 210, rx: 292, ry: 202 };

  // Subcortical relays — realistic relative sizes (mm³) & shapes.
  // `local` = position inside the thalamus glyph box (0..1 each axis).
  const RELAYS = [
    { id: "pulvinar", label: "Pulvinar",     vol: 1700, shape: "cushion", local: [0.74, 0.42] },
    { id: "vpl",      label: "VPL/VPM",      vol: 600,  shape: "ovoid",   local: [0.40, 0.40] },
    { id: "lgn",      label: "LGN",          vol: 124,  shape: "lgn",     local: [0.78, 0.74] },
    { id: "mgn",      label: "MGN",          vol: 99,   shape: "ovoid",   local: [0.66, 0.80] },
  ];
  const THALAMUS = { vol: 5571 }; // whole-thalamus volume, for the egg glyph scale

  const CITATIONS = {
    optic:        { text: "Jonas et al. 1990 — optic nerve ~1.0M axons/eye", url: "https://pubmed.ncbi.nlm.nih.gov/2780002/" },
    cochlear:     { text: "Spoendlin & Schrott 1989 — cochlear nerve ~30–35k", url: "https://pubmed.ncbi.nlm.nih.gov/2613564/" },
    olfactory:    { text: "StatPearls CN I — ~6–10M olfactory neurons/side", url: "https://www.ncbi.nlm.nih.gov/books/NBK556051/" },
    corticospinal:{ text: "DeMyer 1959; Lassek 1940 — pyramidal tract ~1.0M (~700k myelinated)", url: "https://www.neurology.org/doi/10.1212/wnl.9.1.42" },
    callosum:     { text: "Aboitiz et al. 1992 — corpus callosum ~200M axons", url: "https://pubmed.ncbi.nlm.nih.gov/1486477/" },
    ac:           { text: "Tomasch 1957 — anterior commissure ~3.5M fibers", url: "" },
    arcuate_est:  { text: "Estimate: SLF/arcuate ~0.8–1.3×10^8 axons (density×MRI volume, not a direct count); area-pair ~10^3–10^5 (Caminiti/Girard 2022)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8947121/" },
  };

  // ---- sensory inputs & motor output (mostly measured) ----
  // group: afferent | relay | motor ; dir: null
  const PATHWAYS = [
    { from: "eyeL", to: "lgn:L", group: "afferent", system: "visual", tract: "Optic nerve (CN II)", fibers: 1000000, ref: "optic" },
    { from: "eyeR", to: "lgn:R", group: "afferent", system: "visual", tract: "Optic nerve (CN II)", fibers: 1000000, ref: "optic" },
    { from: "lgn:L", to: "v1:L", group: "relay", system: "visual", tract: "Optic radiation", fibers: null, est: true },
    { from: "lgn:R", to: "v1:R", group: "relay", system: "visual", tract: "Optic radiation", fibers: null, est: true },

    { from: "earL", to: "mgn:L", group: "afferent", system: "auditory", tract: "Cochlear nerve (CN VIII)", fibers: 31000, ref: "cochlear" },
    { from: "earR", to: "mgn:R", group: "afferent", system: "auditory", tract: "Cochlear nerve (CN VIII)", fibers: 31000, ref: "cochlear" },
    { from: "mgn:L", to: "a1:L", group: "relay", system: "auditory", tract: "Acoustic radiation", fibers: null, est: true },
    { from: "mgn:R", to: "a1:R", group: "relay", system: "auditory", tract: "Acoustic radiation", fibers: null, est: true },

    { from: "nose", to: "olfbulbL", group: "afferent", system: "olfactory", tract: "Olfactory nerve (CN I)", fibers: 7000000, ref: "olfactory" },
    { from: "nose", to: "olfbulbR", group: "afferent", system: "olfactory", tract: "Olfactory nerve (CN I)", fibers: 7000000, ref: "olfactory" },
    { from: "olfbulbL", to: "piriform:L", group: "relay", system: "olfactory", tract: "Lateral olfactory tract", fibers: null, est: true },
    { from: "olfbulbR", to: "piriform:R", group: "relay", system: "olfactory", tract: "Lateral olfactory tract", fibers: null, est: true },

    { from: "body", to: "vpl:L", group: "afferent", system: "somatosensory", tract: "Dorsal columns → medial lemniscus", fibers: null, est: true, note: "no reliable human axon count" },
    { from: "body", to: "vpl:R", group: "afferent", system: "somatosensory", tract: "Dorsal columns → medial lemniscus", fibers: null, est: true, note: "no reliable human axon count" },
    { from: "vpl:L", to: "s1:L", group: "relay", system: "somatosensory", tract: "Thalamocortical radiation", fibers: null, est: true },
    { from: "vpl:R", to: "s1:R", group: "relay", system: "somatosensory", tract: "Thalamocortical radiation", fibers: null, est: true },

    { from: "tongue", to: "vpl:L", group: "afferent", system: "gustatory", tract: "VII/IX nerves → VPM", fibers: null, est: true },
    { from: "vpl:L", to: "insula:L", group: "relay", system: "gustatory", tract: "→ gustatory cortex", fibers: null, est: true },

    { from: "m1:L", to: "brainstem", group: "motor", system: "motor", tract: "Corticospinal tract", fibers: 1000000, ref: "corticospinal" },
    { from: "m1:R", to: "brainstem", group: "motor", system: "motor", tract: "Corticospinal tract", fibers: 1000000, ref: "corticospinal" },
    { from: "brainstem", to: "spinal", group: "motor", system: "motor", tract: "Corticospinal (descends)", fibers: null, est: true },
  ];

  // ---- cortico-cortical [a, b, strength 1..3] : a→b feed-forward, b→a feedback ----
  const CORTICO = [
    ["v1", "v2v3", 3], ["v2v3", "v4", 3], ["v4", "fusiform", 2], ["v2v3", "mt", 2],
    ["mt", "ipl", 2], ["v4", "mitg", 2], ["a1", "wernicke", 3], ["wernicke", "broca", 2],
    ["wernicke", "ipl", 2], ["s1", "spl", 3], ["spl", "ipl", 2], ["spl", "premotor", 2],
    ["ipl", "prefrontal", 2], ["mitg", "tpole", 2], ["mitg", "prefrontal", 1], ["fusiform", "mitg", 2],
    ["prefrontal", "premotor", 3], ["premotor", "m1", 3], ["broca", "premotor", 2], ["prefrontal", "broca", 2],
    ["prefrontal", "orbitofrontal", 2], ["orbitofrontal", "insula", 1], ["cingulate", "prefrontal", 2],
    ["ipl", "wernicke", 1], ["tpole", "entorhinal", 2],
  ];

  // Homologous areas joined across the midline by the corpus callosum.
  const CALLOSUM_AREAS = ["v1", "v2v3", "spl", "s1", "m1", "premotor", "prefrontal", "ipl", "wernicke", "cingulate"];

  // Width standard (LINEAR): pixels per 1,000,000 fibers, with floor & soft cap.
  const WIDTH = { pxPerMillion: 9, floor: 1.2, cap: 84 };

  // Direction colors
  const DIR = { ff: "#ffae5c", fb: "#b98bff" }; // feed-forward (warm) vs feedback (cool)

  global.ATLAS = {
    SYSTEMS, AREAS, OUTLINE, RELAYS, THALAMUS, CITATIONS,
    PATHWAYS, CORTICO, CALLOSUM_AREAS, WIDTH, DIR,
  };
})(typeof window !== "undefined" ? window : globalThis);
