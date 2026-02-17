// MusicEngine — Track-based music system
// Each planet is a musical layer that can be toggled on/off

import * as Tone from 'tone'
import { KickTrack, HiHatTrack, BassTrack, ArpTrack, PadTrack, PercTrack, LeadTrack, type Track, type TrackParams, DEFAULT_TRACK_PARAMS } from './tracks/index'
import { SCALES, SCALE_NAMES } from './scales'

// Re-export TrackParams for external use
export type { TrackParams }
export { DEFAULT_TRACK_PARAMS }

// Track types that can be assigned to planets
export type TrackType = 'kick' | 'hihat' | 'perc' | 'bass' | 'arp' | 'pad' | 'lead'

// Order tracks get assigned to planets (inner to outer)
const TRACK_ORDER: TrackType[] = ['kick', 'bass', 'hihat', 'perc', 'arp', 'pad', 'lead']

export class MusicEngine {
  private compressor: Tone.Compressor
  private limiter: Tone.Limiter
  private master: Tone.Gain

  private tracks: Map<TrackType, Track> = new Map()
  private planetTracks: Map<number, TrackType> = new Map() // planet index -> track type

  private playing = false
  private currentScale = SCALES.pentatonicMinor
  private currentRoot = 48

  constructor() {
    // Master chain
    this.master = new Tone.Gain(0.8)
    this.compressor = new Tone.Compressor({
      threshold: -20,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    })
    this.limiter = new Tone.Limiter(-1)

    this.master.connect(this.compressor)
    this.compressor.connect(this.limiter)
    this.limiter.toDestination()

    // Create all tracks
    this.tracks.set('kick', new KickTrack(this.master))
    this.tracks.set('hihat', new HiHatTrack(this.master))
    this.tracks.set('perc', new PercTrack(this.master))
    this.tracks.set('bass', new BassTrack(this.master))
    this.tracks.set('arp', new ArpTrack(this.master))
    this.tracks.set('pad', new PadTrack(this.master))
    this.tracks.set('lead', new LeadTrack(this.master))
  }

  /** Start the transport - all tracks begin sequencing (but muted until toggled) */
  async start() {
    if (this.playing) return

    await Tone.start()

    // Set BPM
    Tone.getTransport().bpm.value = 120

    // Start all track sequences
    this.tracks.forEach(track => track.start())

    this.playing = true
    Tone.getTransport().start()
  }

  stop() {
    if (!this.playing) return

    Tone.getTransport().stop()
    this.tracks.forEach(track => track.stop())
    this.playing = false
  }

  /** Assign tracks to planets based on count */
  assignPlanetTracks(planetCount: number) {
    this.planetTracks.clear()

    for (let i = 0; i < planetCount && i < TRACK_ORDER.length; i++) {
      this.planetTracks.set(i, TRACK_ORDER[i])
    }
  }

  /** Get the track type for a planet */
  getPlanetTrack(planetIdx: number): TrackType | undefined {
    return this.planetTracks.get(planetIdx)
  }

  /** Toggle a planet's track on/off, returns new state */
  togglePlanet(planetIdx: number): boolean {
    const trackType = this.planetTracks.get(planetIdx)
    if (!trackType) return false

    const track = this.tracks.get(trackType)
    if (!track) return false

    const newMuted = !track.isMuted()
    track.setMuted(newMuted)
    return !newMuted // return whether it's now playing
  }

  /** Check if a planet's track is playing */
  isPlanetPlaying(planetIdx: number): boolean {
    const trackType = this.planetTracks.get(planetIdx)
    if (!trackType) return false

    const track = this.tracks.get(trackType)
    return track ? !track.isMuted() : false
  }

  /** Set a planet's track volume level (0-1) based on orbit proximity */
  setPlanetLevel(planetIdx: number, level: number) {
    const trackType = this.planetTracks.get(planetIdx)
    if (!trackType) return

    const track = this.tracks.get(trackType)
    if (!track) return

    // Only set volume - mute state is controlled by toggle
    track.setLevel(level)
  }

