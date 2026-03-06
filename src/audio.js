// src/audio.js
// ═══════════════════════════════════════════════════════════════════
// diegeist audio — snes-style tracker music + sfx
// ═══════════════════════════════════════════════════════════════════
import { getBiome } from './constants.js';


// ─── note frequencies ───────────────────────────────────────────────
const N = {
  // octave 2
  E2:  82.41,  A2: 110.00, Bb2: 116.54, B2: 123.47,
  // octave 3
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
  A3: 220.00, Bb3: 233.08, B3: 246.94,
  // octave 4
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63,
  F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
  // octave 5
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 784.00,
};


// ─── pattern helpers ────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// creates a 32-step pattern from sparse note definitions.
// each note: [step, freq, durationSteps, velocity(0-1, optional)]
// unoccupied steps are null (silence).
function pat(...notes) {
  const p = new Array(32).fill(null);
  for (const n of notes) {
    const [step, freq, dur, vel] = n;
    p[step] = { f: freq, d: dur, v: vel ?? 1.0 };
  }
  return p;
}

// creates a 32-step arp pattern from chord blocks.
// each block: [startStep, [chordTones...], durationSteps]
// rapidly cycles through chord tones at 16th-note speed.
function arp(...blocks) {
  const p = new Array(32).fill(null);
  for (const [start, tones, dur] of blocks) {
    for (let i = 0; i < dur; i++) {
      p[start + i] = { f: tones[i % tones.length], d: 1, v: 0.7 };
    }
  }
  return p;
}

// creates a 32-step noise/percussion pattern.
// each hit: [step, durationSteps, filterFreq, velocity(optional)]
// low filterFreq (< 1000) → kick, high → hat.
function perc(...hits) {
  const p = new Array(32).fill(null);
  for (const h of hits) {
    const [step, dur, ff, vel] = h;
    p[step] = { d: dur, ff: ff, v: vel ?? 1.0 };
  }
  return p;
}


// ═══════════════════════════════════════════════════════════════════
// composed patterns — 32 steps = 2 bars at 16th-note resolution
// quarter = 4 steps, eighth = 2, half = 8, whole = 16
// ═══════════════════════════════════════════════════════════════════


// ─── town (c major, 110 bpm) ───────────────────────────────────────
// feel: warm, welcoming, lilting. shop-browsing music.

const TOWN_LEAD = [
  // "the greeting" — ascending, optimistic
  pat(
    [0,  N.E4, 2],  [2,  N.G4, 2],  [4,  N.A4, 4],
    [8,  N.G4, 2],  [10, N.E4, 2],  [12, N.D4, 4],
    [16, N.C4, 4],  [20, N.D4, 2],  [22, N.E4, 2],
    [24, N.G4, 4],  [28, N.E4, 4],
  ),
  // "playful" — bouncy eighth-note rhythm
  pat(
    [0,  N.G4, 2],  [2,  N.A4, 2],  [4,  N.G4, 2],  [6,  N.E4, 2],
    [8,  N.D4, 2],  [10, N.E4, 2],  [12, N.G4, 4],
    [16, N.A4, 4],  [20, N.G4, 2],  [22, N.E4, 2],
    [24, N.D4, 2],  [26, N.C4, 2],  [28, N.D4, 4],
  ),
  // "resolve" — starts high, descends to rest on tonic
  pat(
    [0,  N.C5, 4],  [4,  N.A4, 2],  [6,  N.G4, 2],
    [8,  N.E4, 4],  [14, N.D4, 2],
    [16, N.E4, 2],  [18, N.G4, 2],  [20, N.E4, 4],
    [24, N.C4, 8],
  ),
  // "echo phrase" — sparse, lets the delay fill space
  pat(
    [0,  N.E4, 3],  [6,  N.G4, 3],
    [12, N.A4, 3],
    [20, N.G4, 3],  [26, N.E4, 6],
  ),
];

