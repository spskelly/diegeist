// src/audio.js
import { getBiome } from './constants.js';

// ─── note frequencies ───────────────────────────────────────────────
const N = {
  A2: 110.00, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.00, A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
  F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33,
  E5: 659.25, G5: 784.00, A5: 880.00
};

// ─── chord voicings ─────────────────────────────────────────────────
// low voicings for darker moods
const CH = {
  Am:   [N.A2, N.C3, N.E3],
  C:    [N.C3, N.E3, N.G3],
  Dm:   [N.D3, N.F3, N.A3],
  Em:   [N.E3, N.G3, N.B3],
  F:    [N.F3, N.A3, N.C4],
  G:    [N.G3, N.B3, N.D4],
  // higher voicings for brighter moods
  Am_h: [N.A3, N.C4, N.E4],
  C_h:  [N.C4, N.E4, N.G4],
  Dm_h: [N.D4, N.F4, N.A4],
  F_h:  [N.F4, N.A4, N.C5],
  G_h:  [N.G4, N.B4, N.D5],
};

// ─── mood definitions ───────────────────────────────────────────────
// each mood defines harmonic, melodic, and phrasing behavior
const MOODS = {
  oppressive: {
    progressions: [
      [CH.Am, CH.Dm, CH.Em, CH.Am],
      [CH.Am, CH.F,  CH.Dm, CH.Em],
      [CH.Dm, CH.Am, CH.Em, CH.Dm],
    ],
    melodyScale: [N.A3, N.C4, N.D4, N.E4, N.G4],
    accentScale: [N.A4, N.C5, N.E5],
    phraseLength: [2, 3],
    noteSpacing: [400, 600],
    phrasePause: [7000, 12000],
    directionBias: -0.3,       // tends downward
    accentChance: 0.15,
    restChance: 0.2,           // chance to insert a silent beat in a phrase
  },
  mysterious: {
    progressions: [
      [CH.Am, CH.C,  CH.G,  CH.Em],
      [CH.C,  CH.Am, CH.F,  CH.G],
      [CH.Em, CH.C,  CH.Am, CH.F],
    ],
    melodyScale: [N.A3, N.C4, N.D4, N.E4, N.G4, N.A4],
    accentScale: [N.A4, N.C5, N.E5, N.G5],
    phraseLength: [2, 5],
    noteSpacing: [250, 450],
    phrasePause: [5000, 9000],
    directionBias: 0,
    accentChance: 0.25,
    restChance: 0.15,
  },
  peaceful: {
    progressions: [
      [CH.C_h, CH.G_h, CH.Am_h, CH.F_h],
      [CH.F_h, CH.C_h, CH.G_h,  CH.Am_h],
      [CH.C_h, CH.Am_h, CH.F_h, CH.G_h],
    ],
    melodyScale: [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5],
    accentScale: [N.E5, N.G5, N.A5],
    phraseLength: [3, 5],
    noteSpacing: [200, 350],
    phrasePause: [4000, 7000],
    directionBias: 0.2,        // tends upward
    accentChance: 0.2,
    restChance: 0.1,
  },
  eldritch: {
    progressions: [
      [CH.Em, CH.Dm, CH.Am, CH.Em],
      [CH.Dm, CH.Em, CH.Dm, CH.Am],
    ],
    melodyScale: [N.E3, N.G3, N.A3, N.C4, N.D4],
    accentScale: [N.E4, N.G4, N.A4],
    phraseLength: [1, 3],
    noteSpacing: [500, 800],
    phrasePause: [8000, 14000],
    directionBias: -0.4,
    accentChance: 0.1,
    restChance: 0.3,           // lots of silence
  },
};

