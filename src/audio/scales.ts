// Musical scales — migrated from audio.ts with additions

export const SCALES: Record<string, number[]> = {
  pentatonicMinor: [0, 3, 5, 7, 10],       // dark, grounded
  pentatonicMajor: [0, 2, 4, 7, 9],        // open, hopeful
  wholeTone:       [0, 2, 4, 6, 8, 10],    // floating, alien
  hirajoshi:       [0, 2, 3, 7, 8],        // ancient, still
  enigmatic:       [0, 1, 4, 6, 8, 10, 11],// unsettling, strange
  lydian:          [0, 2, 4, 6, 7, 9, 11], // luminous, expansive
  phrygian:        [0, 1, 3, 5, 7, 8, 10], // tense, ancient
  doubleHarmonic:  [0, 2, 3, 6, 7, 8, 11], // exotic, rich
  dorian:          [0, 2, 3, 5, 7, 9, 10], // jazzy, flowing
}

export const SCALE_NAMES = Object.keys(SCALES)

/** Get a random note from scale, constrained to valid MIDI range */
export function scaleNote(scale: number[], root: number, octaveRange: number, rand: () => number): number {
  const octave = Math.floor(rand() * octaveRange) - Math.floor(octaveRange / 2)
  const degree = Math.floor(rand() * scale.length)
  return Math.max(24, Math.min(96, root + scale[degree] + octave * 12))
}

/** MIDI note to frequency */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Frequency to MIDI note (rounded) */
export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440))
}
