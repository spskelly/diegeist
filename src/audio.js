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

// Higher voicings for peaceful mood (one octave up from CHORDS)
const CHORDS_HIGH = {
  Am:  [N.A3, N.C4, N.E4],
  C:   [N.C4, N.E4, N.G4],
  F:   [N.F4, N.A4, N.C5],
  G:   [N.G4, N.C5, N.D5],
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
      [CHORDS_HIGH.C,  CHORDS_HIGH.G,  CHORDS_HIGH.Am, CHORDS_HIGH.F],
      [CHORDS_HIGH.F,  CHORDS_HIGH.C,  CHORDS_HIGH.G,  CHORDS_HIGH.Am],
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
  town:       { mood: 'peaceful',    padWave: 'sine',     melodyWave: 'sine',     filterFreq: 400, chordDuration: 6000, padVolume: 0.015, bassVolume: 0.008, melodyVolume: 0.012, accentVolume: 0.006 },
};

export const BIOME_KEYS = Object.keys(BIOME_PROFILES);

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
      console.warn('Web Audio API not available');
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
  }

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
    gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
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
    // Low drone
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
    // Impact
    this._noise(0.15, 0.3);
  }

  uiClick() {
    this._tone(1200, 0.04, 'sine', 0.1);
  }

  _generatePhrase(mood, currentChord) {
    const [minLen, maxLen] = mood.phraseLength;
    const length = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
    const scale = mood.melodyScale;

    // Start on a chord tone that exists in the melody scale
    const chordTonesInScale = currentChord
      .flatMap(f => scale.filter(s => Math.abs(s - f) < 1 || Math.abs(s - f * 2) < 1))
      .filter(f => f >= scale[0] && f <= scale[scale.length - 1]);
    const startPool = chordTonesInScale.length > 0 ? chordTonesInScale : scale;
    const startNote = startPool[Math.floor(Math.random() * startPool.length)];

    const phrase = [startNote];
    let currentIdx = scale.indexOf(startNote);
    if (currentIdx === -1) currentIdx = Math.floor(scale.length / 2);

    for (let i = 1; i < length; i++) {
      if (Math.random() < 0.3) {
        // Leap to a chord tone in scale
        const leapPool = chordTonesInScale.length > 0 ? chordTonesInScale : scale;
        const target = leapPool[Math.floor(Math.random() * leapPool.length)];
        currentIdx = scale.indexOf(target);
        if (currentIdx === -1) currentIdx = Math.floor(scale.length / 2);
        phrase.push(target);
      } else {
        // Stepwise motion with direction bias
        const bias = mood.directionBias;
        const direction = (Math.random() + bias > 0.5) ? 1 : -1;
        currentIdx = Math.max(0, Math.min(scale.length - 1, currentIdx + direction));
        phrase.push(scale[currentIdx]);
      }
    }

    return phrase;
  }

  startAmbient(floorNumber) {
    const biome = getBiome(floorNumber);
    this.startAmbientBiome(biome);
  }

  startAmbientBiome(biomeKey) {
    if (!this.ctx) return;
    this.ensureContext();
    this.stopAmbient();

    const profile = BIOME_PROFILES[biomeKey] || BIOME_PROFILES.dungeon;
    const mood = MOOD_GROUPS[profile.mood];

    // Pick a random progression from this mood
    const progression = mood.progressions[Math.floor(Math.random() * mood.progressions.length)];
    let chordIndex = 0;
    let currentChord = progression[0];

    // --- Pad layer: 3 oscillators playing chord tones ---
    const padOscs = currentChord.map(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = profile.padWave;
      osc.frequency.value = freq;
      return osc;
    });

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = profile.filterFreq;

    const padGain = this.ctx.createGain();
    padGain.gain.value = profile.padVolume * this.ambientVolume;

    padOscs.forEach(osc => {
      osc.connect(padFilter);
      osc.start();
    });
    padFilter.connect(padGain);
    padGain.connect(this.ctx.destination);

    // --- Bass layer: single osc one octave below chord root ---
    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = currentChord[0] / 2;

    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 100;

    const bassGain = this.ctx.createGain();
    bassGain.gain.value = profile.bassVolume * this.ambientVolume;

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start();

    // --- Chord progression timer ---
    const advanceChord = () => {
      chordIndex = (chordIndex + 1) % progression.length;
      currentChord = progression[chordIndex];
      const now = this.ctx.currentTime;
      const glide = 2.0;

      // Glide pad oscillators to new chord tones
      padOscs.forEach((osc, i) => {
        const target = currentChord[i % currentChord.length];
        osc.frequency.linearRampToValueAtTime(target, now + glide);
      });

      // Glide bass to new root
      bassOsc.frequency.linearRampToValueAtTime(currentChord[0] / 2, now + glide);
    };

    const chordInterval = setInterval(advanceChord, profile.chordDuration);

    // --- Melody phrase layer ---
    const playPhrase = () => {
      if (!this.ctx || !this.ambientNode) return;

      const chord = this.ambientNode.getCurrentChord();
      const phrase = this._generatePhrase(mood, chord);
      const [minSpacing, maxSpacing] = mood.noteSpacing;
      const now = this.ctx.currentTime;

      phrase.forEach((freq, i) => {
        const noteTime = now + i * (minSpacing + Math.random() * (maxSpacing - minSpacing)) / 1000;
        const duration = 0.6 + Math.random() * 0.8;

        const osc = this.ctx.createOscillator();
        osc.type = profile.melodyWave;
        osc.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, noteTime);
        gain.gain.linearRampToValueAtTime(profile.melodyVolume * this.ambientVolume, noteTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + duration);
      });

      // Accent: chance to play a high chord-tone ping after the phrase
      if (Math.random() < mood.accentChance) {
        const accentDelay = phrase.length * maxSpacing / 1000 + 0.2;
        const accentTime = now + accentDelay;
        const accentPool = mood.accentScale;
        const accentFreq = accentPool[Math.floor(Math.random() * accentPool.length)];
        const accentDur = 0.3 + Math.random() * 0.4;

        const accentOsc = this.ctx.createOscillator();
        accentOsc.type = profile.melodyWave;
        accentOsc.frequency.value = accentFreq;

        const accentGain = this.ctx.createGain();
        accentGain.gain.setValueAtTime(0.001, accentTime);
        accentGain.gain.linearRampToValueAtTime(profile.accentVolume * this.ambientVolume, accentTime + 0.08);
        accentGain.gain.exponentialRampToValueAtTime(0.001, accentTime + accentDur);

        accentOsc.connect(accentGain);
        accentGain.connect(this.ctx.destination);
        accentOsc.start(accentTime);
        accentOsc.stop(accentTime + accentDur);
      }

      // Schedule next phrase
      const [minPause, maxPause] = mood.phrasePause;
      const nextDelay = minPause + Math.random() * (maxPause - minPause);
      const timeout = setTimeout(playPhrase, nextDelay);
      if (this.ambientNode) {
        this.ambientNode.melodyTimeout = timeout;
      }
    };

    // Start first phrase after a short delay
    const initialDelay = 2000 + Math.random() * 3000;
    const initialTimeout = setTimeout(playPhrase, initialDelay);

    // --- Store references for cleanup ---
    this.ambientNode = {
      padOscs,
      bassOsc,
      padGain,
      bassGain,
      chordInterval,
      melodyTimeout: initialTimeout,
      getCurrentChord: () => currentChord,
      profile,
      mood,
    };
  }

  stopAmbient() {
    if (this.ambientNode) {
      // Stop pad oscillators
      if (this.ambientNode.padOscs) {
        this.ambientNode.padOscs.forEach(osc => {
          try { osc.stop(); } catch (e) {}
        });
      }
      // Stop bass
      if (this.ambientNode.bassOsc) {
        try { this.ambientNode.bassOsc.stop(); } catch (e) {}
      }
      // Clear timers
      if (this.ambientNode.chordInterval) {
        clearInterval(this.ambientNode.chordInterval);
      }
      if (this.ambientNode.melodyTimeout) {
        clearTimeout(this.ambientNode.melodyTimeout);
      }
      this.ambientNode = null;
    }
  }
}
