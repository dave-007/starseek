// Procedural ambient music — each system gets a unique loop seeded from its position

// Seeded PRNG (xorshift32)
function makePRNG(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  if (s === 0) s = 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Scales — chosen for their emotional colour range
const SCALES = [
  [0, 3, 5, 7, 10],         // pentatonic minor   — dark, grounded
  [0, 2, 4, 7, 9],          // pentatonic major   — open, hopeful
  [0, 2, 4, 6, 8, 10],      // whole tone         — floating, alien
  [0, 2, 3, 7, 8],          // hirajoshi          — ancient, still
  [0, 1, 4, 6, 8, 10, 11],  // enigmatic          — unsettling, strange
  [0, 2, 4, 6, 7, 9, 11],   // lydian             — luminous, expansive
  [0, 1, 3, 5, 7, 8, 10],   // phrygian           — tense, ancient
  [0, 2, 3, 6, 7, 8, 11],   // double harmonic    — exotic, rich
]

interface NoteEvent {
  time: number
  freq: number
  duration: number
  velocity: number
  oscType: OscillatorType
  filterFreq: number
}

function generateNotes(rand: () => number, loopLength: number): {
  notes: NoteEvent[]
  droneFreq: number | null
  oscType: OscillatorType
  reverbWet: number
} {
  const scale = SCALES[Math.floor(rand() * SCALES.length)]
  const baseNote = 36 + Math.floor(rand() * 28)  // MIDI 36–64 (C2–E4)
  const oscType = (['sine', 'sine', 'triangle', 'triangle', 'sawtooth'] as OscillatorType[])[Math.floor(rand() * 5)]
  const filterFreq = 400 + rand() * 3200
  const density = 0.35 + rand() * 0.45   // 35–80% of steps filled
  const reverbWet = 0.2 + rand() * 0.6

  const stepCount = 8 + Math.floor(rand() * 9)  // 8–16 steps
  const stepDur = loopLength / stepCount

  const notes: NoteEvent[] = []
  for (let i = 0; i < stepCount; i++) {
    if (rand() > density) continue
    const octave = Math.floor(rand() * 3) - 1
    const degree = Math.floor(rand() * scale.length)
    const midi = baseNote + scale[degree] + octave * 12
    notes.push({
      time: i * stepDur + (rand() - 0.5) * stepDur * 0.06, // tiny humanise
      freq: midiToFreq(Math.max(24, Math.min(96, midi))),
      duration: stepDur * (0.25 + rand() * 0.55),
      velocity: 0.25 + rand() * 0.45,
      oscType,
      filterFreq,
    })
  }

  const droneFreq = rand() > 0.45 ? midiToFreq(baseNote) : null
  return { notes, droneFreq, oscType, reverbWet }
}

// Shared AudioContext — created on first user interaction
let sharedCtx: AudioContext | null = null
let sharedReverb: ConvolverNode | null = null
let sharedReverbWet: GainNode | null = null
let sharedReverbDry: GainNode | null = null
let sharedOut: GainNode | null = null

export function unlockAudio() {
  if (sharedCtx) return
  sharedCtx = new AudioContext()

  // Build a simple algorithmic reverb
  const sampleRate = sharedCtx.sampleRate
  const len = sampleRate * 3
  const impulse = sharedCtx.createBuffer(2, len, sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2)
    }
  }
  sharedReverb = sharedCtx.createConvolver()
  sharedReverb.buffer = impulse

  sharedOut = sharedCtx.createGain()
  sharedOut.gain.value = 0.75
  sharedOut.connect(sharedCtx.destination)

  sharedReverbDry = sharedCtx.createGain()
  sharedReverbDry.gain.value = 0.6
  sharedReverbDry.connect(sharedOut)

  sharedReverbWet = sharedCtx.createGain()
  sharedReverbWet.gain.value = 0.4
  sharedReverb.connect(sharedReverbWet)
  sharedReverbWet.connect(sharedOut)
}

export class SystemLoop {
  private masterGain: GainNode | null = null
  private droneOsc: OscillatorNode | null = null
  private active = false
  private loopTimer = -1
  private notes: NoteEvent[] = []
  private droneFreq: number | null = null
  private reverbWet: number = 0.4
  public readonly loopLength: number

  constructor(seed: number) {
    // Derive loop length (4–16 s) and note pattern from seed
    const rand = makePRNG(seed)
    this.loopLength = 4 + rand() * 12
    const gen = generateNotes(makePRNG(seed + 1), this.loopLength)
    this.notes = gen.notes
    this.droneFreq = gen.droneFreq
    this.reverbWet = gen.reverbWet
  }

  start() {
    if (this.active || !sharedCtx) return
    this.active = true

    const ctx = sharedCtx

    this.masterGain = ctx.createGain()
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime)
    this.masterGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.6)

    // Each loop sends to shared reverb dry+wet
    this.masterGain.connect(sharedReverbDry!)
    this.masterGain.connect(sharedReverb!)

    // Optional drone
    if (this.droneFreq) {
      this.droneOsc = ctx.createOscillator()
      this.droneOsc.type = 'sine'
      this.droneOsc.frequency.value = this.droneFreq
      const droneGain = ctx.createGain()
      droneGain.gain.value = 0.06
      this.droneOsc.connect(droneGain)
      droneGain.connect(this.masterGain)
      this.droneOsc.start()
    }

    this.scheduleLoop(ctx.currentTime)
  }

  setVolume(vol: number) {
    if (this.masterGain && sharedCtx) {
      this.masterGain.gain.setTargetAtTime(vol, sharedCtx.currentTime, 0.3)
    }
  }

  stop() {
    if (!this.active || !sharedCtx) return
    this.active = false
    clearTimeout(this.loopTimer)
    this.droneOsc?.stop(sharedCtx.currentTime + 0.5)
    this.droneOsc = null
    this.masterGain?.gain.setTargetAtTime(0, sharedCtx.currentTime, 0.35)
    // Disconnect after fade
    const g = this.masterGain
    window.setTimeout(() => g?.disconnect(), 1500)
    this.masterGain = null
  }

  private scheduleLoop(startTime: number) {
    const ctx = sharedCtx!
    const gain = this.masterGain!

    for (const note of this.notes) {
      const t = startTime + note.time
      if (t < ctx.currentTime - 0.01) continue

      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const env = ctx.createGain()

      osc.type = note.oscType
      osc.frequency.value = note.freq

      filter.type = 'lowpass'
      filter.frequency.value = note.filterFreq
      filter.Q.value = 0.8

      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(note.velocity, t + 0.018)
      env.gain.exponentialRampToValueAtTime(0.001, t + note.duration)

      osc.connect(filter)
      filter.connect(env)
      env.connect(gain)

      osc.start(t)
      osc.stop(t + note.duration + 0.05)
    }

    const loopEnd = startTime + this.loopLength
    const delay = (loopEnd - ctx.currentTime - 0.25) * 1000

    this.loopTimer = window.setTimeout(() => {
      if (this.active && this.masterGain) this.scheduleLoop(loopEnd)
    }, Math.max(0, delay))
  }
}
