import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  DEFAULT_MIX,
  SEED_EVENTS,
  ELEMENT_COLORS,
  ELEMENT_EMOJI,
  type ElementKey,
  type SeedEvent,
} from './planetview'

describe('planetview constants', () => {
  describe('DEFAULT_MIX', () => {
    it('has all four elements', () => {
      expect(DEFAULT_MIX.fire).toBeDefined()
      expect(DEFAULT_MIX.water).toBeDefined()
      expect(DEFAULT_MIX.earth).toBeDefined()
      expect(DEFAULT_MIX.air).toBeDefined()
    })

    it('elements sum to 1.0', () => {
      const sum = DEFAULT_MIX.fire + DEFAULT_MIX.water + DEFAULT_MIX.earth + DEFAULT_MIX.air
      expect(sum).toBeCloseTo(1.0)
    })

    it('each element is 0.25 (equal distribution)', () => {
      expect(DEFAULT_MIX.fire).toBe(0.25)
      expect(DEFAULT_MIX.water).toBe(0.25)
      expect(DEFAULT_MIX.earth).toBe(0.25)
      expect(DEFAULT_MIX.air).toBe(0.25)
    })
  })

  describe('SEED_EVENTS', () => {
    it('has 6 events', () => {
      expect(SEED_EVENTS.length).toBe(6)
    })

    it('each event has required properties', () => {
      for (const event of SEED_EVENTS) {
        expect(typeof event.key).toBe('string')
        expect(typeof event.label).toBe('string')
        expect(typeof event.emoji).toBe('string')
        expect(event.flashColor).toBeInstanceOf(THREE.Color)
        expect(typeof event.preFill).toBe('number')
        expect(['fire', 'water', 'earth', 'air']).toContain(event.preFillEl)
      }
    })

    it('has unique keys', () => {
      const keys = SEED_EVENTS.map(e => e.key)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('includes expected events', () => {
      const keys = SEED_EVENTS.map(e => e.key)
      expect(keys).toContain('meteor')
      expect(keys).toContain('volcano')
      expect(keys).toContain('tidal_wave')
      expect(keys).toContain('ice_age')
    })
  })

  describe('ELEMENT_COLORS', () => {
    it('has colors for all four elements', () => {
      const elements: ElementKey[] = ['fire', 'water', 'earth', 'air']
      for (const el of elements) {
        expect(ELEMENT_COLORS[el]).toBeInstanceOf(THREE.Color)
      }
    })

    it('fire is reddish-orange', () => {
      const r = ELEMENT_COLORS.fire.r
      expect(r).toBeGreaterThan(0.5) // high red component
    })

    it('water is blue', () => {
      const b = ELEMENT_COLORS.water.b
      expect(b).toBeGreaterThan(0.5) // high blue component
    })
  })

  describe('ELEMENT_EMOJI', () => {
    it('has emoji for all four elements', () => {
      const elements: ElementKey[] = ['fire', 'water', 'earth', 'air']
      for (const el of elements) {
        expect(typeof ELEMENT_EMOJI[el]).toBe('string')
        expect(ELEMENT_EMOJI[el].length).toBeGreaterThan(0)
      }
    })

    it('fire emoji is fire', () => {
      expect(ELEMENT_EMOJI.fire).toBe('🔥')
    })

    it('water emoji is water drop', () => {
      expect(ELEMENT_EMOJI.water).toBe('💧')
    })
  })
})
