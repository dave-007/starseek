// MusicEngine — Track-based music system
// Each planet is a musical layer that can be toggled on/off

import * as Tone from 'tone'
import { KickTrack, HiHatTrack, BassTrack, ArpTrack, PadTrack, PercTrack, LeadTrack, type Track } from './tracks/index'
import { SCALES, SCALE_NAMES } from './scales'

export interface MusicParams {
  energy: number
  brightness: number
  density: number
  movement: number
}

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

    // Unmute if level > 0, mute if level is 0
    const shouldPlay = level > 0.01
    if (shouldPlay && track.isMuted()) {
      track.setMuted(false)
    } else if (!shouldPlay && !track.isMuted()) {
      track.setMuted(true)
    }

    track.setLevel(level)
  }

  /** Update all planet levels from proximity array */
  updatePlanetLevels(proximities: number[]) {
    this.planetTracks.forEach((_, planetIdx) => {
      const proximity = proximities[planetIdx] ?? 1  // 0 = on orbit, 1 = far
      // Invert: proximity 0 = full volume, proximity 1 = silent
      const level = Math.max(0, 1 - proximity)
      this.setPlanetLevel(planetIdx, level)
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
