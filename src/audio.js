// src/audio.js
import { getBiome } from './constants.js';

// Note frequency constants (A minor pentatonic)
const NOTES = {
  A2: 110,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G3: 196,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392,
  A4: 440,
  C5: 523.25,
  E5: 659.25,
  G5: 784
};

// Biome audio profiles
const BIOME_AUDIO = {
  jungle: {
    padScale: [NOTES.A2, NOTES.C3, NOTES.E3, NOTES.G3],
    melodyScale: [NOTES.A3, NOTES.C4, NOTES.D4, NOTES.E4, NOTES.G4],
    accentScale: [NOTES.A4, NOTES.C5, NOTES.E5, NOTES.G5],
    padWave: 'triangle',
    melodyWave: 'triangle',
    accentWave: 'triangle',
    padFilterFreq: 200,
    tempoBase: 3000,
    tempoVariance: 2000,
    padVolume: 0.02,
    melodyVolume: 0.015,
    accentVolume: 0.01,
    accentChance: 0.3
  },
  dirt_cave: {
    padScale: [NOTES.A2, NOTES.C3, NOTES.D3, NOTES.E3],
    melodyScale: [NOTES.A3, NOTES.C4, NOTES.D4, NOTES.E4],
    accentScale: [NOTES.A4, NOTES.C5, NOTES.E5],
    padWave: 'sine',
    melodyWave: 'sine',
    accentWave: 'sine',
    padFilterFreq: 150,
    tempoBase: 4000,
    tempoVariance: 3000,
    padVolume: 0.018,
    melodyVolume: 0.012,
    accentVolume: 0.008,
    accentChance: 0.15
  },
  stone_cave: {
    padScale: [NOTES.A2, NOTES.C3, NOTES.E3],
    melodyScale: [NOTES.A3, NOTES.C4, NOTES.E4, NOTES.G4],
    accentScale: [NOTES.A4, NOTES.E5, NOTES.G5],
    padWave: 'square',
    melodyWave: 'square',
    accentWave: 'square',
    padFilterFreq: 120,
    tempoBase: 5000,
    tempoVariance: 3000,
    padVolume: 0.015,
    melodyVolume: 0.01,
    accentVolume: 0.007,
    accentChance: 0.2
  },
  dungeon: {
    padScale: [NOTES.A2, NOTES.C3, NOTES.D3],
    melodyScale: [NOTES.A3, NOTES.C4, NOTES.D4, NOTES.E4],
    accentScale: [NOTES.A4, NOTES.C5, NOTES.E5],
    padWave: 'sawtooth',
    melodyWave: 'sawtooth',
    accentWave: 'sawtooth',
    padFilterFreq: 80,
    tempoBase: 6000,
    tempoVariance: 4000,
    padVolume: 0.018,
    melodyVolume: 0.012,
    accentVolume: 0.008,
    accentChance: 0.25
  },
  town: {
    padScale: [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.A3],
    melodyScale: [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.A4, NOTES.C5],
    accentScale: [NOTES.E5, NOTES.G5],
    padWave: 'sine',
    melodyWave: 'sine',
    accentWave: 'triangle',
    padFilterFreq: 250,
    tempoBase: 5000,
    tempoVariance: 4000,
    padVolume: 0.015,
    melodyVolume: 0.012,
    accentVolume: 0.006,
    accentChance: 0.15
  }
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
