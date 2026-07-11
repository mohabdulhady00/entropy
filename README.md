# ENTROPY — A Surreal Physics Playground

> **Scroll to increase disorder.** A dream-logic descent through the states of matter, where the scrollbar is an entropy slider and the whole world deconstructs as you go.

Real-time WebGL + physics. No pre-rendered video, no image assets — every frame is generative and interactive.

## The descent

| Phase | State | Mechanic |
|------|-------|----------|
| 00 · **CRYSTAL** | solid / order | Faceted crystalline form, rigid type, still |
| 01 · **FRACTURE** | kinetic | Scroll velocity shatters the form into **Cannon-es rigid bodies** that fall & collide |
| 02 · **MELT** | liquid | A WebGL shader liquefies the surface — flowing noise displacement, gravity drip |
| 03 · **VAPOR** | gas | Mesh disperses into ~18k additive particles; the words detach and drift off like smoke |
| 04 · **THE TURN** | gravity = 90° | The camera rolls 90° and the layout tilts — the world becomes a side-scroller, debris falls sideways |
| 05 · **SINGULARITY** | reform | Everything collapses to a point and reforms → final CTA |

The accent colour sweeps its hue (lime → cyan → blue → magenta → pink) in lock-step with disorder.

## Stack

- **Three.js** (r160) — renderer, morphing form (custom GLSL), particle dispersal, instanced fragments
- **cannon-es** — real rigid-body physics with steerable gravity for THE TURN
- **GSAP + ScrollTrigger** — text reveals, smoke drift, the turn tilt
- **Lenis** — buttery smooth scroll, single source of truth for the "disorder" value
- Loaded via native ES-module import map from jsDelivr — no build step.

## Run locally

```bash
py -m http.server 8096 --directory entropy
# open http://localhost:8096
```

(Any static server works — it just needs http:// for ES modules + import maps.)

## Files

```
index.html        structure, import map, phase sections
css/style.css     art direction, typography, responsive, reduced-motion
js/main.js        orchestrator — Lenis, GSAP, the entropy state machine, render loop
js/scene.js       Three.js scene — background pass, form, particles, fragments
js/physics.js     cannon-es fragment simulation + gravity control
js/shaders.js     GLSL — simplex noise, background fluid, form melt, particle
```

## Performance

- 2 draw calls, ~8.8k triangles. Cost is in the fullscreen fluid fragment shader (tuned to 3 fbm octaves).
- Mobile: particle count and device-pixel-ratio are automatically reduced; `prefers-reduced-motion` disables smooth scroll and scrub tweens.

## Optional: dropping in Higgsfield / Seedance video

The site is complete without any video. If you want to layer generated footage (e.g. an
intro loop or a texture on the background plane), generate a **seamless loop** with one of the
prompts in [`assets/SEEDANCE_PROMPTS.md`](assets/SEEDANCE_PROMPTS.md), drop the `.mp4` into
`/assets`, and it can be wired as a `THREE.VideoTexture` overlay.