const TOWN_BASS = [
  // I-IV-V-I, half-note roots
  pat(
    [0,  N.C3, 7],  [8,  N.F3, 7],
    [16, N.G3, 7],  [24, N.C3, 7],
  ),
  // I-vi-IV-V, adds a touch of minor color
  pat(
    [0,  N.C3, 7],  [8,  N.A2, 7],
    [16, N.F3, 7],  [24, N.G3, 7],
  ),
  // walking bass — more animated, quarter-note motion
  pat(
    [0,  N.C3, 3],  [4,  N.E3, 3],  [8,  N.F3, 3],  [12, N.A3, 3],
    [16, N.G3, 3],  [20, N.E3, 3],  [24, N.D3, 3],  [28, N.C3, 3],
  ),
];

const TOWN_ARP = [
  // C-F-G-C — matches bass pattern a
  arp(
    [0,  [N.C4, N.E4, N.G4], 8],
    [8,  [N.F4, N.A4, N.C5], 8],
    [16, [N.G4, N.B4, N.D5], 8],
    [24, [N.C4, N.E4, N.G4], 8],
  ),
  // C-Am-F-G — matches bass pattern b
  arp(
    [0,  [N.C4, N.E4, N.G4], 8],
    [8,  [N.A3, N.C4, N.E4], 8],
    [16, [N.F4, N.A4, N.C5], 8],
    [24, [N.G4, N.B4, N.D5], 8],
  ),
  // sparse half-speed arp — breathing room
  arp(
    [0,  [N.C4, N.E4], 4],
    [8,  [N.F4, N.A4], 4],
    [16, [N.G4, N.B4], 4],
    [24, [N.C4, N.E4], 4],
  ),
];


// ─── jungle (e minor, 95 bpm) ──────────────────────────────────────
// feel: alive, rhythmic, syncopated. tribal undertone.

const JNG_LEAD = [
  // "canopy" — syncopated, bouncy, starts on upbeats
  pat(
    [0,  N.E4, 2],  [3,  N.G4, 2],  [6,  N.A4, 2],
    [8,  N.B4, 4],  [14, N.A4, 2],
    [16, N.G4, 2],  [19, N.E4, 2],  [22, N.D4, 2],
    [24, N.E4, 4],  [30, N.G4, 2],
  ),
  // "river" — flowing stepwise, descends then rises
  pat(
    [0,  N.B4, 3],  [4,  N.A4, 2],  [6,  N.G4, 2],
    [8,  N.E4, 2],  [10, N.D4, 2],  [12, N.E4, 4],
    [16, N.G4, 2],  [18, N.A4, 2],  [20, N.B4, 4],
    [24, N.A4, 2],  [28, N.G4, 4],
  ),
  // "call" — short motif with space for echo to ring
  pat(
    [0,  N.E4, 2],  [2,  N.G4, 2],  [4,  N.B4, 4],
    [12, N.A4, 2],  [14, N.G4, 2],  [16, N.E4, 6],
    [24, N.G4, 3],  [28, N.A4, 4],
  ),
  // "bird call" — high register, sparse, echoing
  pat(
    [2,  N.B4, 2],  [6,  N.E5, 3],
    [16, N.D5, 2],  [20, N.B4, 4],
  ),
];

const JNG_BASS = [
  // Em-Am-Bm-Em — solid foundation
  pat(
    [0,  N.E2, 7],  [8,  N.A2, 7],
    [16, N.B2, 7],  [24, N.E2, 7],
  ),
  // walking bass — keeps momentum going
  pat(
    [0,  N.E2, 3],  [4,  N.G3, 3],  [8,  N.A2, 3],  [12, N.B2, 3],
    [16, N.A2, 3],  [20, N.G3, 3],  [24, N.E2, 3],  [28, N.D3, 3],
  ),
  // Em-G-Am-Em — softer harmonic motion
  pat(
    [0,  N.E2, 7],  [8,  N.G3, 7],
    [16, N.A2, 7],  [24, N.E2, 7],
  ),
];

const JNG_PERC = [
  // syncopated kick with busy hats — tribal energy
  perc(
    [0,  2, 100],       [6,  1, 5000, 0.35],
    [8,  2, 100],       [12, 1, 5000, 0.3],  [14, 1, 5000, 0.3],
    [16, 2, 100],       [22, 1, 5000, 0.35],
    [24, 2, 100],       [28, 1, 5000, 0.3],  [30, 1, 5000, 0.3],
  ),
  // offbeat emphasis — push-pull feel
  perc(
    [2,  2, 100, 0.8],  [6,  1, 5000, 0.3],
    [10, 2, 100],        [14, 1, 5000, 0.3],
    [18, 2, 100, 0.8],  [22, 1, 5000, 0.3],
    [26, 2, 100],        [30, 1, 5000, 0.3],
  ),
  // sparse — breathing room between busy patterns
  perc(
    [0,  2, 100],       [12, 1, 5000, 0.4],
    [16, 2, 100],       [28, 1, 5000, 0.4],
  ),
];


