# Ambient BGM Redesign: Chord-Driven Generative Music

## Problem

The current ambient BGM sounds like random droning — a single pad oscillator gliding between unrelated notes, with isolated random melody pings. No harmonic structure, no musical phrases, no sense of progression.

## Approach

Replace the flat random system with chord-driven generative music. A chord progression drives all layers harmonically so everything consonates automatically. Melody becomes short generated phrases instead of isolated notes.

## Mood Groups

Three mood groups, each with 2-3 chord progressions that cycle:

| Group | Biomes | Feel |
|-------|--------|------|
| Oppressive | stone_cave, dungeon | Minor chords, slow, low register, dissonant |
| Mysterious | jungle, dirt_cave | Suspended/ambiguous chords, moderate pace, mid register |
| Peaceful | town | Major/open chords, gentle, brighter register |

Example progressions (as scale degree shorthand):
- **Oppressive**: Am-Dm-Em-Am, Am-F-Dm-Am
- **Mysterious**: Am-C-G-Em, C-Am-F-G
- **Peaceful**: C-G-Am-F, F-C-G-Am

Chords defined as arrays of 3-4 frequencies. Progression advances every 6-8 seconds with crossfade.

## Layer Architecture

Four layers, all harmonically locked to the current chord:

### 1. Pad (continuous)
2-3 oscillators playing chord tones simultaneously through a low-pass filter. On chord change, each oscillator glides to new chord tones over ~2 seconds.

### 2. Bass (continuous, new)
Single low sine oscillator playing the chord root one octave below the pad. Very quiet. Glides to new root on chord change.

### 3. Melody (intermittent)
Short 2-4 note phrases generated on the fly:
- Start note: picked from current chord tones
- Subsequent notes: 70% stepwise motion (adjacent scale note), 30% leap to chord tone
- Direction tendency: each phrase biases ascending or descending
- Rhythm: 200-400ms between notes within a phrase, 4-10 seconds between phrases

Per-mood variation:
- **Oppressive**: 2-3 notes, slower spacing (350-500ms), lower register, descending bias
- **Mysterious**: 2-4 notes, moderate spacing (250-400ms), mid register, no bias
- **Peaceful**: 3-4 notes, quicker spacing (200-300ms), higher register, ascending bias

### 4. Accent (sparse)
High register pings constrained to chord tones only. Triggered probabilistically, same as current.

## Biome Profiles

Each biome references a mood group for harmony and adds its own timbre:

| Biome | Mood | Pad Wave | Melody Wave | Filter | Tempo |
|-------|------|----------|-------------|--------|-------|
| stone_cave | oppressive | square | square | 120 Hz | Slowest (8s chords) |
| dungeon | oppressive | sawtooth | sawtooth | 80 Hz | Slow (8s chords) |
| jungle | mysterious | triangle | triangle | 200 Hz | Moderate (7s chords) |
| dirt_cave | mysterious | sine | sine | 150 Hz | Moderate-slow (7s chords) |
| town | peaceful | sine | sine | 250 Hz | Gentle (6s chords) |

Volumes stay in the same ballpark as current (~0.01-0.02 range).

## Scope

- All changes within `src/audio.js`
- Public API unchanged: `startAmbient()`, `startAmbientBiome()`, `stopAmbient()`
- No new files, no new dependencies
- Data structures at top of file reorganized: mood groups + biome profiles replace flat BIOME_AUDIO object