  /** Update all planet levels from proximity array - only affects volume, not mute state */
  updatePlanetLevels(proximities: number[]) {
    this.planetTracks.forEach((trackType, planetIdx) => {
      const track = this.tracks.get(trackType)
      if (!track) return

      const proximity = proximities[planetIdx] ?? 1  // 0 = on orbit, 1 = far
      // When track is muted (off), keep level at 0
      // When track is unmuted (on), level follows proximity
      if (track.isMuted()) {
        track.setLevel(0)
      } else {
        // Invert: proximity 0 = full volume, proximity 1 = lower volume (but not silent)
        // Keep a minimum level of 0.3 so active tracks are always audible
        const level = Math.max(0.3, 1 - proximity * 0.7)
        track.setLevel(level)
      }
    })
  }

  /** Set scale and root for melodic tracks */
  setScale(scale: number[], root: number) {
    this.currentScale = scale
    this.currentRoot = root

    // Update melodic tracks
    const bass = this.tracks.get('bass') as BassTrack
    const arp = this.tracks.get('arp') as ArpTrack
    const pad = this.tracks.get('pad') as PadTrack
    const lead = this.tracks.get('lead') as LeadTrack

    bass?.setScale(scale, root)
    arp?.setScale(scale, root + 12)
    pad?.setScale(scale, root)
    lead?.setScale(scale, root + 24)
  }

  /** Generate scale from seed */
  generateFromSeed(seed: number) {
    const scaleIdx = Math.abs(seed) % SCALE_NAMES.length
    const scaleName = SCALE_NAMES[scaleIdx]
    const scale = SCALES[scaleName]
    const root = 36 + (Math.abs(seed * 7) % 12) // C2-B2

    this.setScale(scale, root)
    return { scale, root, scaleName }
  }

  /** Mute all tracks */
  muteAll() {
    this.tracks.forEach(track => track.setMuted(true))
  }

  /** Set BPM */
  setBPM(bpm: number) {
    Tone.getTransport().bpm.value = bpm
  }

  /** Set swing amount (0-0.5) */
  setSwing(swing: number) {
    Tone.getTransport().swing = swing
    Tone.getTransport().swingSubdivision = '16n'
  }

  /** Set master volume (0-1) */
  setMasterVolume(volume: number) {
    this.master.gain.linearRampTo(volume, 0.1)
  }

  /** Directly set a track's muted state (for dev menu) */
  setTrackMuted(trackType: TrackType, muted: boolean) {
    const track = this.tracks.get(trackType)
    if (track) {
      track.setMuted(muted)
    }
  }

  /** Directly set a track's level (for dev menu) */
  setTrackLevel(trackType: TrackType, level: number) {
    const track = this.tracks.get(trackType)
    if (track) {
      track.setLevel(level)
    }
  }

  /** Set a track's parameters (for dev menu) */
  setTrackParams(trackType: TrackType, params: Partial<TrackParams>) {
    const track = this.tracks.get(trackType)
    if (track) {
      track.setParams(params)
    }
  }

  /** Get a track's parameters */
  getTrackParams(trackType: TrackType): TrackParams {
    const track = this.tracks.get(trackType)
    if (track) {
      return track.getParams()
    }
    return { ...DEFAULT_TRACK_PARAMS }
  }

  /** Apply element preset - returns preset values for UI sync */
  applyPreset(element: 'fire' | 'water' | 'earth' | 'air') {
    const presets = {
      fire:  { bpm: 135, scale: 'phrygian',        root: 48, swing: 0.1 },
      water: { bpm: 95,  scale: 'pentatonicMinor', root: 41, swing: 0.25 },
      earth: { bpm: 105, scale: 'pentatonicMinor', root: 36, swing: 0.15 },
      air:   { bpm: 125, scale: 'pentatonicMajor', root: 53, swing: 0.05 },
    }
    const p = presets[element]
    this.setBPM(p.bpm)
    this.setSwing(p.swing)
    this.setScale(SCALES[p.scale], p.root)
    return p
  }

  /** Get current BPM */
  getBPM(): number {
    return Tone.getTransport().bpm.value
  }

  /** Get current swing */
  getSwing(): number {
    return Tone.getTransport().swing
  }

  isPlaying() {
    return this.playing
  }

  /** Get list of which planets are currently playing */
  getActivePlanets(): number[] {
    const active: number[] = []
    this.planetTracks.forEach((trackType, planetIdx) => {
      const track = this.tracks.get(trackType)
      if (track && !track.isMuted()) {
        active.push(planetIdx)
      }
    })
    return active
  }

  dispose() {
    this.stop()
    this.tracks.forEach(track => track.dispose())
    this.compressor.dispose()
    this.limiter.dispose()
    this.master.dispose()
  }
}