// ─── cave (a minor, 60 bpm) ────────────────────────────────────────
// feel: underground, still, dripping water. melody barely exists.
// the echo does most of the work here — long delay, high feedback.

const CAVE_LEAD = [
  // "echo" — one phrase, vast space around it
  pat(
    [0,  N.E4, 6],
    [20, N.A3, 8],
  ),
  // "whisper" — mid-register, offset timing
  pat(
    [8,  N.C4, 6],
    [24, N.D4, 6],
  ),
  // "sigh" — single long tone, the echo does the rest
  pat(
    [12, N.E4, 10],
  ),
  // silence — lead drops out completely, just bass and drips
  pat(),
];

const CAVE_BASS = [
  // root drone — barely changes, sets the floor
  pat(
    [0,  N.A2, 15],
    [16, N.A2, 15],
  ),
  // root to fifth — minimal motion
  pat(
    [0,  N.A2, 15],
    [16, N.E2, 15],
  ),
  // root to minor third — gentle harmonic shift
  pat(
    [0,  N.A2, 15],
    [16, N.C3, 15],
  ),
];

const CAVE_DRIP = [
  // three drips — irregular spacing, varying velocity
  pat(
    [3,  N.C5, 1, 0.5],
    [11, N.E5, 1, 0.4],
    [22, N.G5, 1, 0.6],
  ),
  // two drips — wider spacing
  pat(
    [7,  N.E5, 1, 0.5],
    [19, N.C5, 1, 0.4],
  ),
  // single drip — maximum emptiness
  pat(
    [15, N.G5, 1, 0.3],
  ),
  // no drips — pure silence on this channel
  pat(),
];


// ─── dungeon (a minor, 80 bpm) ─────────────────────────────────────
// feel: oppressive, rhythmic, dangerous. percussion drives tension.

const DNG_LEAD = [
  // "creeping" — sparse, mostly low register
  pat(
    [0,  N.A3, 4],
    [8,  N.C4, 3],
    [20, N.B3, 2],  [24, N.A3, 6],
  ),
  // "descending dread" — starts mid, sinks down
  pat(
    [4,  N.E4, 6],
    [16, N.D4, 4],
    [24, N.C4, 3],  [28, N.A3, 4],
  ),
  // "almost silence" — two notes, maximum tension through absence
  pat(
    [12, N.E4, 4],
    [28, N.A3, 3],
  ),
  // "question" — rising phrase, unresolved, leaves you uneasy
  pat(
    [2,  N.A3, 2],  [6,  N.C4, 2],
    [10, N.D4, 3],
    [18, N.E4, 6],
  ),
];

const DNG_BASS = [
  // oppressive drone on root — relentless
  pat(
    [0,  N.A2, 14],
    [16, N.A2, 14],
  ),
  // root and fifth alternating — breathing, but barely
  pat(
    [0,  N.A2, 7],  [8,  N.E2, 7],
    [16, N.A2, 7],  [24, N.E2, 7],
  ),
  // iv-V tension — builds toward something
  pat(
    [0,  N.A2, 7],  [8,  N.A2, 7],
    [16, N.D3, 7],  [24, N.E3, 7],
  ),
];

const DNG_PERC = [
  // steady quarter-note kick, offbeat hats
  perc(
    [0,  2, 100],  [8,  2, 100],  [16, 2, 100],  [24, 2, 100],
    [4,  1, 5000, 0.4],  [12, 1, 5000, 0.4],
    [20, 1, 5000, 0.4],  [28, 1, 5000, 0.4],
  ),
  // sparse — kick on 1 and 3, ghost hats
  perc(
    [0,  3, 100],       [16, 3, 100],
    [12, 1, 5000, 0.3], [28, 1, 5000, 0.3],
  ),
  // hats only — lightest, most restrained
  perc(
    [4,  1, 6000, 0.25], [12, 1, 6000, 0.25],
    [20, 1, 6000, 0.25], [28, 1, 6000, 0.25],
  ),
];


