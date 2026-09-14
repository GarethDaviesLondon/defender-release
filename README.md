# Defender

A browser-based homage to the 1980 Williams arcade game *Defender*.

**Play it: <https://garethdavieslondon.github.io/defender-release/>**

You fly a ship over a planet that wraps around on itself, and aliens are carrying
off the humanoids walking on the ground. Let them all go and the planet explodes,
the ground goes barren, and every alien left turns into something faster and
angrier for the rest of the game.

HTML5 Canvas and vanilla ES modules. No framework, no bundler, no build step, no
images and no sound files: every shape is drawn from code and every sound is
synthesised at runtime, so the whole payload is the source.

## Controls

| Action | Keys |
| ------ | ---- |
| Turn and thrust | `Left Arrow`, `Right Arrow` |
| Thrust, whichever way you face | `Z` |
| Reverse and flip | `X` |
| Climb and dive | `Q` / `A`, or `Up` / `Down` |
| Fire | `Space`, `Ctrl` |
| Smart bomb | `S`, `Shift` |
| Hyperspace | `H` |
| Pause, mute | `P`, `M` |

Three things worth knowing before your first wave.

**There is no brake.** Horizontal movement has inertia, so pressing the other
arrow does not stop you: it turns you round and thrusts against your drift, and
you slide for a while before it wins. Turning is also how you shoot behind you.

**The scanner is the game.** You can only see a sixth of the world at a time. The
strip along the top shows all of it: your ship in white, humanoids in cyan,
Landers in green, Mutants in red. Points come from shooting, but games are lost
by not looking up there.

**Shoot the Lander, then catch what it drops.** A Lander that reaches the top of
the screen with a humanoid eats it and becomes a Mutant. Shoot the Lander and the
humanoid falls; fly into it to catch it, then carry it down to the ground.

Hyperspace gets you out of trouble, and kills you about one time in six.

## Running it locally

ES modules need an HTTP origin, so serve this directory rather than opening
`index.html` from the filesystem:

```
python -m http.server 8000        # then http://127.0.0.1:8000/
```

## About this repository

This is the published build: `index.html` and `src/`, and nothing else. It is
generated from a separate development repository that holds the functional
specification, the test suite and the working method. Fixes are made there and
released here, so pull requests against this repository cannot be merged
directly.