// ─── texture types ──────────────────────────────────────────────────
// these define the procedural environmental sound layer
// each texture type configures how filtered noise bursts are generated
const TEXTURES = {
  // water drips: short, bright, resonant pings at random intervals
  drips: {
    burstDuration: [0.02, 0.08],   // seconds
    burstInterval: [800, 3000],     // ms between bursts
    filterType: 'bandpass',
    filterFreq: [1200, 3500],       // randomized per burst
    filterQ: [8, 20],
    volume: [0.01, 0.03],
    toneChance: 0.6,                // chance to add a tonal ping alongside noise
    toneFreqs: [2000, 2800, 3500],
    toneDuration: [0.05, 0.15],
    toneVolume: 0.015,
  },
  // rumble: low, rolling, distant thuds and creaks
  rumble: {
    burstDuration: [0.1, 0.4],
    burstInterval: [3000, 8000],
    filterType: 'lowpass',
    filterFreq: [60, 150],
    filterQ: [1, 3],
    volume: [0.02, 0.05],
    toneChance: 0.3,
    toneFreqs: [40, 55, 70],
    toneDuration: [0.3, 0.8],
    toneVolume: 0.02,
  },
  // rustle: mid-frequency swishing, organic movement
  rustle: {
    burstDuration: [0.05, 0.2],
    burstInterval: [600, 2500],
    filterType: 'bandpass',
    filterFreq: [400, 2000],
    filterQ: [1, 4],
    volume: [0.008, 0.02],
    toneChance: 0.2,
    toneFreqs: [800, 1200, 1600],
    toneDuration: [0.03, 0.08],
    toneVolume: 0.008,
  },
  // wind: long, filtered noise sweeps
  wind: {
    burstDuration: [0.3, 1.0],
    burstInterval: [2000, 5000],
    filterType: 'bandpass',
    filterFreq: [200, 800],
    filterQ: [0.5, 2],
    volume: [0.005, 0.015],
    toneChance: 0,
    toneFreqs: [],
    toneDuration: [0, 0],
    toneVolume: 0,
  },
};

// ─── biome profiles ─────────────────────────────────────────────────
// each biome combines a mood, texture, timbre settings, and reverb character
const BIOME_PROFILES = {
  cave: {
    mood: 'mysterious',
    texture: 'drips',
    // pad: detuned oscillator pairs, wave type, filter settings
    padWave: 'triangle',
    padDetune: 6,              // cents of detuning between paired oscs
    padFilterBase: 250,        // base lowpass cutoff for pad
    padFilterLFODepth: 120,    // how much the lfo sweeps the filter (hz)
    padFilterLFORate: 0.07,    // lfo speed in hz (slow = organic)
    padVolume: 0.018,
    // bass
    bassVolume: 0.012,
    bassFilterFreq: 120,
    // melody: wave type, vibrato, note shape
    melodyWave: 'triangle',
    melodyVolume: 0.014,
    melodyVibRate: 4,          // vibrato speed hz
    melodyVibDepth: 3,         // vibrato depth cents
    melodyAttack: 0.12,        // note fade-in seconds
    // accent
    accentVolume: 0.009,
    accentWave: 'sine',
    // reverb
    reverbDuration: 3.0,       // impulse response length in seconds
    reverbDecay: 1.8,          // exponential decay rate
    reverbWet: 0.35,           // wet/dry mix (0 = dry, 1 = fully wet)
    // chord timing
    chordDuration: 7000,       // ms per chord
    chordGlide: 2.5,           // seconds to glide between chords
    // stereo spread for melody notes
    stereoPanRange: 0.6,       // -0.6 to +0.6
  },
  dungeon: {
    mood: 'oppressive',
    texture: 'rumble',
    padWave: 'sawtooth',
    padDetune: 4,
    padFilterBase: 100,
    padFilterLFODepth: 40,
    padFilterLFORate: 0.04,
    padVolume: 0.015,
    bassVolume: 0.014,
    bassFilterFreq: 80,
    melodyWave: 'square',
    melodyVolume: 0.01,
    melodyVibRate: 0,
    melodyVibDepth: 0,
    melodyAttack: 0.2,
    accentVolume: 0.007,
    accentWave: 'sawtooth',
    reverbDuration: 2.0,
    reverbDecay: 2.5,
    reverbWet: 0.25,
    chordDuration: 8000,
    chordGlide: 3.0,
    stereoPanRange: 0.4,
  },
  wilds: {
    mood: 'mysterious',
    texture: 'rustle',
    padWave: 'triangle',
    padDetune: 8,
    padFilterBase: 350,
    padFilterLFODepth: 200,
    padFilterLFORate: 0.1,
    padVolume: 0.016,
    bassVolume: 0.008,
    bassFilterFreq: 140,
    melodyWave: 'triangle',
    melodyVolume: 0.015,
    melodyVibRate: 5,
    melodyVibDepth: 6,
    melodyAttack: 0.08,
    accentVolume: 0.01,
    accentWave: 'sine',
    reverbDuration: 1.5,
    reverbDecay: 1.2,
    reverbWet: 0.2,
    chordDuration: 6500,
    chordGlide: 2.0,
    stereoPanRange: 0.8,
  },
  town: {
    mood: 'peaceful',
    texture: 'wind',
    padWave: 'sine',
    padDetune: 3,
    padFilterBase: 500,
    padFilterLFODepth: 150,
    padFilterLFORate: 0.06,
    padVolume: 0.014,
    bassVolume: 0.006,
    bassFilterFreq: 160,
    melodyWave: 'sine',
    melodyVolume: 0.013,
    melodyVibRate: 5,
    melodyVibDepth: 4,
    melodyAttack: 0.06,
    accentVolume: 0.008,
    accentWave: 'sine',
    reverbDuration: 1.8,
    reverbDecay: 1.5,
    reverbWet: 0.3,
    chordDuration: 6000,
    chordGlide: 1.8,
    stereoPanRange: 0.7,
  },
  eldritch: {
    mood: 'eldritch',
    texture: 'rumble',
    padWave: 'sawtooth',
    padDetune: 10,
    padFilterBase: 80,
    padFilterLFODepth: 30,
    padFilterLFORate: 0.03,
    padVolume: 0.012,
    bassVolume: 0.016,
    bassFilterFreq: 60,
    melodyWave: 'square',
    melodyVolume: 0.008,
    melodyVibRate: 2,
    melodyVibDepth: 8,
    melodyAttack: 0.3,
    accentVolume: 0.006,
    accentWave: 'sawtooth',
    reverbDuration: 4.0,
    reverbDecay: 1.5,
    reverbWet: 0.45,
    chordDuration: 10000,
    chordGlide: 4.0,
    stereoPanRange: 0.3,
  },
};

