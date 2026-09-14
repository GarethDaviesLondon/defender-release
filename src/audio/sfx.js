// Sound, synthesised at runtime. No files, no loading, no cold-cache delay
// (functional spec, section 14).
//
// Two browser facts shape this module. An AudioContext created before a user
// gesture starts suspended, so nothing is built until the first key press.
// And localStorage throws outright in some privacy modes rather than returning
// null, so every access is wrapped: a browser that refuses to remember the mute
// setting should still play the game.

const STORAGE_KEY = 'defender.muted';

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // A browser that blocks storage is not a reason to stop the game.
  }
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = readMuted();
  let thrustNode = null;
  let thrustGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (ctx) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.35;
    master.connect(ctx.destination);
    return true;
  }

  function now() {
    return ctx.currentTime;
  }

  function noiseBuffer(seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone(type, from, to, duration, gain = 0.5) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now());
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now() + duration);
    g.gain.setValueAtTime(gain, now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + duration);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(now() + duration + 0.02);
  }

  function noise(duration, cutoffFrom, cutoffTo, gain = 0.6) {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffFrom, now());
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, cutoffTo),
      now() + duration,
    );
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + duration);
    src.connect(filter).connect(g).connect(master);
    src.start();
    src.stop(now() + duration);
  }

  function arpeggio(notes, step, type = 'square', gain = 0.35) {
    if (!ensure()) return;
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const t = now() + i * step;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + step * 1.8);
    });
  }

  return {
    get muted() {
      return muted;
    },

    /** Called on the first key press. Before this, nothing sounds. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },

    toggleMute() {
      muted = !muted;
      writeMuted(muted);
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },

    laser() {
      tone('square', 1400, 180, 0.08, 0.32);
    },

    explosion(big = false) {
      noise(big ? 0.6 : 0.35, big ? 2400 : 1600, 60, big ? 0.8 : 0.5);
    },

    smartBomb() {
      noise(0.9, 4000, 40, 0.9);
      tone('sawtooth', 300, 30, 0.9, 0.3);
    },

    rescued() {
      arpeggio([523, 659, 784, 1046], 0.07);
    },

    extraLife() {
      arpeggio([659, 880, 1318], 0.11, 'triangle', 0.4);
    },

    mutation() {
      tone('sawtooth', 180, 70, 0.5, 0.4);
      tone('sawtooth', 186, 74, 0.5, 0.4);
    },

    planetDeath() {
      noise(1.6, 6000, 30, 1.0);
      tone('sawtooth', 220, 18, 1.6, 0.5);
    },


    /** Thrust is a held sound, so it is a persistent node whose gain follows
     *  the key rather than a one-shot retriggered every frame. */
    setThrust(on) {
      if (!ensure()) return;
      if (on && !thrustNode) {
        thrustNode = ctx.createBufferSource();
        thrustNode.buffer = noiseBuffer(2);
        thrustNode.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 320;
        thrustGain = ctx.createGain();
        thrustGain.gain.value = 0;
        thrustNode.connect(filter).connect(thrustGain).connect(master);
        thrustNode.start();
      }
      if (thrustGain) {
        thrustGain.gain.setTargetAtTime(on ? 0.18 : 0, now(), 0.05);
      }
    },

    /** The abduction siren: on while any Lander is carrying a humanoid. It is
     *  the one sound that tells the player to look at the scanner. */
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 3.5;
        lfoGain.gain.value = 180;
        sirenOsc.frequency.value = 620;
        lfo.connect(lfoGain).connect(sirenOsc.frequency);
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        lfo.start();
      }
      if (sirenGain) {
        sirenGain.gain.setTargetAtTime(on ? 0.1 : 0, now(), 0.08);
      }
    },
  };
}
