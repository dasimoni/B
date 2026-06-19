# Working agreement

These are standing instructions from the repository owner for any Claude Code
session in this repo.

## Branch & commit workflow
- **Always work directly on `main`.** Do not create or switch to feature
  branches unless explicitly asked.
- **Always commit to `main` automatically** after completing a set of changes —
  the user should not have to ask each time. Use clear, descriptive commit
  messages.
- **Always push** to `origin main` after committing (with retry/backoff on
  network errors).
- Do **not** open pull requests unless explicitly requested.

## Project
A visualization of how the brain is connected, "completely unfolded and
organized." Two views, selected from the landing page `index.html`:
- `block/` — **The Unfolded Brain**: abstract layered schematic of the
  functional hierarchy with named white-matter tracts.
- `fiber/` — **Brain Fiber Circuit**: anatomically real nerves from the sense
  organs inward, line thickness = measured fiber count.
- `shared/layout.js` — layered layout engine shared by both views.

### Data integrity rule (fiber circuit)
Cited counts only: only draw a fiber count when it has a measured histological
source (recorded in `CITATIONS`). Anything unmeasured is drawn thin/dashed and
labeled "not measured" — never guess a number.
