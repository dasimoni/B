/*
 * brainData.js — Curated brain connectivity dataset
 * -------------------------------------------------
 * A knowledge-based schematic of how the human brain is wired, organized as a
 * processing HIERARCHY from sensory input (top) to motor output (bottom).
 *
 * This is NOT derived from a measured connectivity matrix. It is hand-built
 * from well-established neuroanatomy: the major functional regions and the
 * named white-matter pathways (tracts) that connect them. The goal is
 * legibility — every node and edge is something you can name and follow.
 *
 * The schema is intentionally generic so a real connectome (atlas parcels +
 * a weighted connectivity matrix) can be dropped in later without touching
 * the layout or rendering code:
 *
 *   node  = { id, label, system, layer, hemisphere, info }
 *   edge  = { source, target, tract, kind, info }
 *
 *   layer      integer rank, 0 = sensory input ... N = motor output
 *   system     functional system, used for color (see SYSTEMS below)
 *   kind       'feedforward' | 'feedback' | 'modulatory' | 'commissural'
 *   tract      the white-matter pathway carrying the connection
 */

(function (global) {
  "use strict";

  // Functional systems → color + human-readable name.
  // Ordered roughly input → integration → output.
  const SYSTEMS = {
    visual:        { name: "Visual",            color: "#5B8FF9" },
    auditory:      { name: "Auditory",          color: "#5AD8A6" },
    somatosensory: { name: "Somatosensory",     color: "#5D7092" },
    olfactory:     { name: "Olfactory",         color: "#9270CA" },
    language:      { name: "Language",          color: "#F6BD16" },
    limbic:        { name: "Limbic (memory/emotion)", color: "#E8684A" },
    executive:     { name: "Executive (prefrontal)",  color: "#6DC8EC" },
    motor:         { name: "Motor",             color: "#FF9D4D" },
    subcortical:   { name: "Subcortical relay", color: "#969696" },
  };

  // Layer labels, top (input) → bottom (output).
  const LAYERS = [
    "Sensory periphery",        // 0
    "Thalamic / first relay",   // 1
    "Primary sensory cortex",   // 2
    "Unimodal association",     // 3
    "Multimodal association",   // 4
    "Limbic & memory",          // 5
    "Executive / prefrontal",   // 6
    "Premotor & planning",      // 7
    "Primary motor",            // 8
    "Motor output",             // 9
  ];

  const NODES = [
    // --- Layer 0: sensory periphery (where signals enter) ---
    { id: "retina",   label: "Retina",            system: "visual",        layer: 0, info: "Photoreceptors → retinal ganglion cells. Start of the visual pathway." },
    { id: "cochlea",  label: "Cochlea",           system: "auditory",      layer: 0, info: "Hair cells transduce sound; origin of the auditory (VIII) nerve." },
    { id: "body",     label: "Body receptors",    system: "somatosensory", layer: 0, info: "Touch / proprioception receptors feeding the dorsal column pathway." },
    { id: "nose",     label: "Olfactory epith.",  system: "olfactory",     layer: 0, info: "Olfactory receptor neurons in the nasal epithelium." },

    // --- Layer 1: first relays (mostly thalamus) ---
    { id: "lgn",      label: "LGN (thalamus)",    system: "visual",        layer: 1, info: "Lateral geniculate nucleus — thalamic relay for vision." },
    { id: "mgn",      label: "MGN (thalamus)",    system: "auditory",      layer: 1, info: "Medial geniculate nucleus — thalamic relay for hearing." },
    { id: "vpl",      label: "VPL/VPM (thal.)",   system: "somatosensory", layer: 1, info: "Ventral posterior nucleus — thalamic relay for body/face touch." },
    { id: "olfbulb",  label: "Olfactory bulb",    system: "olfactory",     layer: 1, info: "Olfaction notably bypasses the thalamus, projecting straight to cortex." },

    // --- Layer 2: primary sensory cortex ---
    { id: "v1",       label: "V1 (primary visual)",       system: "visual",        layer: 2, info: "Primary visual cortex, occipital lobe. Receives the optic radiation." },
    { id: "a1",       label: "A1 (primary auditory)",     system: "auditory",      layer: 2, info: "Primary auditory cortex (Heschl's gyrus), temporal lobe." },
    { id: "s1",       label: "S1 (primary somatosens.)",  system: "somatosensory", layer: 2, info: "Primary somatosensory cortex, postcentral gyrus." },
    { id: "piriform", label: "Piriform cortex",           system: "olfactory",     layer: 2, info: "Primary olfactory cortex." },

    // --- Layer 3: unimodal (single-sense) association ---
    { id: "v2v4",     label: "V2/V4 (ventral)",   system: "visual",        layer: 3, info: "Ventral 'what' stream — form & color." },
    { id: "mt",       label: "MT/V5 (dorsal)",    system: "visual",        layer: 3, info: "Dorsal 'where/how' stream — motion & spatial vision." },
    { id: "stg",      label: "STG / Wernicke",    system: "language",      layer: 3, info: "Superior temporal gyrus / Wernicke's area — speech comprehension." },
    { id: "s2",       label: "S2 (assoc. somat.)",system: "somatosensory", layer: 3, info: "Secondary somatosensory cortex — texture, integration." },

    // --- Layer 4: multimodal / heteromodal association ---
    { id: "itc",      label: "Inferotemporal ctx",system: "visual",        layer: 4, info: "Object & face recognition; apex of the ventral stream." },
    { id: "ppc",      label: "Post. parietal ctx",system: "somatosensory", layer: 4, info: "Spatial attention, sensorimotor integration; apex of dorsal stream." },
    { id: "angular",  label: "Angular gyrus",     system: "language",      layer: 4, info: "Cross-modal hub linking language, number, and spatial cognition." },

    // --- Layer 5: limbic — memory & emotion ---
    { id: "entorhinal",label: "Entorhinal ctx",   system: "limbic",        layer: 5, info: "Gateway between neocortex and hippocampus (perforant path)." },
    { id: "hippocampus",label:"Hippocampus",      system: "limbic",        layer: 5, info: "Declarative memory formation; core of the Papez circuit." },
    { id: "amygdala", label: "Amygdala",          system: "limbic",        layer: 5, info: "Emotional salience, fear learning." },
    { id: "cingulate",label: "Cingulate ctx",     system: "limbic",        layer: 5, info: "Limbic integration; part of the Papez circuit." },

    // --- Layer 6: executive / prefrontal ---
    { id: "dlpfc",    label: "DLPFC",             system: "executive",     layer: 6, info: "Dorsolateral prefrontal — working memory, planning." },
    { id: "vmpfc",    label: "vmPFC / OFC",       system: "executive",     layer: 6, info: "Ventromedial / orbitofrontal — value, decision, emotion regulation." },
    { id: "broca",    label: "Broca's area",      system: "language",      layer: 6, info: "Inferior frontal gyrus — speech production & syntax." },

    // --- Layer 7: premotor & planning (incl. subcortical loops) ---
    { id: "sma",      label: "SMA / pre-SMA",     system: "motor",         layer: 7, info: "Supplementary motor area — internally-driven movement sequencing." },
    { id: "premotor", label: "Premotor cortex",   system: "motor",         layer: 7, info: "Movement preparation guided by sensory context." },
    { id: "basal",    label: "Basal ganglia",     system: "subcortical",   layer: 7, info: "Striatum/GP — action selection via the cortico-basal-thalamic loop." },
    { id: "cerebellum",label:"Cerebellum",        system: "subcortical",   layer: 7, info: "Coordination, timing, motor learning via the cortico-ponto-cerebellar loop." },
    { id: "vlthal",   label: "VA/VL (motor thal.)",system:"subcortical",   layer: 7, info: "Motor thalamus — relays basal ganglia & cerebellar output back to cortex." },

    // --- Layer 8: primary motor ---
    { id: "m1",       label: "M1 (primary motor)",system: "motor",         layer: 8, info: "Primary motor cortex, precentral gyrus — origin of the corticospinal tract." },

    // --- Layer 9: output ---
    { id: "brainstem",label: "Brainstem",         system: "motor",         layer: 9, info: "Cranial nerve nuclei & corticospinal passage toward the cord." },
    { id: "spinal",   label: "Spinal cord",       system: "motor",         layer: 9, info: "Final common pathway to the muscles." },
  ];

  const EDGES = [
    // Visual pathway (feedforward)
    { source: "retina", target: "lgn",  tract: "Optic nerve / tract",  kind: "feedforward" },
    { source: "lgn",    target: "v1",   tract: "Optic radiation",      kind: "feedforward" },
    { source: "v1",     target: "v2v4", tract: "Ventral stream",       kind: "feedforward" },
    { source: "v1",     target: "mt",   tract: "Dorsal stream",        kind: "feedforward" },
    { source: "v2v4",   target: "itc",  tract: "Inferior long. fasc.", kind: "feedforward", info: "'What' pathway → object recognition." },
    { source: "mt",     target: "ppc",  tract: "Sup. long. fasc.",     kind: "feedforward", info: "'Where/how' pathway → spatial vision." },
    { source: "itc",    target: "v2v4", tract: "Cortico-cortical",     kind: "feedback",    info: "Top-down attention/expectation." },

    // Auditory & language
    { source: "cochlea",target: "mgn",  tract: "Auditory (VIII) nerve",kind: "feedforward" },
    { source: "mgn",    target: "a1",   tract: "Acoustic radiation",   kind: "feedforward" },
    { source: "a1",     target: "stg",  tract: "Cortico-cortical",     kind: "feedforward" },
    { source: "stg",    target: "broca",tract: "Arcuate fasciculus",   kind: "feedforward", info: "The classic language loop: comprehension → production." },
    { source: "stg",    target: "angular",tract:"Middle long. fasc.",  kind: "feedforward" },
    { source: "angular",target: "broca",tract: "Sup. long. fasc.",     kind: "feedforward" },

    // Somatosensory
    { source: "body",   target: "vpl",  tract: "Medial lemniscus",     kind: "feedforward" },
    { source: "vpl",    target: "s1",   tract: "Thalamocortical",      kind: "feedforward" },
    { source: "s1",     target: "s2",   tract: "Cortico-cortical",     kind: "feedforward" },
    { source: "s2",     target: "ppc",  tract: "Sup. long. fasc.",     kind: "feedforward" },

    // Olfactory (note: bypasses thalamus)
    { source: "nose",    target: "olfbulb",  tract: "Olfactory nerve (I)", kind: "feedforward" },
    { source: "olfbulb", target: "piriform", tract: "Lateral olfactory tract", kind: "feedforward" },
    { source: "piriform",target: "amygdala", tract: "Cortico-limbic",   kind: "feedforward", info: "Smell has a direct line to emotion & memory." },

    // Multimodal → executive
    { source: "itc",    target: "dlpfc",tract: "Inferior fronto-occ. fasc.", kind: "feedforward" },
    { source: "ppc",    target: "dlpfc",tract: "Sup. long. fasc.",     kind: "feedforward" },
    { source: "angular",target: "dlpfc",tract: "Sup. long. fasc.",     kind: "feedforward" },

    // Limbic / memory circuit
    { source: "entorhinal", target: "hippocampus", tract: "Perforant path", kind: "feedforward" },
    { source: "hippocampus",target: "cingulate",   tract: "Fornix (Papez)", kind: "feedforward" },
    { source: "cingulate",  target: "entorhinal",  tract: "Cingulum (Papez)",kind: "feedback", info: "Closes the Papez memory circuit." },
    { source: "ppc",        target: "entorhinal",  tract: "Cingulum",       kind: "feedforward" },
    { source: "amygdala",   target: "vmpfc",       tract: "Uncinate fasc.", kind: "modulatory" },
    { source: "itc",        target: "amygdala",    tract: "Ventral pathway",kind: "feedforward" },
    { source: "hippocampus",target: "dlpfc",       tract: "Cingulum",       kind: "feedforward", info: "Memory informs executive control." },
    { source: "vmpfc",      target: "amygdala",    tract: "Uncinate fasc.", kind: "modulatory", info: "Top-down emotion regulation." },
    { source: "vmpfc",      target: "cingulate",   tract: "Cortico-limbic", kind: "modulatory" },

    // Executive → motor planning
    { source: "dlpfc",   target: "sma",      tract: "Frontal aslant",  kind: "feedforward" },
    { source: "dlpfc",   target: "premotor", tract: "Cortico-cortical",kind: "feedforward" },
    { source: "ppc",     target: "premotor", tract: "Sup. long. fasc.",kind: "feedforward", info: "Parietal guidance of action." },
    { source: "broca",   target: "premotor", tract: "Cortico-cortical",kind: "feedforward", info: "Speech motor planning." },

    // Basal ganglia loop
    { source: "premotor",target: "basal",  tract: "Corticostriatal",  kind: "feedforward" },
    { source: "dlpfc",   target: "basal",  tract: "Corticostriatal",  kind: "feedforward" },
    { source: "basal",   target: "vlthal", tract: "Pallidothalamic",  kind: "feedforward" },
    { source: "vlthal",  target: "premotor",tract:"Thalamocortical",  kind: "feedback", info: "Closes the cortico-basal-ganglia-thalamic loop." },
    { source: "vlthal",  target: "sma",    tract: "Thalamocortical",  kind: "feedback" },

    // Cerebellar loop
    { source: "premotor", target: "cerebellum", tract: "Cortico-pontine", kind: "feedforward" },
    { source: "cerebellum",target:"vlthal",     tract: "Dentatothalamic", kind: "feedforward" },

    // Final motor pathway
    { source: "sma",      target: "m1",        tract: "Cortico-cortical", kind: "feedforward" },
    { source: "premotor", target: "m1",        tract: "Cortico-cortical", kind: "feedforward" },
    { source: "m1",       target: "brainstem", tract: "Corticospinal (pyramidal)", kind: "feedforward" },
    { source: "brainstem",target: "spinal",    tract: "Corticospinal (pyramidal)", kind: "feedforward" },
    { source: "cerebellum",target:"brainstem", tract: "Cerebellar peduncles", kind: "feedforward" },
  ];

  global.BRAIN = { SYSTEMS, LAYERS, NODES, EDGES };
})(typeof window !== "undefined" ? window : globalThis);
