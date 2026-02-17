# Ambient BGM Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the random single-note ambient droning with chord-driven generative music featuring chord progressions, multi-oscillator pads, bass, and melodic phrase generation.

**Architecture:** All changes are within `src/audio.js`. The flat `BIOME_AUDIO` config is replaced by two layers: mood groups (chord progressions, melody rules) and biome profiles (timbre, filter, tempo). The `startAmbientBiome()` method is rewritten to create four harmonically-locked layers (pad, bass, melody, accent) driven by a chord progression timer. Public API is unchanged.

**Tech Stack:** Vanilla JS, Web Audio API oscillators and gain nodes. No dependencies.

---

### Task 1: Replace NOTES and BIOME_AUDIO with new data structures

**Files:**
- Modify: `src/audio.js:1-99`

**Step 1: Replace the data section at the top of audio.js (lines 1-99)**

Replace everything from line 1 through line 99 (the closing `};` of `BIOME_AUDIO`) with the new data structures below. Keep the `import { getBiome }` line.

```js
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
```

**Step 2: Run tests to verify nothing broke**

Run: `npm test`
Expected: All existing tests pass (no audio tests exist, but imports shouldn't break other modules).

**Step 3: Commit**

```bash
git add src/audio.js
git commit -m "refactor: replace flat BIOME_AUDIO with mood groups and biome profiles"
```

---

### Task 2: Rewrite startAmbientBiome — pad and bass layers

**Files:**
- Modify: `src/audio.js:312-403` (the `startAmbientBiome` method)

**Step 1: Rewrite `startAmbientBiome` with pad chord and bass layers**

Replace the entire `startAmbientBiome` method (lines 312-403) with this implementation. The chord progression timer, multi-oscillator pad, and bass oscillator are the core of the new system. Melody and accent will be added in Task 3.

```js
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
    padGain.gain.value = profile.padVolume * this.volume;

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
    bassGain.gain.value = profile.bassVolume * this.volume;

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

    // --- Melody phrase scheduling (placeholder — implemented in Task 3) ---

    // --- Store references for cleanup ---
    this.ambientNode = {
      padOscs,
      bassOsc,
      padGain,
      bassGain,
      chordInterval,
      melodyTimeout: null,
      getCurrentChord: () => currentChord,
      profile,
      mood,
    };
  }
```

**Step 2: Update `stopAmbient` to clean up new node structure**

Replace the `stopAmbient` method (lines 405-416) with:

```js
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
```

**Step 3: Build and manually test**

Run: `npm run build`
Expected: Builds without errors.

Manual test: Open `dist/diegeist.html`, start a dungeon run, verify you hear a multi-note pad chord with bass underneath, and that chord changes are audible every ~7-8 seconds. No melody yet (that's Task 3).

**Step 4: Commit**

```bash
git add src/audio.js
git commit -m "feat: chord-driven pad and bass layers for ambient BGM"
```

---

### Task 3: Add melody phrase generation

**Files:**
- Modify: `src/audio.js` — inside `startAmbientBiome`, replace the melody placeholder

**Step 1: Add the `_generatePhrase` helper method to AudioManager**

Add this method to the AudioManager class, above `startAmbient`:

```js
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
```

**Step 2: Add melody and accent scheduling inside `startAmbientBiome`**

Replace the `// --- Melody phrase scheduling (placeholder — implemented in Task 3) ---` comment with:

```js
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
        gain.gain.linearRampToValueAtTime(profile.melodyVolume * this.volume, noteTime + 0.1);
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
        const chord = this.ambientNode.getCurrentChord();
        const accentPool = mood.accentScale;
        const accentFreq = accentPool[Math.floor(Math.random() * accentPool.length)];
        const accentDur = 0.3 + Math.random() * 0.4;

        const accentOsc = this.ctx.createOscillator();
        accentOsc.type = profile.melodyWave;
        accentOsc.frequency.value = accentFreq;

        const accentGain = this.ctx.createGain();
        accentGain.gain.setValueAtTime(0.001, accentTime);
        accentGain.gain.linearRampToValueAtTime(profile.accentVolume * this.volume, accentTime + 0.08);
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
```

Also update the `this.ambientNode` assignment at the bottom to use `initialTimeout`:

```js
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
```

**Step 3: Build and manually test**

Run: `npm run build`
Expected: Builds without errors.

Manual test: Open `dist/diegeist.html`, start a run. Verify:
- Pad plays audible chords (not single tones)
- Bass provides low foundation
- Melody plays short recognizable phrases (2-4 notes in sequence), not isolated random pings
- Accent pings occur occasionally after phrases
- Chords change every 6-8 seconds and all layers follow
- Different biomes sound distinct (try town vs dungeon)

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/audio.js
git commit -m "feat: add melodic phrase generation and accent layer to ambient BGM"
```

---

### Task 4: Tune and polish

**Files:**
- Modify: `src/audio.js` — volume/timing tweaks only

**Step 1: Playtest each biome and adjust**

Build and play through each biome. Listen for:
- Volume balance: pad shouldn't overpower melody, bass shouldn't boom
- Chord transitions: glides should be smooth, not jarring
- Phrase density: not too sparse (boring), not too dense (annoying)
- Filter cutoffs: cave biomes should sound muffled, jungle warmer

Adjust values in `BIOME_PROFILES` and `MOOD_GROUPS` as needed. These are the most likely knobs:
- `padVolume`, `bassVolume`, `melodyVolume`, `accentVolume`
- `filterFreq` (lower = more muffled)
- `chordDuration` (higher = slower chord changes)
- `phrasePause` ranges (higher = more silence between phrases)
- `noteSpacing` ranges (higher = slower phrases)

**Step 2: Final build and test**

Run: `npm run build && npm test`
Expected: Clean build, all tests pass.

**Step 3: Commit**

```bash
git add src/audio.js
git commit -m "chore: tune ambient BGM volumes and timing"
```
