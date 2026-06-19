/*
 * brainData.js — Human sensory→motor pathways with REAL fiber counts
 * -----------------------------------------------------------------
 * A circuit diagram of the brain's major input and output cables, traced from
 * the actual end organs (retina, cochlea, olfactory epithelium, skin, viscera)
 * inward to cortex and back out to the body — drawn with the *measured* number
 * of nerve fibers in each named tract.
 *
 * Fiber counts are histological measurements from the published literature
 * (see CITATIONS). Edge thickness in the visualization is a log-scale of
 * `fibers`. Where no fiber count has been measured for a connection, `fibers`
 * is null and the edge is explicitly drawn as "not measured" rather than
 * guessed — per the project's cited-counts-only rule.
 *
 *   node = { id, label, system, layer, info }
 *   edge = { source, target, tract, fibers, fiberLabel, ref, kind, info }
 *     fibers      measured axon count, or null if not measured
 *     fiberLabel  human-readable form of the count
 *     ref         key into CITATIONS (only for counted edges)
 *     kind        'sensory' | 'central' | 'motor' | 'commissural'
 */

(function (global) {
  "use strict";

  const SYSTEMS = {
    visual:        { name: "Visual",        color: "#5B8FF9" },
    auditory:      { name: "Auditory",      color: "#5AD8A6" },
    vestibular:    { name: "Vestibular",    color: "#2FB8C0" },
    somatosensory: { name: "Somatosensory", color: "#5D7092" },
    olfactory:     { name: "Olfactory",     color: "#9270CA" },
    autonomic:     { name: "Visceral / autonomic", color: "#D88C9A" },
    association:   { name: "Association cortex", color: "#F6BD16" },
    motor:         { name: "Motor / output", color: "#FF9D4D" },
  };

  const LAYERS = [
    "Sensory organ",          // 0
    "First relay nucleus",    // 1
    "Thalamic relay",         // 2
    "Primary sensory cortex", // 3
    "Association cortex",      // 4
    "Motor cortex",           // 5
    "Output to body",         // 6
  ];

  // Literature sources for every measured count.
  const CITATIONS = {
    optic:        { text: "Jonas et al. 1990 — human optic nerve axon count (mean ≈0.97M, range 0.69–1.69M)", url: "https://pubmed.ncbi.nlm.nih.gov/2780002/" },
    cochlear:     { text: "Spoendlin & Schrott 1989 — analysis of the human auditory nerve (~30,000–35,000 fibers)", url: "https://pubmed.ncbi.nlm.nih.gov/2613564/" },
    vestibular:   { text: "Bergström 1973 — myelinated fibers of the human vestibular nerve (~18,000–20,000)", url: "https://pubmed.ncbi.nlm.nih.gov/4541103/" },
    olfactory:    { text: "StatPearls, Cranial Nerve I — ~6–10 million olfactory sensory neurons per side", url: "https://www.ncbi.nlm.nih.gov/books/NBK556051/" },
    vagus:        { text: "Foley & DuBois 1937 — quantitative study of the vagus nerve (~100,000 fibers, ~80–90% afferent)", url: "" },
    callosum:     { text: "Aboitiz et al. 1992 — fiber composition of the human corpus callosum (~200 million axons)", url: "https://pubmed.ncbi.nlm.nih.gov/1486477/" },
    corticospinal:{ text: "Lassek 1940; Lassek & Rasmussen 1939 — the human pyramidal tract (~1,000,000 fibers, ~700k myelinated)", url: "" },
  };

  const NODES = [
    // Layer 0 — sensory organs (where the world enters)
    { id: "retina",  label: "Retina",                system: "visual",        layer: 0, info: "~1.2M retinal ganglion cells whose axons form the optic nerve." },
    { id: "cochlea", label: "Cochlea",               system: "auditory",      layer: 0, info: "Spiral-ganglion neurons transduce sound into the cochlear nerve." },
    { id: "vestib",  label: "Vestibular organ",      system: "vestibular",    layer: 0, info: "Semicircular canals & otolith organs sensing head motion/gravity." },
    { id: "olf_epi", label: "Olfactory epithelium",  system: "olfactory",     layer: 0, info: "6–10 million olfactory sensory neurons in the nasal roof." },
    { id: "skin",    label: "Skin & body",           system: "somatosensory", layer: 0, info: "Touch/proprioceptive receptors feeding the dorsal-column pathway." },
    { id: "viscera", label: "Viscera / gut",         system: "autonomic",     layer: 0, info: "Internal organs reporting state via the vagus nerve." },

    // Layer 1 — first central relay
    { id: "lgn",     label: "LGN (thalamus)",        system: "visual",        layer: 1, info: "Lateral geniculate nucleus — thalamic relay for vision." },
    { id: "cn",      label: "Cochlear nucleus",      system: "auditory",      layer: 1, info: "First brainstem station of the auditory pathway." },
    { id: "vnuc",    label: "Vestibular nuclei",     system: "vestibular",    layer: 1, info: "Brainstem nuclei distributing balance signals widely." },
    { id: "olf_bulb",label: "Olfactory bulb",        system: "olfactory",     layer: 1, info: "Olfaction bypasses the thalamus; massive convergence here." },
    { id: "dcn",     label: "Dorsal column nuclei",  system: "somatosensory", layer: 1, info: "Gracile & cuneate nuclei — first relay for fine touch." },
    { id: "nts",     label: "Nucleus tractus sol.",  system: "autonomic",     layer: 1, info: "NTS — primary visceral-sensory nucleus in the medulla." },

    // Layer 2 — thalamic relay (vision/olfaction already routed)
    { id: "mgn",     label: "MGN (thalamus)",        system: "auditory",      layer: 2, info: "Medial geniculate nucleus — thalamic relay for hearing." },
    { id: "vpl",     label: "VPL/VPM (thalamus)",    system: "somatosensory", layer: 2, info: "Ventral posterior nucleus — thalamic relay for body/face." },

    // Layer 3 — primary sensory cortex
    { id: "v1",      label: "V1 (visual)",           system: "visual",        layer: 3, info: "Primary visual cortex, occipital lobe." },
    { id: "a1",      label: "A1 (auditory)",         system: "auditory",      layer: 3, info: "Primary auditory cortex, Heschl's gyrus." },
    { id: "s1",      label: "S1 (somatosensory)",    system: "somatosensory", layer: 3, info: "Primary somatosensory cortex, postcentral gyrus." },
    { id: "piriform",label: "Piriform (olfactory)",  system: "olfactory",     layer: 3, info: "Primary olfactory cortex." },

    // Layer 4 — association cortex (two hemispheres, joined by the callosum)
    { id: "assocL",  label: "Association ctx (L)",    system: "association",   layer: 4, info: "Multimodal integration in the left hemisphere." },
    { id: "assocR",  label: "Association ctx (R)",    system: "association",   layer: 4, info: "Multimodal integration in the right hemisphere." },

    // Layer 5 — motor cortex
    { id: "m1",      label: "M1 (motor cortex)",      system: "motor",         layer: 5, info: "Primary motor cortex — origin of the corticospinal tract." },

    // Layer 6 — output
    { id: "brainstem",label: "Brainstem",             system: "motor",         layer: 6, info: "Pyramidal decussation; gateway to the spinal cord." },
    { id: "spinal",   label: "Spinal cord",           system: "motor",         layer: 6, info: "Final common pathway to the muscles." },
  ];

  const EDGES = [
    // ===== SENSORY INPUT CABLES (counted) =====
    { source: "retina", target: "lgn", tract: "Optic nerve & tract (CN II)",
      fibers: 1000000, fiberLabel: "~1,000,000 per eye", ref: "optic", kind: "sensory",
      info: "Retinal ganglion cell axons; ~90% terminate in the LGN." },
    { source: "cochlea", target: "cn", tract: "Cochlear nerve (CN VIII)",
      fibers: 31000, fiberLabel: "~30,000–35,000 per ear", ref: "cochlear", kind: "sensory",
      info: "Spiral-ganglion afferents — ~30× thinner a cable than the optic nerve." },
    { source: "vestib", target: "vnuc", tract: "Vestibular nerve (CN VIII)",
      fibers: 18000, fiberLabel: "~18,000–20,000 per side", ref: "vestibular", kind: "sensory" },
    { source: "olf_epi", target: "olf_bulb", tract: "Olfactory nerve (CN I)",
      fibers: 7000000, fiberLabel: "~6–10 million per side", ref: "olfactory", kind: "sensory",
      info: "Huge receptor population converging massively onto the bulb." },
    { source: "viscera", target: "nts", tract: "Vagus nerve (CN X)",
      fibers: 100000, fiberLabel: "~100,000 (~85% afferent)", ref: "vagus", kind: "sensory",
      info: "Mostly carries information FROM the body TO the brain." },

    // ===== CENTRAL RELAYS (not separately fiber-counted) =====
    { source: "lgn",  target: "v1",  tract: "Optic radiation",                 fibers: null, kind: "central" },
    { source: "cn",   target: "mgn", tract: "Lateral lemniscus → IC → MGN",    fibers: null, kind: "central" },
    { source: "mgn",  target: "a1",  tract: "Acoustic radiation",              fibers: null, kind: "central" },
    { source: "vnuc", target: "vpl", tract: "Vestibulo-thalamic projections",  fibers: null, kind: "central", info: "Diffuse; mainly to parietoinsular cortex." },
    { source: "olf_bulb", target: "piriform", tract: "Lateral olfactory tract",fibers: null, kind: "central" },
    { source: "skin", target: "dcn", tract: "Dorsal columns (gracile & cuneate)", fibers: null, kind: "sensory", info: "Carries fine touch & proprioception; total fiber count not cleanly measured." },
    { source: "dcn",  target: "vpl", tract: "Medial lemniscus",                fibers: null, kind: "central" },
    { source: "vpl",  target: "s1",  tract: "Thalamocortical radiation",       fibers: null, kind: "central" },
    { source: "nts",  target: "assocL", tract: "Viscerosensory → insula",      fibers: null, kind: "central" },

    // sensory cortex → association
    { source: "v1",       target: "assocL", tract: "Cortico-cortical", fibers: null, kind: "central" },
    { source: "a1",       target: "assocL", tract: "Cortico-cortical", fibers: null, kind: "central" },
    { source: "s1",       target: "assocL", tract: "Cortico-cortical", fibers: null, kind: "central" },
    { source: "piriform", target: "assocL", tract: "Cortico-cortical", fibers: null, kind: "central" },

    // ===== INTERHEMISPHERIC (counted — the biggest cable in the brain) =====
    { source: "assocL", target: "assocR", tract: "Corpus callosum",
      fibers: 200000000, fiberLabel: "~200,000,000", ref: "callosum", kind: "commissural",
      info: "The largest fiber tract in the brain, joining the two hemispheres." },

    // association → motor
    { source: "assocL", target: "m1", tract: "Cortico-cortical (assoc → motor)", fibers: null, kind: "central" },
    { source: "assocR", target: "m1", tract: "Cortico-cortical (assoc → motor)", fibers: null, kind: "central" },

    // ===== MOTOR OUTPUT CABLE (counted) =====
    { source: "m1", target: "brainstem", tract: "Corticospinal tract (pyramidal)",
      fibers: 1000000, fiberLabel: "~1,000,000 (~700k myelinated)", ref: "corticospinal", kind: "motor",
      info: "Origin of voluntary movement commands to the body." },
    { source: "brainstem", target: "spinal", tract: "Lateral corticospinal tract",
      fibers: null, kind: "motor", info: "~90% of fibers cross at the pyramidal decussation." },
  ];

  global.BRAIN = { SYSTEMS, LAYERS, NODES, EDGES, CITATIONS };
})(typeof window !== "undefined" ? window : globalThis);