export const BIOME_KEYS = Object.keys(BIOME_PROFILES);


// ─── utility ────────────────────────────────────────────────────────
// random float in [min, max]
function rand(min, max) { return min + Math.random() * (max - min); }
// random element from array
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


// ═══════════════════════════════════════════════════════════════════
// audio manager
// ═══════════════════════════════════════════════════════════════════
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 0.7;
    this.ambientVolume = 0.7;
    this.ambientNode = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('web audio api not available');
    }
  }

  ensureContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  setAmbientVolume(v) {
    this.ambientVolume = Math.max(0, Math.min(1, v));
    // live-update ambient gain if playing
    if (this.ambientNode) {
      const p = this.ambientNode.profile;
      if (this.ambientNode.padGain)  this.ambientNode.padGain.gain.value  = p.padVolume  * v;
      if (this.ambientNode.bassGain) this.ambientNode.bassGain.gain.value = p.bassVolume * v;
    }
  }


  // ─── sfx utilities ──────────────────────────────────────────────
  _createGain(volume) {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = volume * this.sfxVolume;
    gain.connect(this.ctx.destination);
    return gain;
  }

  _noise(duration, volume = 0.3) {
    if (!this.ctx) return;
    this.ensureContext();
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this._createGain(volume);
    if (!gain) return;
    source.connect(gain);
    source.start();
  }

  _tone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.ctx) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this._createGain(volume);
    if (!gain) return;
    gain.gain.setValueAtTime(volume * this.sfxVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }


  // ─── sound effects ──────────────────────────────────────────────
  footstep()     { this._noise(0.05, 0.1); }

  meleeHit() {
    if (!this.ctx) return;
    this.ensureContext();
    this._noise(0.08, 0.25);
    this._tone(200, 0.1, 'sine', 0.2);
  }

  rangedShot()   { this._tone(800, 0.1, 'sine', 0.2); }

  magicCast() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);
    const gain = this._createGain(0.2);
    if (!gain) return;
    gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    osc.start();
    osc.stop(now + 0.3);
  }

  enemyHit()     { this._noise(0.06, 0.2); }

  enemyDeath() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    const gain = this._createGain(0.2);
    if (!gain) return;
    gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    osc.start();
    osc.stop(now + 0.4);
  }

  playerHurt() {
    if (!this.ctx) return;
    this.ensureContext();
    this._tone(100, 0.15, 'sine', 0.3);
    this._noise(0.1, 0.15);
  }

  itemPickup() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this._createGain(0.15);
      if (!gain) return;
      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.1);
      osc.connect(gain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.1);
    });
  }

  blessing() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this._createGain(0.2);
      if (!gain) return;
      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
      osc.connect(gain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.25);
    });
  }

  doorOpen()     { this._tone(300, 0.08, 'square', 0.15); }

  stairsDescend() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    const gain = this._createGain(0.25);
    if (!gain) return;
    gain.gain.setValueAtTime(0.25 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    osc.start();
    osc.stop(now + 0.6);
  }

  bossEntrance() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const drone = this.ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    const droneGain = this._createGain(0.15);
    if (!droneGain) return;
    droneGain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    drone.connect(droneGain);
    drone.start();
    drone.stop(now + 1.0);
    this._noise(0.15, 0.3);
  }

  uiClick()      { this._tone(1200, 0.04, 'sine', 0.1); }


  // ═══════════════════════════════════════════════════════════════
  // ambient system
  // ═══════════════════════════════════════════════════════════════

  // ─── reverb: generate a stereo impulse response procedurally ──
  _createReverb(duration, decay) {
    const length = Math.floor(this.ctx.sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // exponential decay envelope with random noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  // ─── phrase generation ────────────────────────────────────────
  // builds a short melodic phrase that relates to the current chord
  _generatePhrase(mood, currentChord) {
    const [minLen, maxLen] = mood.phraseLength;
    const length = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
    const scale = mood.melodyScale;

    // find chord tones that exist in the melody scale (or octave equivalents)
    const chordTonesInScale = currentChord
      .flatMap(f => scale.filter(s => {
        const ratio = s / f;
        return Math.abs(ratio - 1) < 0.01 || Math.abs(ratio - 2) < 0.01 || Math.abs(ratio - 0.5) < 0.01;
      }))
      .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

    const startPool = chordTonesInScale.length > 0 ? chordTonesInScale : scale;
    const startNote = pick(startPool);

    const phrase = [startNote];
    let idx = scale.indexOf(startNote);
    if (idx === -1) idx = Math.floor(scale.length / 2);

    for (let i = 1; i < length; i++) {
      // rest: insert null to create rhythmic gaps
      if (Math.random() < (mood.restChance || 0)) {
        phrase.push(null);
        continue;
      }

      if (Math.random() < 0.25) {
        // leap to a chord tone
        const target = pick(chordTonesInScale.length > 0 ? chordTonesInScale : scale);
        idx = scale.indexOf(target);
        if (idx === -1) idx = Math.floor(scale.length / 2);
        phrase.push(target);
      } else {
        // stepwise motion with direction bias
        const direction = (Math.random() + mood.directionBias > 0.5) ? 1 : -1;
        idx = Math.max(0, Math.min(scale.length - 1, idx + direction));
        phrase.push(scale[idx]);
      }
    }

    return phrase;
  }

  // ─── texture layer: procedural environmental sounds ───────────
  // schedules recurring filtered noise bursts + optional tonal pings
  _startTexture(profile, reverbSend) {
    const texDef = TEXTURES[profile.texture];
    if (!texDef) return null;

    let running = true;
    let timeout = null;

    const playBurst = () => {
      if (!running || !this.ctx) return;

      const now = this.ctx.currentTime;
      const duration = rand(...texDef.burstDuration);
      const vol = rand(...texDef.volume) * this.ambientVolume;

      // noise burst
      const bufLen = Math.floor(this.ctx.sampleRate * duration);
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        // apply a fade-in/fade-out envelope to avoid clicks
        const env = Math.sin(Math.PI * i / bufLen);
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      // filter
      const filter = this.ctx.createBiquadFilter();
      filter.type = texDef.filterType;
      filter.frequency.value = rand(...texDef.filterFreq);
      filter.Q.value = rand(...texDef.filterQ);

      // gain
      const gain = this.ctx.createGain();
      gain.gain.value = vol;

      // stereo placement
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = rand(-0.8, 0.8);

      // connect: src → filter → gain → pan → [destination + reverb send]
      src.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.ctx.destination);
      if (reverbSend) {
        pan.connect(reverbSend);
      }

      src.start(now);

      // optional tonal ping (e.g. drip resonance)
      if (texDef.toneChance > 0 && Math.random() < texDef.toneChance && texDef.toneFreqs.length > 0) {
        const tFreq = pick(texDef.toneFreqs);
        const tDur = rand(...texDef.toneDuration);
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = tFreq;

        const tGain = this.ctx.createGain();
        tGain.gain.setValueAtTime(0.001, now);
        tGain.gain.linearRampToValueAtTime(texDef.toneVolume * this.ambientVolume, now + 0.005);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + tDur);

        const tPan = this.ctx.createStereoPanner();
        tPan.pan.value = pan.pan.value + rand(-0.1, 0.1); // slightly offset from noise

        osc.connect(tGain);
        tGain.connect(tPan);
        tPan.connect(this.ctx.destination);
        if (reverbSend) tPan.connect(reverbSend);

        osc.start(now);
        osc.stop(now + tDur);
      }

      // schedule next burst
      const nextDelay = rand(...texDef.burstInterval);
      timeout = setTimeout(playBurst, nextDelay);
    };

    // start after a short random delay
    timeout = setTimeout(playBurst, rand(500, 2000));

    return {
      stop() {
        running = false;
        if (timeout) clearTimeout(timeout);
      }
    };
  }


  // ─── start ambient ────────────────────────────────────────────
  startAmbient(floorNumber) {
    const biome = getBiome(floorNumber);
    this.startAmbientBiome(biome);
  }

  startAmbientBiome(biomeKey) {
    if (!this.ctx) return;
    this.ensureContext();
    this.stopAmbient();

    const profile = BIOME_PROFILES[biomeKey] || BIOME_PROFILES.dungeon;
    const mood = MOODS[profile.mood];

    // pick a random chord progression
    const progression = pick(mood.progressions);
    let chordIndex = 0;
    let currentChord = progression[0];

    // ── reverb bus ──
    const reverb = this._createReverb(profile.reverbDuration, profile.reverbDecay);
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = profile.reverbWet * this.ambientVolume;
    reverb.connect(reverbGain);
    reverbGain.connect(this.ctx.destination);

    // ── pad layer: detuned oscillator pairs through lfo-modulated filter ──
    const padOscs = [];
    currentChord.forEach(freq => {
      // two oscillators per chord tone, slightly detuned for chorus
      const oscA = this.ctx.createOscillator();
      oscA.type = profile.padWave;
      oscA.frequency.value = freq;
      oscA.detune.value = -profile.padDetune;

      const oscB = this.ctx.createOscillator();
      oscB.type = profile.padWave;
      oscB.frequency.value = freq;
      oscB.detune.value = profile.padDetune;

      padOscs.push({ a: oscA, b: oscB, baseFreq: freq });
    });

    // pad filter with lfo modulation
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = profile.padFilterBase;
    padFilter.Q.value = 1.5;

    // lfo → pad filter cutoff for organic movement
    const padLFO = this.ctx.createOscillator();
    padLFO.type = 'sine';
    padLFO.frequency.value = profile.padFilterLFORate;
    const padLFOGain = this.ctx.createGain();
    padLFOGain.gain.value = profile.padFilterLFODepth;
    padLFO.connect(padLFOGain);
    padLFOGain.connect(padFilter.frequency);
    padLFO.start();

    // pad gain
    const padGain = this.ctx.createGain();
    padGain.gain.value = profile.padVolume * this.ambientVolume;

    // connect pad: oscs → filter → gain → [destination + reverb]
    padOscs.forEach(({ a, b }) => {
      a.connect(padFilter);
      b.connect(padFilter);
      a.start();
      b.start();
    });
    padFilter.connect(padGain);
    padGain.connect(this.ctx.destination);
    padGain.connect(reverb);

    // ── bass layer ──
    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = currentChord[0] / 2;

    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = profile.bassFilterFreq;

    const bassGain = this.ctx.createGain();
    bassGain.gain.value = profile.bassVolume * this.ambientVolume;

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start();

    // ── chord progression timer ──
    const advanceChord = () => {
      chordIndex = (chordIndex + 1) % progression.length;
      currentChord = progression[chordIndex];
      const now = this.ctx.currentTime;
      const glide = profile.chordGlide;

      // glide pad oscillators to new chord tones
      padOscs.forEach((pair, i) => {
        const target = currentChord[i % currentChord.length];
        pair.a.frequency.linearRampToValueAtTime(target, now + glide);
        pair.b.frequency.linearRampToValueAtTime(target, now + glide);
        pair.baseFreq = target;
      });

      // glide bass
      bassOsc.frequency.linearRampToValueAtTime(currentChord[0] / 2, now + glide);
    };
    const chordInterval = setInterval(advanceChord, profile.chordDuration);

    // ── texture layer ──
    const textureHandle = this._startTexture(profile, reverb);

    // ── melody layer ──
    let melodyTimeout = null;

    const playPhrase = () => {
      if (!this.ctx || !this.ambientNode) return;

      const chord = this.ambientNode.getCurrentChord();
      const phrase = this._generatePhrase(mood, chord);
      const [minSpacing, maxSpacing] = mood.noteSpacing;
      const now = this.ctx.currentTime;

      phrase.forEach((freq, i) => {
        if (freq === null) return; // rest

        const noteTime = now + i * rand(minSpacing, maxSpacing) / 1000;
        const duration = rand(0.5, 1.2);
        const attack = profile.melodyAttack;

        // oscillator
        const osc = this.ctx.createOscillator();
        osc.type = profile.melodyWave;
        osc.frequency.value = freq;

        // optional vibrato
        if (profile.melodyVibRate > 0 && profile.melodyVibDepth > 0) {
          const vibLFO = this.ctx.createOscillator();
          vibLFO.type = 'sine';
          vibLFO.frequency.value = profile.melodyVibRate;
          const vibGain = this.ctx.createGain();
          vibGain.gain.value = profile.melodyVibDepth;
          vibLFO.connect(vibGain);
          vibGain.connect(osc.detune);
          vibLFO.start(noteTime);
          vibLFO.stop(noteTime + duration);
        }

        // gain envelope: soft attack → sustain → decay
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, noteTime);
        gain.gain.linearRampToValueAtTime(
          profile.melodyVolume * this.ambientVolume,
          noteTime + attack
        );
        gain.gain.setValueAtTime(
          profile.melodyVolume * this.ambientVolume,
          noteTime + attack + 0.05
        );
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration);

        // stereo pan: random position within the biome's spread
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = rand(-profile.stereoPanRange, profile.stereoPanRange);

        // connect: osc → gain → pan → [destination + reverb]
        osc.connect(gain);
        gain.connect(pan);
        pan.connect(this.ctx.destination);
        pan.connect(reverb);

        osc.start(noteTime);
        osc.stop(noteTime + duration);
      });

      // accent: high-register chord-tone ping after the phrase
      if (Math.random() < mood.accentChance) {
        const accentDelay = phrase.length * maxSpacing / 1000 + rand(0.1, 0.4);
        const accentTime = now + accentDelay;
        const accentFreq = pick(mood.accentScale);
        const accentDur = rand(0.4, 0.8);

        const osc = this.ctx.createOscillator();
        osc.type = profile.accentWave;
        osc.frequency.value = accentFreq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, accentTime);
        gain.gain.linearRampToValueAtTime(
          profile.accentVolume * this.ambientVolume,
          accentTime + 0.06
        );
        gain.gain.exponentialRampToValueAtTime(0.001, accentTime + accentDur);

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = rand(-profile.stereoPanRange, profile.stereoPanRange);

        osc.connect(gain);
        gain.connect(pan);
        pan.connect(this.ctx.destination);
        pan.connect(reverb); // accents go heavy through reverb

        osc.start(accentTime);
        osc.stop(accentTime + accentDur);
      }

      // schedule next phrase
      const [minPause, maxPause] = mood.phrasePause;
      melodyTimeout = setTimeout(playPhrase, rand(minPause, maxPause));
    };

    // start first phrase after a delay
    melodyTimeout = setTimeout(playPhrase, rand(2000, 4000));

    // ── store references for cleanup and live access ──
    this.ambientNode = {
      padOscs,
      padFilter,
      padLFO,
      padLFOGain,
      padGain,
      bassOsc,
      bassGain,
      reverb,
      reverbGain,
      chordInterval,
      melodyTimeout,
      textureHandle,
      getCurrentChord: () => currentChord,
      profile,
      mood,
    };
  }


  // ─── stop ambient ─────────────────────────────────────────────
  stopAmbient() {
    if (!this.ambientNode) return;
    const a = this.ambientNode;

    // stop pad oscillators (detuned pairs)
    if (a.padOscs) {
      a.padOscs.forEach(({ a: oscA, b: oscB }) => {
        try { oscA.stop(); } catch (e) {}
        try { oscB.stop(); } catch (e) {}
      });
    }

    // stop pad lfo
    if (a.padLFO) {
      try { a.padLFO.stop(); } catch (e) {}
    }

    // stop bass
    if (a.bassOsc) {
      try { a.bassOsc.stop(); } catch (e) {}
    }

    // clear chord timer
    if (a.chordInterval) clearInterval(a.chordInterval);

    // clear melody timer
    if (a.melodyTimeout) clearTimeout(a.melodyTimeout);

    // stop texture layer
    if (a.textureHandle) a.textureHandle.stop();

    this.ambientNode = null;
  }
}