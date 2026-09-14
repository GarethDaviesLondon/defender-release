// Explosions: short-lived line segments flying outward with drag.
//
// No sprites and no texture. An explosion is 12 to 24 fragments that shoot out,
// slow down and fade, which is cheap to draw and reads at a glance on a crowded
// screen (functional spec, section 13).
//
// Pure data. The drawing lives in the renderer.

import { wrapX } from '../core/world.js';

const DRAG = 1.8;

export function createBurst(x, y, rng, colour, count = 16, speed = 220) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const v = speed * (0.35 + rng.next());
    parts.push({
      x: wrapX(x),
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: rng.range(0.25, 0.7),
      maxLife: 0.7,
      colour,
      dead: false,
    });
  }
  return parts;
}

export function updateParticle(p, dt) {
  const decay = Math.exp(-DRAG * dt);
  p.vx *= decay;
  p.vy *= decay;
  p.x = wrapX(p.x + p.vx * dt);
  p.y += p.vy * dt;
  p.life -= dt;
  if (p.life <= 0) p.dead = true;
}
