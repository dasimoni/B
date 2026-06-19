/*
 * anatomyData.js — "The Unfolded Nervous System"
 * ----------------------------------------------
 * Describes the brain as if the nervous system were peeled open and laid flat:
 * two continuous cortical sheets (hemispheres) whose areas are adjoining
 * patches — continuous, as in real cortex — plus the sense organs teased out
 * around the edge and the actual wiring that connects them:
 *
 *   - sensory cables from each organ to its target cortical area (via relays)
 *   - the optic chiasm and thalamic relays (LGN, MGN, VPL/VPM)
 *   - the corpus callosum between the hemispheres
 *   - cortico-cortical (feed-forward) fibers from area to area
 *   - feedback fibers running back from higher to lower areas
 *
 * Geometry: each hemisphere is a 360×360 local box, partitioned into adjoining
 * rectangular area patches (they tile the box exactly, so borders are shared —
 * continuous cortex). The box is clipped to an ellipse so the outline looks
 * like an organic sheet. The right hemisphere mirrors the left.
 */

(function (global) {
  "use strict";

  const SYSTEMS = {
    visual:        { name: "Vision",        color: "#5B8FF9" },
    auditory:      { name: "Hearing",       color: "#5AD8A6" },
    somatosensory: { name: "Touch / body",  color: "#5D7092" },
    olfactory:     { name: "Smell",         color: "#9270CA" },
    gustatory:     { name: "Taste",         color: "#F08BB4" },
    motor:         { name: "Motor",         color: "#FF9D4D" },
    executive:     { name: "Prefrontal",    color: "#6DC8EC" },
    limbic:        { name: "Limbic",        color: "#E8684A" },
    language:      { name: "Language",      color: "#F6BD16" },
  };

  // Distinct visual styling for the kinds of wiring.
  const WIRE_KINDS = {
    afferent: { name: "Sensory input",    color: null,      dash: null },
    relay:    { name: "Thalamic relay",   color: null,      dash: null },
    cortico:  { name: "Cortico-cortical",  color: "#aeb8c4", dash: null },
    feedback: { name: "Feedback fibers",   color: "#cd7fe0", dash: "5,5" },
    callosum: { name: "Corpus callosum",   color: "#36CFC9", dash: null },
    motor:    { name: "Motor output",      color: "#FF9D4D", dash: null },
  };

  // Each hemisphere is a 360×360 local box at (ox,oy); right one is mirrored.
  const HEMIS = [
    { side: "L", ox: 175, oy: 120, mirror: false },
    { side: "R", ox: 965, oy: 120, mirror: true },
  ];

  // Adjoining cortical area patches (local coords; they tile the box exactly).
  // Columns: 0-120 | 120-200 | 200-260 | 260-320 | 320-360 (anterior→posterior,
  // i.e. outer/lateral → inner/medial toward the midline & corpus callosum).
  const AREA_DEFS = [
    { id: "prefrontal", label: "Prefrontal",      short: "PFC",   system: "executive",     x: 0,   y: 0,   w: 120, h: 180 },
    { id: "ofc",        label: "OFC / limbic",    short: "OFC",   system: "limbic",        x: 0,   y: 180, w: 120, h: 180 },
    { id: "premotor",   label: "Premotor / SMA",  short: "PM",    system: "motor",         x: 120, y: 0,   w: 80,  h: 120 },
    { id: "broca",      label: "Broca / insula (taste)", short: "Broca", system: "language", x: 120, y: 120, w: 80, h: 110 },
    { id: "tpole",      label: "Temporal pole (smell)",  short: "T-pole", system: "olfactory", x: 120, y: 230, w: 80, h: 130 },
    { id: "m1",         label: "M1 — primary motor",     short: "M1",  system: "motor",         x: 200, y: 0,   w: 60,  h: 150 },
    { id: "a1",         label: "A1 — primary auditory",  short: "A1",  system: "auditory",      x: 200, y: 150, w: 60,  h: 100 },
    { id: "tassoc",     label: "Temporal assoc. (Wernicke)", short: "Wern.", system: "auditory", x: 200, y: 250, w: 60, h: 110 },
    { id: "s1",         label: "S1 — primary somatosensory", short: "S1",  system: "somatosensory", x: 260, y: 0, w: 60, h: 150 },
    { id: "parietal",   label: "Parietal assoc.",        short: "Par.", system: "somatosensory", x: 260, y: 150, w: 60, h: 100 },
    { id: "mt",         label: "MT / occipito-temporal", short: "MT",  system: "visual",        x: 260, y: 250, w: 60,  h: 110 },
    { id: "ppc",        label: "PPC — posterior parietal", short: "PPC", system: "somatosensory", x: 320, y: 0, w: 40, h: 150 },
    { id: "v2v4",       label: "V2 / V4 — visual assoc.",  short: "V2", system: "visual",        x: 320, y: 150, w: 40,  h: 100 },
    { id: "v1",         label: "V1 — primary visual",      short: "V1", system: "visual",        x: 320, y: 250, w: 40,  h: 110 },
  ];

  // Subcortical relays & midline structures (absolute screen coords).
  const RELAYS = [
    { id: "lgnL", label: "LGN",   x: 612, y: 590 },
    { id: "lgnR", label: "LGN",   x: 888, y: 590 },
    { id: "mgnL", label: "MGN",   x: 565, y: 560 },
    { id: "mgnR", label: "MGN",   x: 935, y: 560 },
    { id: "vplL", label: "VPL/VPM", x: 665, y: 560 },
    { id: "vplR", label: "VPL/VPM", x: 835, y: 560 },
    { id: "chiasm", label: "Optic chiasm", x: 750, y: 660 },
    { id: "olfL", label: "Olf. bulb", x: 695, y: 700 },
    { id: "olfR", label: "Olf. bulb", x: 805, y: 700 },
    { id: "nts",  label: "NTS (taste)", x: 690, y: 730 },
    { id: "brainstem", label: "Brainstem", x: 750, y: 760 },
    { id: "spinal", label: "Spinal cord", x: 750, y: 880 },
  ];

  // Sense organs & body, teased out around the edge (emoji icons).
  const ORGANS = [
    { id: "eyeL",   label: "Left eye",  icon: "👁️", x: 675, y: 985 },
    { id: "eyeR",   label: "Right eye", icon: "👁️", x: 825, y: 985 },
    { id: "earL",   label: "Left ear",  icon: "👂", x: 120, y: 470 },
    { id: "earR",   label: "Right ear", icon: "👂", x: 1380, y: 470 },
    { id: "nose",   label: "Nose",      icon: "👃", x: 968, y: 985 },
    { id: "tongue", label: "Tongue",    icon: "👅", x: 532, y: 985 },
    { id: "body",   label: "Body / skin", icon: "🖐️", x: 750, y: 1015 },
  ];

  const CITATIONS = {
    optic:        { text: "Jonas et al. 1990 — human optic nerve axon count (~0.97M, range 0.69–1.69M)", url: "https://pubmed.ncbi.nlm.nih.gov/2780002/" },
    cochlear:     { text: "Spoendlin & Schrott 1989 — human auditory nerve (~30,000–35,000 fibers)", url: "https://pubmed.ncbi.nlm.nih.gov/2613564/" },
    olfactory:    { text: "StatPearls, Cranial Nerve I — ~6–10 million olfactory sensory neurons / side", url: "https://www.ncbi.nlm.nih.gov/books/NBK556051/" },
    callosum:     { text: "Aboitiz et al. 1992 — human corpus callosum (~200 million axons)", url: "https://pubmed.ncbi.nlm.nih.gov/1486477/" },
    corticospinal:{ text: "Lassek 1940 — human pyramidal tract (~1,000,000 fibers)", url: "" },
  };

  // ---- Wiring ----------------------------------------------------------
  // Endpoint refs: an organ id, a relay id, or "areaId:Side" (e.g. "v1:L").

  // Sensory inputs from organs through relays to cortex.
  const SENSORY = [
    // Vision — partial decussation through the optic chiasm
    { from: "eyeL", to: "lgnL", kind: "afferent", system: "visual", tract: "Optic nerve (uncrossed half)", fibers: 1000000, fiberLabel: "~1,000,000 / eye", ref: "optic" },
    { from: "eyeL", to: "chiasm", kind: "afferent", system: "visual", tract: "Optic nerve (nasal half → crosses)" },
    { from: "chiasm", to: "lgnR", kind: "afferent", system: "visual", tract: "Optic tract (crossed)" },
    { from: "eyeR", to: "lgnR", kind: "afferent", system: "visual", tract: "Optic nerve (uncrossed half)", fibers: 1000000, fiberLabel: "~1,000,000 / eye", ref: "optic" },
    { from: "eyeR", to: "chiasm", kind: "afferent", system: "visual", tract: "Optic nerve (nasal half → crosses)" },
    { from: "chiasm", to: "lgnL", kind: "afferent", system: "visual", tract: "Optic tract (crossed)" },
    { from: "lgnL", to: "v1:L", kind: "relay", system: "visual", tract: "Optic radiation" },
    { from: "lgnR", to: "v1:R", kind: "relay", system: "visual", tract: "Optic radiation" },

    // Hearing
    { from: "earL", to: "mgnL", kind: "afferent", system: "auditory", tract: "Cochlear nerve → brainstem → MGN", fibers: 31000, fiberLabel: "~30–35k / ear", ref: "cochlear" },
    { from: "earR", to: "mgnR", kind: "afferent", system: "auditory", tract: "Cochlear nerve → brainstem → MGN", fibers: 31000, fiberLabel: "~30–35k / ear", ref: "cochlear" },
    { from: "mgnL", to: "a1:L", kind: "relay", system: "auditory", tract: "Acoustic radiation" },
    { from: "mgnR", to: "a1:R", kind: "relay", system: "auditory", tract: "Acoustic radiation" },

    // Touch / body
    { from: "body", to: "spinal", kind: "afferent", system: "somatosensory", tract: "Dorsal roots → spinal cord" },
    { from: "spinal", to: "vplL", kind: "afferent", system: "somatosensory", tract: "Dorsal columns / medial lemniscus" },
    { from: "spinal", to: "vplR", kind: "afferent", system: "somatosensory", tract: "Dorsal columns / medial lemniscus" },
    { from: "vplL", to: "s1:L", kind: "relay", system: "somatosensory", tract: "Thalamocortical radiation" },
    { from: "vplR", to: "s1:R", kind: "relay", system: "somatosensory", tract: "Thalamocortical radiation" },

    // Smell — bypasses the thalamus
    { from: "nose", to: "olfL", kind: "afferent", system: "olfactory", tract: "Olfactory nerve (CN I)", fibers: 7000000, fiberLabel: "~6–10M / side", ref: "olfactory" },
    { from: "nose", to: "olfR", kind: "afferent", system: "olfactory", tract: "Olfactory nerve (CN I)", fibers: 7000000, fiberLabel: "~6–10M / side", ref: "olfactory" },
    { from: "olfL", to: "tpole:L", kind: "relay", system: "olfactory", tract: "Lateral olfactory tract (no thalamus)" },
    { from: "olfR", to: "tpole:R", kind: "relay", system: "olfactory", tract: "Lateral olfactory tract (no thalamus)" },

    // Taste
    { from: "tongue", to: "nts", kind: "afferent", system: "gustatory", tract: "Facial / glossopharyngeal nerves" },
    { from: "nts", to: "vplL", kind: "afferent", system: "gustatory", tract: "→ VPM (thalamus)" },
    { from: "vplL", to: "broca:L", kind: "relay", system: "gustatory", tract: "→ gustatory cortex (insula)" },
  ];

  // Motor output
  const MOTOR = [
    { from: "m1:L", to: "brainstem", kind: "motor", system: "motor", tract: "Corticospinal tract", fibers: 1000000, fiberLabel: "~1,000,000", ref: "corticospinal" },
    { from: "m1:R", to: "brainstem", kind: "motor", system: "motor", tract: "Corticospinal tract", fibers: 1000000, fiberLabel: "~1,000,000", ref: "corticospinal" },
    { from: "brainstem", to: "spinal", kind: "motor", system: "motor", tract: "Corticospinal (descends & crosses)" },
    { from: "spinal", to: "body", kind: "motor", system: "motor", tract: "Motor nerves → muscles" },
  ];

  // Cortico-cortical feed-forward (area→area); expanded to both hemispheres.
  const CORTICO_PAIRS = [
    ["v1", "v2v4", "→ visual assoc."], ["v2v4", "mt", "ventral/dorsal"], ["v1", "ppc", "dorsal 'where'"],
    ["v2v4", "tassoc", "ventral 'what'"], ["a1", "tassoc", "→ Wernicke"], ["tassoc", "broca", "arcuate fasciculus"],
    ["s1", "parietal", ""], ["parietal", "ppc", ""], ["ppc", "premotor", "parietal → motor"],
    ["parietal", "prefrontal", ""], ["tassoc", "prefrontal", ""], ["mt", "parietal", ""],
    ["prefrontal", "premotor", ""], ["premotor", "m1", ""], ["broca", "premotor", "speech motor"],
    ["tpole", "prefrontal", ""],
  ];

  // Feedback fibers (higher → lower); expanded to both hemispheres.
  const FEEDBACK_PAIRS = [
    ["prefrontal", "v2v4", "top-down attention"], ["ppc", "v1", ""], ["tassoc", "v1", ""],
    ["prefrontal", "tassoc", ""], ["parietal", "s1", ""], ["premotor", "ppc", ""], ["mt", "v1", ""],
  ];

  // Corpus callosum: homologous areas joined across the midline.
  const CALLOSUM_AREAS = ["v1", "v2v4", "ppc", "parietal", "s1", "m1", "premotor", "tassoc", "prefrontal"];

  global.ANATOMY = {
    SYSTEMS, WIRE_KINDS, HEMIS, AREA_DEFS, RELAYS, ORGANS, CITATIONS,
    SENSORY, MOTOR, CORTICO_PAIRS, FEEDBACK_PAIRS, CALLOSUM_AREAS,
  };
})(typeof window !== "undefined" ? window : globalThis);
