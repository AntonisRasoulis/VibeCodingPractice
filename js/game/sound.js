// Sound effects. Every sound is made on the spot by the browser's built-in
// synthesizer (Web Audio), so there are no sound files to download.
//   Sound.unlock()        call from a click or key press (browsers only allow sound after one)
//   Sound.play("jump")    play one of the effects below
//   Sound.setFire(0..1)   how loud the fire's roar is (0 = silent)
//   Sound.toggleMute()    sound on/off (remembered by the browser)

const Sound = (() => {
  let ac = null;       // the audio context, made on the first click or key press
  let master = null;   // everything goes through here (volume + mute)
  let noiseBuffer = null;
  let fire = null;     // the fire's never-ending roar
  let fireLevel = 0;
  let crackleTimer = 0;
  let muted = false;
  const lastPlayed = {};

  const VOLUME = 0.5;

  try { muted = localStorage.getItem("fire-run-muted") === "1"; } catch (e) { /* storage blocked */ }

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      const squash = ac.createDynamicsCompressor(); // keeps lots of sounds at once from getting too loud
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(squash);
      squash.connect(ac.destination);
      // Two seconds of static, used for whooshes, booms and the fire
      noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      startFire();
    }
    if (ac.state === "suspended") ac.resume();
  }

  // ---- Building blocks ----

  // A note that can slide from one pitch to another: tone({ f: 440, to: 880, dur: 0.2 })
  function tone({ f, to = f, dur = 0.15, type = "square", vol = 0.2, at = 0, attack = 0.005, vibrato = 0 }) {
    const t = ac.currentTime + at;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (to !== f) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    if (vibrato) {
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.value = 9;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    }
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A burst of static through a filter that can sweep: noise({ filter: "bandpass", f: 500, to: 3000 })
  function noise({ f = 1000, to = f, dur = 0.2, filter = "lowpass", q = 1, vol = 0.3, at = 0, attack = 0.005 }) {
    const t = ac.currentTime + at;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filt = ac.createBiquadFilter();
    filt.type = filter;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f, t);
    if (to !== f) filt.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(gain).connect(master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  // A few notes one after another
  function notes(freqs, { gap = 0.08, dur = 0.12, type = "square", vol = 0.15, at = 0 } = {}) {
    freqs.forEach((f, i) => tone({ f, dur, type, vol, at: at + i * gap }));
  }

  // ---- The fire: low rumble plus random crackles, louder the closer it is ----

  function startFire() {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const low = ac.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 500;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(low).connect(gain).connect(master);
    src.start();
    fire = { gain, low };
  }

  function setFire(level, dt = 0) {
    if (!Number.isFinite(level)) level = 0;
    fireLevel = level;
    if (!ac || !fire) return;
    const t = ac.currentTime;
    fire.gain.gain.setTargetAtTime(level * 0.5, t, 0.1);
    fire.low.frequency.setTargetAtTime(350 + level * 900, t, 0.1);
    // Pops and crackles, more of them as it gets close
    crackleTimer -= dt;
    if (level > 0 && crackleTimer <= 0) {
      crackleTimer = 0.03 + Math.random() * (0.35 - level * 0.28);
      noise({ filter: "bandpass", f: 1500 + Math.random() * 2500, q: 3, dur: 0.03 + Math.random() * 0.04, vol: 0.08 + level * 0.25 });
    }
  }

  // ---- Every sound in the game ----

  const EFFECTS = {
    // Countdown and the end of a race
    beep: () => tone({ f: 440, dur: 0.15, vol: 0.15 }),
    go: () => { tone({ f: 880, dur: 0.35, vol: 0.18 }); tone({ f: 1320, dur: 0.35, vol: 0.08 }); },
    win: () => notes([523, 659, 784, 1047, 784, 1047], { gap: 0.11, dur: 0.18, vol: 0.14, at: 0.5 }),
    draw: () => notes([523, 440, 349], { gap: 0.18, dur: 0.25, vol: 0.12, at: 0.5 }),
    caught: () => { // swallowed by the fire
      noise({ filter: "lowpass", f: 300, to: 3000, dur: 0.9, vol: 0.6, attack: 0.05 });
      tone({ f: 300, to: 60, dur: 0.8, type: "sawtooth", vol: 0.15 });
    },

    // Running and jumping
    jump: () => tone({ f: 280, to: 560, dur: 0.1, vol: 0.08 }),
    land: () => noise({ f: 400, dur: 0.07, vol: 0.4 }),
    die: () => { // spikes, maces, shooter spikes, pits
      tone({ f: 500, to: 70, dur: 0.35, vol: 0.14 });
      noise({ f: 2000, to: 300, dur: 0.15, vol: 0.2 });
    },
    respawn: () => notes([392, 523, 659], { gap: 0.05, dur: 0.08, type: "triangle", vol: 0.15 }),
    portal: () => { tone({ f: 200, to: 1400, dur: 0.35, type: "sine", vol: 0.15, vibrato: 40 }); noise({ filter: "bandpass", f: 800, to: 3000, dur: 0.3, vol: 0.08 }); },
    crumble: () => { noise({ f: 250, dur: 0.45, vol: 0.6 }); noise({ filter: "bandpass", f: 900, q: 2, dur: 0.12, vol: 0.3, at: 0.1 }); },

    // Orbs
    swap: () => { tone({ f: 400, to: 1200, dur: 0.18, type: "sine", vol: 0.18 }); tone({ f: 1200, to: 400, dur: 0.18, type: "sine", vol: 0.18, at: 0.16 }); },
    freeze: () => { // icy shimmer
      notes([1568, 2093, 1760, 2349], { gap: 0.05, dur: 0.25, type: "triangle", vol: 0.1 });
      noise({ filter: "highpass", f: 5000, dur: 0.4, vol: 0.12 });
    },
    thaw: () => noise({ filter: "highpass", f: 3000, dur: 0.18, vol: 0.15 }), // the ice cracks off
    dashCharge: () => tone({ f: 150, to: 900, dur: DASH.hold, type: "sawtooth", vol: 0.1, attack: 0.1, vibrato: 15 }),
    dashLaunch: () => { noise({ filter: "bandpass", f: 400, to: 3000, q: 1.5, dur: 0.5, vol: 0.4 }); tone({ f: 200, to: 90, dur: 0.3, type: "sine", vol: 0.2 }); },
    gotZap: () => { tone({ f: 110, dur: 0.18, type: "sawtooth", vol: 0.1 }); noise({ filter: "highpass", f: 4000, dur: 0.15, vol: 0.12 }); tone({ f: 1760, dur: 0.12, type: "sine", vol: 0.1, at: 0.08 }); },
    gotHand: () => [523, 659, 784].forEach((f) => tone({ f, dur: 0.45, type: "sine", vol: 0.08, attack: 0.05, vibrato: 8 })),
    gotWind: () => { noise({ filter: "bandpass", f: 800, to: 2500, q: 2, dur: 0.3, vol: 0.4, attack: 0.05 }); tone({ f: 1319, dur: 0.15, type: "sine", vol: 0.12, at: 0.1 }); },

    // Abilities
    zapFire: () => { tone({ f: 1200, to: 150, dur: 0.3, type: "sawtooth", vol: 0.12 }); noise({ filter: "highpass", f: 3000, dur: 0.25, vol: 0.18 }); },
    zapped: () => { tone({ f: 70, dur: 0.45, type: "sawtooth", vol: 0.18, vibrato: 30 }); noise({ filter: "highpass", f: 2500, dur: 0.35, vol: 0.2 }); },
    handThrow: () => { tone({ f: 300, to: 750, dur: 0.3, type: "sine", vol: 0.12, vibrato: 20 }); noise({ filter: "bandpass", f: 600, to: 1500, q: 2, dur: 0.25, vol: 0.1 }); },
    grab: () => tone({ f: 180, to: 70, dur: 0.15, type: "sine", vol: 0.3 }),
    slam: () => { tone({ f: 140, to: 40, dur: 0.35, type: "sine", vol: 0.4 }); noise({ f: 800, to: 100, dur: 0.3, vol: 0.35 }); },
    windUp: () => noise({ filter: "bandpass", f: 300, to: 1200, q: 2, dur: 0.22, vol: 0.45, attack: 0.15 }),
    smack: () => { noise({ filter: "highpass", f: 1500, dur: 0.1, vol: 0.5 }); tone({ f: 320, to: 120, dur: 0.1, vol: 0.2 }); },
    windDash: () => { noise({ filter: "bandpass", f: 700, to: 3500, q: 1.2, dur: 0.28, vol: 0.4 }); noise({ filter: "highpass", f: 4000, dur: 0.2, vol: 0.08, at: 0.05 }); },

    // Missiles
    glint: () => { tone({ f: 2637, dur: 0.25, type: "sine", vol: 0.1 }); tone({ f: 3951, dur: 0.2, type: "sine", vol: 0.05, at: 0.05 }); },
    incoming: () => tone({ f: 500, to: 1400, dur: MISSILE.approach, type: "sine", vol: 0.08, attack: 0.3 }),
    lockOn: () => notes([1000, 1000, 1000, 1000], { gap: 0.14, dur: 0.07, vol: 0.09 }),
    launch: () => { noise({ filter: "bandpass", f: 300, to: 1500, q: 1, dur: 0.45, vol: 0.35 }); tone({ f: 120, to: 60, dur: 0.3, type: "sawtooth", vol: 0.08 }); },
    boom: () => { noise({ f: 1200, to: 80, dur: 0.8, vol: 0.7 }); tone({ f: 120, to: 35, dur: 0.6, type: "sine", vol: 0.5 }); },

    // Snow
    biome: () => { noise({ filter: "bandpass", f: 500, to: 1500, q: 1, dur: 0.6, vol: 0.15, attack: 0.2 }); notes([784, 1047, 1319], { gap: 0.1, dur: 0.3, type: "triangle", vol: 0.1, at: 0.15 }); },
    iceLand: () => { tone({ f: 2400, dur: 0.08, type: "triangle", vol: 0.06 }); noise({ filter: "highpass", f: 4000, dur: 0.06, vol: 0.12 }); },
    icicleShake: () => notes([2093, 2349, 2093, 2349], { gap: 0.07, dur: 0.06, type: "triangle", vol: 0.06 }),
    icicleShatter: () => { noise({ filter: "highpass", f: 3000, dur: 0.25, vol: 0.3 }); notes([2637, 3136, 2794], { gap: 0.03, dur: 0.1, type: "triangle", vol: 0.06 }); },
    snowball: () => noise({ f: 300, to: 600, dur: 0.5, vol: 0.25, attack: 0.15 }),
    snowballBreak: () => { noise({ f: 1500, to: 300, dur: 0.25, vol: 0.45 }); tone({ f: 160, to: 80, dur: 0.12, type: "sine", vol: 0.15 }); },

    // Desert
    sandSink: () => { noise({ f: 400, to: 150, dur: 0.6, vol: 0.35, attack: 0.05 }); tone({ f: 160, to: 90, dur: 0.5, type: "sine", vol: 0.15 }); },
    sandPull: () => { noise({ filter: "bandpass", f: 500, to: 1200, q: 1.5, dur: 0.15, vol: 0.3 }); tone({ f: 220, to: 330, dur: 0.1, type: "sine", vol: 0.08 }); },
    tumble: () => noise({ filter: "bandpass", f: 2500, to: 1500, q: 2, dur: 0.5, vol: 0.18, attack: 0.1 }),
    tumbleBreak: () => { noise({ filter: "highpass", f: 2000, dur: 0.2, vol: 0.35 }); noise({ f: 600, dur: 0.15, vol: 0.2 }); },

    // Rescue drone
    gotDrone: () => { tone({ f: 660, to: 990, dur: 0.15, type: "square", vol: 0.08 }); tone({ f: 1320, dur: 0.12, type: "sine", vol: 0.08, at: 0.1 }); },
    droneLaunch: () => { tone({ f: 220, to: 440, dur: 0.5, type: "sawtooth", vol: 0.07, vibrato: 60 }); noise({ filter: "bandpass", f: 1800, q: 4, dur: 0.5, vol: 0.12 }); },
    droneGrab: () => { tone({ f: 880, to: 440, dur: 0.12, type: "square", vol: 0.1 }); noise({ filter: "highpass", f: 2500, dur: 0.08, vol: 0.2 }); },
    droneDrop: () => notes([660, 880], { gap: 0.07, dur: 0.1, type: "triangle", vol: 0.1 }),

    // Vultures
    vultureCry: () => { tone({ f: 900, to: 600, dur: 0.35, type: "sawtooth", vol: 0.08, vibrato: 40 }); noise({ filter: "bandpass", f: 2000, q: 3, dur: 0.3, vol: 0.12 }); },
    vultureScreech: () => { tone({ f: 1400, to: 700, dur: 0.45, type: "sawtooth", vol: 0.12, vibrato: 60 }); noise({ filter: "highpass", f: 3000, dur: 0.4, vol: 0.15 }); },

    // Bears
    roar: () => {
      tone({ f: 110, to: 70, dur: 1.1, type: "sawtooth", vol: 0.22, attack: 0.08, vibrato: 18 });
      tone({ f: 165, to: 95, dur: 1.0, type: "sawtooth", vol: 0.12, attack: 0.1, vibrato: 24 });
      noise({ f: 900, to: 250, dur: 1.1, vol: 0.35, attack: 0.1 });
    },
    bearStep: () => { tone({ f: 70, to: 40, dur: 0.12, type: "sine", vol: 0.25 }); noise({ f: 300, dur: 0.08, vol: 0.15 }); },
    maul: () => {
      noise({ filter: "highpass", f: 1200, dur: 0.18, vol: 0.5 });
      tone({ f: 140, to: 60, dur: 0.5, type: "sawtooth", vol: 0.2, vibrato: 20 });
    },
    honey: () => { noise({ f: 700, to: 200, dur: 0.3, vol: 0.4 }); tone({ f: 330, to: 180, dur: 0.35, type: "sine", vol: 0.15, vibrato: 10 }); },
    trample: () => { tone({ f: 150, to: 900, dur: 0.35, type: "square", vol: 0.12 }); noise({ f: 600, dur: 0.12, vol: 0.3 }); },
    grumble: () => tone({ f: 90, to: 60, dur: 0.7, type: "sawtooth", vol: 0.12, attack: 0.1, vibrato: 12 }),

    // Bear traps and bushes
    trapSnap: () => {
      noise({ filter: "highpass", f: 2500, dur: 0.08, vol: 0.6 });
      tone({ f: 1800, to: 900, dur: 0.18, type: "square", vol: 0.1 });
      tone({ f: 2600, dur: 0.25, type: "sine", vol: 0.06, at: 0.02 });
    },
    trapWiggle: () => { noise({ filter: "highpass", f: 2600, dur: 0.05, vol: 0.25 }); tone({ f: 700, to: 500, dur: 0.06, type: "square", vol: 0.05 }); },
    trapOpen: () => { tone({ f: 500, to: 900, dur: 0.12, type: "square", vol: 0.07 }); noise({ filter: "highpass", f: 1800, dur: 0.06, vol: 0.25 }); },
    sinkOpen: () => { noise({ filter: "lowpass", f: 900, to: 200, dur: 0.5, vol: 0.4 }); tone({ f: 200, to: 90, dur: 0.4, type: "sine", vol: 0.12 }); },
    sinkSlip: () => noise({ filter: "bandpass", f: 700, to: 400, q: 1.5, dur: 0.18, vol: 0.25 }),
    sinkCollapse: () => { noise({ filter: "lowpass", f: 600, to: 120, dur: 0.9, vol: 0.55 }); tone({ f: 80, to: 40, dur: 0.8, type: "sawtooth", vol: 0.15 }); },
    iceCrack: () => { noise({ filter: "highpass", f: 3000, dur: 0.08, vol: 0.4 }); tone({ f: 1800, to: 2400, dur: 0.06, type: "square", vol: 0.05 }); },
    iceBreak: () => { noise({ filter: "highpass", f: 2200, dur: 0.25, vol: 0.55 }); tone({ f: 900, to: 300, dur: 0.3, type: "triangle", vol: 0.12 }); },
    splash: () => noise({ filter: "lowpass", f: 1400, to: 300, dur: 0.45, vol: 0.4, attack: 0.02 }),
    coconutWobble: () => noise({ filter: "bandpass", f: 1600, to: 2400, q: 2, dur: 0.3, vol: 0.18, attack: 0.05 }),
    coconutCrack: () => { tone({ f: 420, to: 220, dur: 0.1, type: "triangle", vol: 0.12 }); noise({ filter: "highpass", f: 1500, dur: 0.06, vol: 0.25 }); },
    bonk: () => { tone({ f: 700, to: 260, dur: 0.14, type: "square", vol: 0.13 }); tone({ f: 1400, to: 900, dur: 0.5, type: "sine", vol: 0.06, at: 0.08, vibrato: 30 }); },
    rustle: () => noise({ filter: "bandpass", f: 2200, to: 1400, q: 1.2, dur: 0.25, vol: 0.22, attack: 0.03 }),

    // Level dangers
    shooterFire: () => tone({ f: 800, to: 250, dur: 0.12, vol: 0.09 }),
    maceSwoosh: () => noise({ filter: "bandpass", f: 400, to: 900, q: 2, dur: 0.28, vol: 0.4, attack: 0.1 }),
  };

  // Don't play the same sound twice in a row too quickly (e.g. both players at once)
  const MIN_GAP = { default: 0.04, shooterFire: 0.12, maceSwoosh: 0.15, land: 0.06 };

  function play(name) {
    if (!ac || muted || ac.state === "closed") return;
    const now = ac.currentTime;
    if (now - (lastPlayed[name] ?? -1) < (MIN_GAP[name] ?? MIN_GAP.default)) return;
    lastPlayed[name] = now;
    EFFECTS[name]();
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("fire-run-muted", m ? "1" : "0"); } catch (e) { /* storage blocked */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ac.currentTime, 0.02);
  }

  return {
    unlock,
    play,
    setFire,
    toggleMute() { setMuted(!muted); return muted; },
    get muted() { return muted; },
    get fireLevel() { return fireLevel; },
    effects: Object.keys(EFFECTS),
  };
})();