// ─── eldritch (chromatic, 70 bpm) ──────────────────────────────────
// feel: wrong. tritones, minor 2nds, stuttering rhythm.
// no percussion — the absence of steady pulse is part of the unease.

const ELD_LEAD = [
  // "the watching" — tritone tension, E against Bb
  pat(
    [0,  N.E3, 4],
    [12, N.Bb3, 6],
    [24, N.A3, 6],
  ),
  // "crawling" — minor 2nd friction, E against F
  pat(
    [4,  N.A3, 3],   [8,  N.Bb3, 5],
    [20, N.E4, 4],   [26, N.F4, 4],
  ),
  // "the void stares back" — single dissonant note, alone
  pat(
    [14, N.Bb4, 8],
  ),
  // silence — sometimes nothing is the scariest sound
  pat(),
  // "signal" — stuttering repetition, uncomfortable rhythm
  pat(
    [0,  N.E3, 1],  [2,  N.E3, 1],  [5,  N.E3, 1],
    [16, N.Bb3, 4],
  ),
];

const ELD_BASS = [
  // tritone oscillation — E and Bb, the devil's interval
  pat(
    [0,  N.E2, 7],   [8,  N.Bb2, 7],
    [16, N.E2, 7],   [24, N.Bb2, 7],
  ),
  // semitone creep — A sliding to Bb, skin-crawling
  pat(
    [0,  N.A2, 7],   [8,  N.Bb2, 7],
    [16, N.A2, 7],   [24, N.E2, 7],
  ),
  // static drone on E — the floor falls away, only the root remains
  pat(
    [0,  N.E2, 15],
    [16, N.E2, 15],
  ),
];

const ELD_TEXTURE = [
  // dissonant high pings — like something tapping on the other side
  pat(
    [6,  N.Bb4, 2, 0.4],
    [18, N.E5, 2, 0.3],
    [28, N.F4, 2, 0.5],
  ),
  // cluster — two notes a semitone apart, nearly simultaneous
  pat(
    [0,  N.E4, 1, 0.3],  [1,  N.F4, 1, 0.3],
    [16, N.Bb4, 3, 0.4],
  ),
  // single alien ping
  pat(
    [10, N.Eb4, 2, 0.35],
  ),
  // silence — texture drops out, just bass and lead (or neither)
  pat(),
];


// ═══════════════════════════════════════════════════════════════════
// track definitions
// ═══════════════════════════════════════════════════════════════════

