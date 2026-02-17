// src/audio.js
import { getBiome } from './constants.js';

// Note frequencies
const N = {
  A2: 110.00, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
  A3: 220.00, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, C5: 523.25, D5: 587.33, E5: 659.25, G5: 784.00
};

// Chord definitions: arrays of 3 frequencies (root, third, fifth)
const CHORDS = {
  Am:  [N.A2, N.C3, N.E3],
  C:   [N.C3, N.E3, N.G3],
  Dm:  [N.D3, N.F3, N.A3],
  Em:  [N.E3, N.G3, N.A3], // using A3 instead of B for pentatonic compatibility
  F:   [N.F3, N.A3, N.C4],
  G:   [N.G3, N.C4, N.D4], // Gsus4-ish voicing, avoids B
};

// Scale notes available for stepwise melody motion, per mood
const MOOD_GROUPS = {
  oppressive: {
    progressions: [
      [CHORDS.Am, CHORDS.Dm, CHORDS.Em, CHORDS.Am],
      [CHORDS.Am, CHORDS.F,  CHORDS.Dm, CHORDS.Am],
    ],
    melodyScale: [N.A3, N.C4, N.D4, N.E4, N.G4],
    accentScale: [N.A4, N.C5, N.E5],
    phraseLength: [2, 3],       // min, max notes per phrase
    noteSpacing: [350, 500],    // ms between notes in a phrase
    phrasePause: [6000, 10000], // ms between phrases
    directionBias: -0.3,        // negative = descending tendency
    accentChance: 0.2,
  },
  mysterious: {
    progressions: [
      [CHORDS.Am, CHORDS.C,  CHORDS.G,  CHORDS.Em],
      [CHORDS.C,  CHORDS.Am, CHORDS.F,  CHORDS.G],
    ],
    melodyScale: [N.A3, N.C4, N.D4, N.E4, N.G4, N.A4],
    accentScale: [N.A4, N.C5, N.E5, N.G5],
    phraseLength: [2, 4],
    noteSpacing: [250, 400],
    phrasePause: [4000, 8000],
    directionBias: 0,
    accentChance: 0.25,
  },
  peaceful: {
    progressions: [
      [CHORDS.C,  CHORDS.G,  CHORDS.Am, CHORDS.F],
      [CHORDS.F,  CHORDS.C,  CHORDS.G,  CHORDS.Am],
    ],
    melodyScale: [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5],
    accentScale: [N.E5, N.G5],
    phraseLength: [3, 4],
    noteSpacing: [200, 300],
    phrasePause: [4000, 7000],
    directionBias: 0.3,
    accentChance: 0.15,
  }
};

