# Toilet Flush Mechanism — Bernoulli & Continuity Demo

Interactive 3-part simulation of a gravity-flush toilet, now built purely on
Bernoulli's equation (head form) + the continuity equation — incompressible,
inviscid, steady flow. No build step, no dependencies besides KaTeX (via CDN,
for the rendered equations) and Google Fonts.

## File layout

**`index.html` is now fully self-contained** — all six modules
(`config/utils/physics/renderers/ui/main`) are inlined into one `<script>`
block at the bottom of the page, in dependency order. This was a deliberate
fix: the previous version loaded them as six separate `<script src="js/...">`
tags, and if that `js/` folder ever goes missing, gets renamed, or has a
path/case mismatch on deploy, every one of those tags fails silently — the
page still renders (HTML/CSS are unaffected) but `state` and all the
render/physics functions come back `undefined`, so the sliders look inert
and the diagrams stay blank. Inlining removes that whole failure class.

The original six files are still included below for reference/editing — if
you change one, re-paste it into the inline `<script>` block in `index.html`
(same order: config, utils, physics, renderers, ui, main) rather than
re-linking them externally, unless you've confirmed your host serves the
`js/` folder correctly.

```
index.html      - self-contained: HTML + CSS link + one inlined <script>
style.css
js/
  config.js     - constants + shared state (H, dValve, dTank, g)
  utils.js      - clamp / lerp / fmt / lerpColor
  physics.js    - compute(state) -> Bernoulli + continuity solution
  renderers.js  - renderPart1/2/3(d, state) -> SVG strings
  ui.js         - slider/preset/flush-button wiring + readouts
  main.js       - bootstraps everything, renders the KaTeX derivation
```

## Run it locally

Just open `index.html` directly — no server needed anymore, since there
are no external script files to fetch (KaTeX still loads from a CDN for
the derivation panel, with a plain-text fallback if that's blocked).

## Push to GitHub + deploy with GitHub Pages

```bash
git init
git add .
git commit -m "Bernoulli + continuity toilet flush demo"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then **Settings → Pages → Source → Deploy from a branch → `main` / root**.
Site goes live at `https://<your-username>.github.io/<repo-name>/`.

## Physics model (`js/physics.js`)

Between the free surface (1) and the valve exit (2), both open to the
atmosphere (P1 = P2 = 0 gauge), with the datum z2 = 0 at the valve:

**Bernoulli, head form:**
```
P1/pg + v1^2/2g + z1 = P2/pg + v2^2/2g + z2
```

**Continuity (mass flow rate), rho1 = rho2:**
```
A1 v1 = A2 v2  =>  v1 = (A2/A1) v2 = beta * v2,   beta = (d_valve / d_tank)^2
```

**Substituting and solving for v2:**
```
v1^2 + 2g z1 = v2^2
(beta v2)^2 + 2g z1 = v2^2
v2 = sqrt( 2 g z1 / (1 - beta^2) )
```

No discharge coefficient, viscosity, or rim-hole losses — this is the
idealized head-form result, matching the assumptions boxed in the
derivation (incompressible / inviscid / steady).

**Synthesis (Part 3):**
- Flush volume `Vtank = 0.12m x 0.50m x z1` (the fixed 12x50cm tank footprint)
- Flush time `t_flush = Vtank / Q`
- Success requires both `Q > 1.0 L/s` and `t_flush < 8s` — tune these two
  constants in `physics.js` (`QOK`, `tOK`) if you want stricter/looser
  pass/fail behavior.

## Sliders

- **z1 = H** — tank water level (cm)
- **g** — gravity, with Moon/Mars/Earth/Jupiter presets
- **d_tank** — A1's diameter (mm)
- **d_valve** — A2's diameter (mm)

## Extending it

- Add a real time-varying drain (z1 decreasing as the tank empties, i.e.
  actually integrating dz1/dt = -Q(z1)/A_tank) for a true transient
  simulation instead of the current quasi-steady snapshot.
- The observation callout in Part 1 ("v1, v2 converge as z1 -> 0") could be
  turned into a small live plot of v1(t) and v2(t) during an actual drain.
- `renderPart2`'s converging-duct diagram and area-ratio bars are self
  contained in `renderers.js` — easy to restyle without touching physics.