const TRACKS = {
  town: {
    bpm: 110,
    echo: { delay: 0.18, feedback: 0.25, wet: 0.3, filterFreq: 3500 },
    channels: [
      {
        name: 'lead',
        wave: 'pulse25',
        patterns: TOWN_LEAD,
        volume: 0.055,
        echoSend: 0.6,
        envelope: { a: 0.008, d: 0.06, s: 0.7, r: 0.08 },
      },
      {
        name: 'arp',
        wave: 'pulse12',
        patterns: TOWN_ARP,
        volume: 0.022,
        echoSend: 0.3,
        envelope: { a: 0.003, d: 0.02, s: 0.6, r: 0.015 },
      },
      {
        name: 'bass',
        wave: 'triangle',
        patterns: TOWN_BASS,
        volume: 0.065,
        echoSend: 0.0,
        envelope: { a: 0.005, d: 0.08, s: 0.8, r: 0.1 },
      },
    ],
  },

  jungle: {
    bpm: 95,
    // warm echo, medium length — sounds like it's bouncing off trees
    echo: { delay: 0.22, feedback: 0.28, wet: 0.25, filterFreq: 2800 },
    channels: [
      {
        name: 'lead',
        wave: 'pulse25',
        patterns: JNG_LEAD,
        volume: 0.045,
        echoSend: 0.5,
        // snappier envelope than town — more rhythmic, percussive feel
        envelope: { a: 0.005, d: 0.04, s: 0.65, r: 0.06 },
      },
      {
        name: 'bass',
        wave: 'triangle',
        patterns: JNG_BASS,
        volume: 0.06,
        echoSend: 0.0,
        envelope: { a: 0.008, d: 0.1, s: 0.8, r: 0.1 },
      },
      {
        name: 'perc',
        wave: 'noise',
        patterns: JNG_PERC,
        volume: 0.035,
        echoSend: 0.1,
        envelope: { a: 0.003, d: 0.04, s: 0.3, r: 0.03 },
      },
    ],
  },

  cave: {
    bpm: 60,
    // very long delay, high feedback, dark filter — vast underground space.
    // the echo practically becomes its own instrument here.
    echo: { delay: 0.4, feedback: 0.4, wet: 0.4, filterFreq: 1200 },
    channels: [
      {
        name: 'lead',
        wave: 'sine',          // sine for pure, haunting tones
        patterns: CAVE_LEAD,
        volume: 0.035,
        echoSend: 0.8,         // almost everything goes to echo
        // slow attack, long release — notes breathe in and fade out
        envelope: { a: 0.05, d: 0.15, s: 0.6, r: 0.2 },
      },
      {
        name: 'bass',
        wave: 'triangle',
        patterns: CAVE_BASS,
        volume: 0.045,
        echoSend: 0.05,        // bass stays grounded
        envelope: { a: 0.02, d: 0.2, s: 0.85, r: 0.15 },
      },
      {
        name: 'drip',
        wave: 'sine',          // sine pings — water dripping from stalactites
        patterns: CAVE_DRIP,
        volume: 0.03,
        echoSend: 0.9,         // drips are almost entirely echo
        // extremely short envelope — tiny pluck, then the reverb takes over
        envelope: { a: 0.002, d: 0.01, s: 0.3, r: 0.02 },
      },
    ],
  },

  dungeon: {
    bpm: 80,
    // long delay, dark filter — stone corridors
    echo: { delay: 0.28, feedback: 0.35, wet: 0.25, filterFreq: 1800 },
    channels: [
      {
        name: 'lead',
        wave: 'pulse25',
        patterns: DNG_LEAD,
        volume: 0.04,
        echoSend: 0.7,
        envelope: { a: 0.015, d: 0.1, s: 0.6, r: 0.15 },
      },
      {
        name: 'bass',
        wave: 'triangle',
        patterns: DNG_BASS,
        volume: 0.06,
        echoSend: 0.05,
        envelope: { a: 0.01, d: 0.15, s: 0.85, r: 0.12 },
      },
      {
        name: 'perc',
        wave: 'noise',
        patterns: DNG_PERC,
        volume: 0.04,
        echoSend: 0.15,
        envelope: { a: 0.003, d: 0.05, s: 0.3, r: 0.04 },
      },
    ],
  },

  eldritch: {
    bpm: 70,
    // long, dark, lots of feedback — sounds pile up and smear together.
    // the 1000hz filter makes repeats muddy and indistinct. intentional.
    echo: { delay: 0.35, feedback: 0.4, wet: 0.3, filterFreq: 1000 },
    channels: [
      {
        name: 'lead',
        wave: 'pulse25',
        patterns: ELD_LEAD,
        volume: 0.035,
        echoSend: 0.7,
        // slow attack gives notes a creeping-in quality
        envelope: { a: 0.02, d: 0.12, s: 0.5, r: 0.2 },
      },
      {
        name: 'bass',
        wave: 'triangle',
        patterns: ELD_BASS,
        volume: 0.055,
        echoSend: 0.1,
        envelope: { a: 0.015, d: 0.2, s: 0.8, r: 0.15 },
      },
      {
        name: 'texture',
        wave: 'pulse12',      // thin, buzzy — alien/wrong timbre
        patterns: ELD_TEXTURE,
        volume: 0.02,
        echoSend: 0.6,
        envelope: { a: 0.01, d: 0.03, s: 0.4, r: 0.05 },
      },
    ],
  },
};


// ─── biome → track mapping ──────────────────────────────────────────
const BIOME_TRACK_MAP = {
  town:       'town',
  jungle:     'jungle',
  dirt_cave:  'cave',
  stone_cave: 'cave',
  cave:       'cave',
  dungeon:    'dungeon',
  wilds:      'jungle',
  eldritch:   'eldritch',
};