// Per-biome timbre and tempo settings
const BIOME_PROFILES = {
  jungle:     { mood: 'mysterious',  padWave: 'triangle', melodyWave: 'triangle', filterFreq: 200, chordDuration: 7000, padVolume: 0.02,  bassVolume: 0.012, melodyVolume: 0.015, accentVolume: 0.01  },
  dirt_cave:  { mood: 'mysterious',  padWave: 'sine',     melodyWave: 'sine',     filterFreq: 150, chordDuration: 7000, padVolume: 0.018, bassVolume: 0.01,  melodyVolume: 0.012, accentVolume: 0.008 },
  stone_cave: { mood: 'oppressive',  padWave: 'square',   melodyWave: 'square',   filterFreq: 120, chordDuration: 8000, padVolume: 0.015, bassVolume: 0.01,  melodyVolume: 0.01,  accentVolume: 0.007 },
  dungeon:    { mood: 'oppressive',  padWave: 'sawtooth', melodyWave: 'sawtooth', filterFreq: 80,  chordDuration: 8000, padVolume: 0.018, bassVolume: 0.012, melodyVolume: 0.012, accentVolume: 0.008 },
  town:       { mood: 'peaceful',    padWave: 'sine',     melodyWave: 'sine',     filterFreq: 250, chordDuration: 6000, padVolume: 0.015, bassVolume: 0.008, melodyVolume: 0.012, accentVolume: 0.006 },
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.ambientNode = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  ensureContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  _createGain(volume) {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = volume * this.volume;
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
    gain.gain.setValueAtTime(volume * this.volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Sound effects
  footstep() {
    this._noise(0.05, 0.1);
  }

  meleeHit() {
    if (!this.ctx) return;
    this.ensureContext();
    this._noise(0.08, 0.25);
    this._tone(200, 0.1, 'sine', 0.2);
  }

  rangedShot() {
    this._tone(800, 0.1, 'sine', 0.2);
  }

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
    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    osc.start();
    osc.stop(now + 0.3);
  }

  enemyHit() {
    this._noise(0.06, 0.2);
  }

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
    gain.gain.setValueAtTime(0.2 * this.volume, now);
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
      gain.gain.setValueAtTime(0.15 * this.volume, now + i * 0.06);
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
      gain.gain.setValueAtTime(0.2 * this.volume, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
      osc.connect(gain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.25);
    });
  }

  doorOpen() {
    this._tone(300, 0.08, 'square', 0.15);
  }

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
    gain.gain.setValueAtTime(0.25 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    osc.start();
    osc.stop(now + 0.6);
  }

  bossEntrance() {
    if (!this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    // Low drone
    const drone = this.ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 55;
    const droneGain = this._createGain(0.15);
    if (!droneGain) return;
    droneGain.gain.setValueAtTime(0.15 * this.volume, now);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    drone.connect(droneGain);
    drone.start();
    drone.stop(now + 1.0);
    // Impact
    this._noise(0.15, 0.3);
  }

  uiClick() {
    this._tone(1200, 0.04, 'sine', 0.1);
  }

  startAmbient(floorNumber) {
    const biome = getBiome(floorNumber);
    this.startAmbientBiome(biome);
  }

  startAmbientBiome(biomeKey) {
    if (!this.ctx) return;
    this.ensureContext();
    this.stopAmbient();

    const profile = BIOME_AUDIO[biomeKey] || BIOME_AUDIO.dungeon;

    // Pad layer - sustained oscillator that glides between notes
    const padOsc = this.ctx.createOscillator();
    padOsc.type = profile.padWave;
    padOsc.frequency.value = profile.padScale[0];

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = profile.padFilterFreq;

    const padGain = this.ctx.createGain();
    padGain.gain.value = profile.padVolume * this.volume;

    padOsc.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.ctx.destination);
    padOsc.start();

    // Pad note change interval (4-7 seconds)
    const padInterval = setInterval(() => {
      if (!this.ctx) return;
      const note = profile.padScale[Math.floor(Math.random() * profile.padScale.length)];
      const now = this.ctx.currentTime;
      padOsc.frequency.linearRampToValueAtTime(note, now + 2.0);
    }, 4000 + Math.random() * 3000);

    // Melody layer - sparse one-shot notes with attack/decay
    const playMelodyNote = () => {
      if (!this.ctx) return;

      const note = profile.melodyScale[Math.floor(Math.random() * profile.melodyScale.length)];
      const duration = 0.8 + Math.random() * 1.2;
      const now = this.ctx.currentTime;

      const melodyOsc = this.ctx.createOscillator();
      melodyOsc.type = profile.melodyWave;
      melodyOsc.frequency.value = note;

      const melodyGain = this.ctx.createGain();
      melodyGain.gain.value = 0.001;
      melodyGain.gain.linearRampToValueAtTime(profile.melodyVolume * this.volume, now + 0.15);
      melodyGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      melodyOsc.connect(melodyGain);
      melodyGain.connect(this.ctx.destination);
      melodyOsc.start();
      melodyOsc.stop(now + duration);

      // Accent layer - triggered with accentChance probability
      if (Math.random() < profile.accentChance) {
        const accentNote = profile.accentScale[Math.floor(Math.random() * profile.accentScale.length)];
        const accentDuration = 0.3 + Math.random() * 0.4;

        const accentOsc = this.ctx.createOscillator();
        accentOsc.type = profile.accentWave;
        accentOsc.frequency.value = accentNote;

        const accentGain = this.ctx.createGain();
        accentGain.gain.value = 0.001;
        accentGain.gain.linearRampToValueAtTime(profile.accentVolume * this.volume, now + 0.15);
        accentGain.gain.exponentialRampToValueAtTime(0.001, now + accentDuration);

        accentOsc.connect(accentGain);
        accentGain.connect(this.ctx.destination);
        accentOsc.start();
        accentOsc.stop(now + accentDuration);
      }

      // Schedule next melody note
      const nextDelay = profile.tempoBase + Math.random() * profile.tempoVariance;
      const melodyTimeout = setTimeout(playMelodyNote, nextDelay);
      if (this.ambientNode) {
        this.ambientNode.melodyTimeout = melodyTimeout;
      }
    };

    // Start first melody note
    const initialTimeout = setTimeout(playMelodyNote, profile.tempoBase + Math.random() * profile.tempoVariance);

    this.ambientNode = {
      osc: padOsc,
      gain: padGain,
      padInterval,
      melodyTimeout: initialTimeout
    };
  }

  stopAmbient() {
    if (this.ambientNode) {
      try { this.ambientNode.osc.stop(); } catch (e) {}
      if (this.ambientNode.padInterval) {
        clearInterval(this.ambientNode.padInterval);
      }
      if (this.ambientNode.melodyTimeout) {
        clearTimeout(this.ambientNode.melodyTimeout);
      }
      this.ambientNode = null;
    }
  }
}