export const BIOME_KEYS = Object.keys(TRACKS);


// ═══════════════════════════════════════════════════════════════════
// audio manager
// ═══════════════════════════════════════════════════════════════════

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.sfxVolume = 0.7;
    this.ambientVolume = 0.7;
    this._seq = null;
    // custom pulse waveforms (built on init)
    this.pulseWave25 = null;
    this.pulseWave12 = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._buildWaveforms();
    } catch (e) {
      console.warn('web audio api not available');
    }
  }


  // ─── custom waveforms ───────────────────────────────────────────
  // the snes spc700 used 4-bit brr samples, but its most iconic sounds
  // were pulse waves at various duty cycles. web audio only gives us a
  // 50% square natively, so we build 25% and 12.5% from fourier series.
  _buildWaveforms() {
    if (!this.ctx) return;
    const h = 64;

    // 25% pulse — the classic chiptune lead: hollow, slightly nasal
    const real25 = new Float32Array(h);
    const imag25 = new Float32Array(h);
    for (let i = 1; i < h; i++) {
      imag25[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.25);
    }
    this.pulseWave25 = this.ctx.createPeriodicWave(real25, imag25, {
      disableNormalization: false,
    });

    // 12.5% pulse — thinner, buzzier, good for arps and texture
    const real12 = new Float32Array(h);
    const imag12 = new Float32Array(h);
    for (let i = 1; i < h; i++) {
      imag12[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.125);
    }
    this.pulseWave12 = this.ctx.createPeriodicWave(real12, imag12, {
      disableNormalization: false,
    });
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
    if (this._seq && this._seq.masterGain && this.ctx) {
      this._seq.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
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
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * volume;
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
  // ambient music — snes-style pattern sequencer
  // ═══════════════════════════════════════════════════════════════

  // ─── echo bus ─────────────────────────────────────────────────
  // recreates the spc700 echo: delay with filtered feedback loop.
  // each repeat passes through a lowpass, getting progressively
  // darker — this is the defining warmth of snes audio.
  _buildEcho(config) {
    const delay = this.ctx.createDelay(1.0);
    delay.delayTime.value = config.delay;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFreq;

    const feedback = this.ctx.createGain();
    feedback.gain.value = config.feedback;

    const wet = this.ctx.createGain();
    wet.gain.value = config.wet * this.ambientVolume;

    // routing: send → delay → filter → feedback → delay (loop)
    //                                → wet → destination
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);
    filter.connect(wet);
    wet.connect(this.ctx.destination);

    const send = this.ctx.createGain();
    send.gain.value = 1.0;
    send.connect(delay);

    return { send, wet, delay, filter, feedback };
  }


  // ─── schedule a tonal note ────────────────────────────────────
  _scheduleNote(channel, note, time, stepDur, dryBus, echoBus) {
    const dur = note.d * stepDur;
    const vol = channel.volume * note.v * this.ambientVolume;
    const env = channel.envelope;

    const osc = this.ctx.createOscillator();

    // apply waveform
    if (channel.wave === 'pulse25' && this.pulseWave25) {
      osc.setPeriodicWave(this.pulseWave25);
    } else if (channel.wave === 'pulse12' && this.pulseWave12) {
      osc.setPeriodicWave(this.pulseWave12);
    } else {
      osc.type = channel.wave;
    }
    osc.frequency.value = note.f;

    // adsr gain envelope
    const gain = this.ctx.createGain();
    const attack  = Math.min(env.a, dur * 0.25);
    const release = Math.min(env.r, dur * 0.4);
    const sustainStart = time + attack;
    const releaseStart = time + dur - release;

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    if (sustainStart < releaseStart) {
      gain.gain.setTargetAtTime(vol * env.s, sustainStart, env.d);
    }
    if (releaseStart > sustainStart) {
      gain.gain.setValueAtTime(vol * env.s, releaseStart);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(dryBus);

    // echo send
    if (channel.echoSend > 0 && echoBus) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = channel.echoSend;
      gain.connect(sendGain);
      sendGain.connect(echoBus);
    }

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }


  // ─── schedule a noise percussion hit ──────────────────────────
  _scheduleNoise(channel, hit, time, stepDur, dryBus, echoBus) {
    const dur = hit.d * stepDur;
    const vol = channel.volume * hit.v * this.ambientVolume;

    // noise buffer with baked-in envelope curve
    const bufLen = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const pos = i / bufLen;
      const envCurve = pos < 0.05 ? (pos / 0.05) : Math.pow(1 - pos, 2);
      data[i] = (Math.random() * 2 - 1) * envCurve;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    // filter: lowpass for kicks, highpass for hats
    const filter = this.ctx.createBiquadFilter();
    filter.type = hit.ff >= 1000 ? 'highpass' : 'lowpass';
    filter.frequency.value = hit.ff;
    filter.Q.value = hit.ff >= 1000 ? 1 : 3;

    const gain = this.ctx.createGain();
    gain.gain.value = vol;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dryBus);

    if (channel.echoSend > 0 && echoBus) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = channel.echoSend;
      gain.connect(sendGain);
      sendGain.connect(echoBus);
    }

    src.start(time);
  }


  // ─── sequencer: schedule one 2-bar round ──────────────────────
  // each channel independently picks a random pattern from its pool,
  // creating variety through combinatorics without losing musicality.
  _scheduleRound(startTime) {
    if (!this._seq || !this._seq.running) return;

    const track = this._seq.track;
    const stepDur = 60 / track.bpm / 4;  // one 16th note
    const roundDur = 32 * stepDur;        // 2 bars

    for (const channel of track.channels) {
      const pattern = pick(channel.patterns);

      for (let step = 0; step < 32; step++) {
        const note = pattern[step];
        if (!note) continue;

        const noteTime = startTime + step * stepDur;

        if (channel.wave === 'noise') {
          this._scheduleNoise(channel, note, noteTime, stepDur,
            this._seq.masterGain, this._seq.echo.send);
        } else {
          this._scheduleNote(channel, note, noteTime, stepDur,
            this._seq.masterGain, this._seq.echo.send);
        }
      }
    }

    // schedule next round 80ms before this one ends (seamless transition)
    const msUntilNext = (startTime + roundDur - this.ctx.currentTime) * 1000 - 80;
    this._seq.timeout = setTimeout(() => {
      this._scheduleRound(startTime + roundDur);
    }, Math.max(0, msUntilNext));
  }


  // ─── public api ───────────────────────────────────────────────

  startAmbient(floorNumber) {
    const biome = getBiome(floorNumber);
    this.startAmbientBiome(biome);
  }

  startAmbientBiome(biomeKey) {
    if (!this.ctx) return;
    this.ensureContext();
    this.stopAmbient();

    const trackKey = BIOME_TRACK_MAP[biomeKey] || 'dungeon';
    const track = TRACKS[trackKey];
    if (!track) return;

    // master gain for volume control + clean fade-outs
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = this.ambientVolume;
    masterGain.connect(this.ctx.destination);

    const echo = this._buildEcho(track.echo);

    this._seq = {
      running: true,
      track,
      masterGain,
      echo,
      timeout: null,
    };

    this._scheduleRound(this.ctx.currentTime + 0.1);
  }

  stopAmbient() {
    if (!this._seq) return;

    this._seq.running = false;
    if (this._seq.timeout) clearTimeout(this._seq.timeout);

    // 300ms fade-out to avoid clicks
    if (this._seq.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this._seq.masterGain.gain.setValueAtTime(
        this._seq.masterGain.gain.value, now
      );
      this._seq.masterGain.gain.linearRampToValueAtTime(0, now + 0.3);

      if (this._seq.echo?.wet) {
        this._seq.echo.wet.gain.setValueAtTime(
          this._seq.echo.wet.gain.value, now
        );
        this._seq.echo.wet.gain.linearRampToValueAtTime(0, now + 0.3);
      }

      // disconnect after fade
      const ref = this._seq;
      setTimeout(() => {
        try {
          ref.masterGain.disconnect();
          ref.echo.send.disconnect();
          ref.echo.wet.disconnect();
          ref.echo.delay.disconnect();
          ref.echo.filter.disconnect();
          ref.echo.feedback.disconnect();
        } catch (e) { /* already collected */ }
      }, 350);
    }

    this._seq = null;
  }
}