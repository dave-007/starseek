import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { SolarSystem, PlanetInfo } from './solarsystem'

describe('SolarSystem', () => {
  let solarSystem: SolarSystem

  beforeEach(() => {
    const color = new THREE.Color(0xff6600)
    solarSystem = new SolarSystem(12345, color, 0.5)
  })

  describe('constructor', () => {
    it('creates a solar system with planets', () => {
      expect(solarSystem.planetInfos.length).toBeGreaterThan(0)
      expect(solarSystem.planetInfos.length).toBeLessThanOrEqual(8)
    })

    it('creates a star mesh', () => {
      expect(solarSystem.star).toBeDefined()
      expect(solarSystem.star).toBeInstanceOf(THREE.Mesh)
    })

    it('creates a group containing all objects', () => {
      expect(solarSystem.group).toBeInstanceOf(THREE.Group)
      expect(solarSystem.group.children.length).toBeGreaterThan(0)
    })

    it('is deterministic - same seed produces same planet count', () => {
      const color = new THREE.Color(0xff6600)
      const sys1 = new SolarSystem(42, color, 0.5)
      const sys2 = new SolarSystem(42, color, 0.5)
      expect(sys1.planetInfos.length).toBe(sys2.planetInfos.length)
      sys1.dispose()
      sys2.dispose()
    })

    it('different seeds produce different systems', () => {
      const color = new THREE.Color(0xff6600)
      const sys1 = new SolarSystem(100, color, 0.5)
      const sys2 = new SolarSystem(200, color, 0.5)

      // Check orbit radii are different
      const radii1 = sys1.getOrbitRadii()
      const radii2 = sys2.getOrbitRadii()

      // At least one radius should differ (unless identical by chance)
      const allSame = radii1.length === radii2.length &&
        radii1.every((r, i) => Math.abs(r - radii2[i]) < 0.001)
      expect(allSame).toBe(false)

      sys1.dispose()
      sys2.dispose()
    })
  })

  describe('planet properties', () => {
    it('each planet has required properties', () => {
      for (const planet of solarSystem.planetInfos) {
        expect(planet.mesh).toBeInstanceOf(THREE.Mesh)
        expect(planet.baseColor).toBeInstanceOf(THREE.Color)
        expect(planet.tint).toBeInstanceOf(THREE.Color)
        expect(typeof planet.tempNorm).toBe('number')
        expect(planet.tempNorm).toBeGreaterThanOrEqual(0)
        expect(planet.tempNorm).toBeLessThanOrEqual(1)
        expect(typeof planet.label).toBe('string')
        expect(typeof planet.isGoldilocks).toBe('boolean')
      }
    })

    it('tempNorm determines planet label correctly', () => {
      for (const planet of solarSystem.planetInfos) {
        const t = planet.tempNorm
        if (t > 0.80) expect(planet.label).toBe('Scorched')
        else if (t > 0.60) expect(planet.label).toBe('Hot World')
        else if (t > 0.40) expect(planet.label).toBe('Temperate')
        else if (t > 0.20) expect(planet.label).toBe('Cold World')
        else expect(planet.label).toBe('Frozen')
      }
    })

    it('Goldilocks planets have lifeStory', () => {
      for (const planet of solarSystem.planetInfos) {
        if (planet.isGoldilocks) {
          expect(planet.lifeStory).toBeDefined()
          expect(typeof planet.lifeStory).toBe('string')
          expect(planet.lifeStory!.length).toBeGreaterThan(0)
        }
      }
    })

    it('Goldilocks planets have glow mesh', () => {
      for (const planet of solarSystem.planetInfos) {
        if (planet.isGoldilocks) {
          expect(planet.goldilocksGlow).toBeInstanceOf(THREE.Mesh)
        } else {
          expect(planet.goldilocksGlow).toBeUndefined()
        }
      }
    })

    it('isGoldilocks is true for tempNorm between 0.40 and 0.60', () => {
      for (const planet of solarSystem.planetInfos) {
        const expected = planet.tempNorm >= 0.40 && planet.tempNorm <= 0.60
        expect(planet.isGoldilocks).toBe(expected)
      }
    })
  })

  describe('getOrbitRadii', () => {
    it('returns array of orbit radii', () => {
      const radii = solarSystem.getOrbitRadii()
      expect(Array.isArray(radii)).toBe(true)
      expect(radii.length).toBe(solarSystem.planetInfos.length)
    })

    it('radii are in ascending order (inner to outer)', () => {
      const radii = solarSystem.getOrbitRadii()
      for (let i = 1; i < radii.length; i++) {
        expect(radii[i]).toBeGreaterThan(radii[i - 1])
      }
    })

    it('all radii are positive', () => {
      const radii = solarSystem.getOrbitRadii()
      for (const r of radii) {
        expect(r).toBeGreaterThan(0)
      }
    })
  })

  describe('getOrbitProximities', () => {
    it('returns 0 when exactly on an orbit', () => {
      const radii = solarSystem.getOrbitRadii()
      if (radii.length > 0) {
        const proximities = solarSystem.getOrbitProximities(radii[0])
        expect(proximities[0]).toBe(0)
      }
    })

    it('returns 1 when far from all orbits', () => {
      const proximities = solarSystem.getOrbitProximities(1000)
      for (const p of proximities) {
        expect(p).toBe(1)
      }
    })

    it('returns values between 0 and 1', () => {
      const radii = solarSystem.getOrbitRadii()
      if (radii.length > 0) {
        // Test at half distance to first orbit
        const proximities = solarSystem.getOrbitProximities(radii[0] * 0.9)
        for (const p of proximities) {
          expect(p).toBeGreaterThanOrEqual(0)
          expect(p).toBeLessThanOrEqual(1)
        }
      }
    })

    it('respects custom threshold', () => {
      const radii = solarSystem.getOrbitRadii()
      if (radii.length > 0) {
        // Small threshold = higher proximity values for same distance
        const prox1 = solarSystem.getOrbitProximities(radii[0] + 0.2, 0.4)
        const prox2 = solarSystem.getOrbitProximities(radii[0] + 0.2, 0.8)
        expect(prox1[0]).toBeGreaterThan(prox2[0])
      }
    })
  })

  describe('update', () => {
    it('does not throw with default parameters', () => {
      expect(() => solarSystem.update(0.016)).not.toThrow()
    })

    it('does not throw with all parameters', () => {
      expect(() => solarSystem.update(0.016, true, 0, [0, 1], [0.5, 0.5])).not.toThrow()
    })

    it('updates planet positions over time', () => {
      const initialPos = solarSystem.planetInfos[0]?.mesh.position.clone()
      solarSystem.update(1.0) // 1 second
      const newPos = solarSystem.planetInfos[0]?.mesh.position

      if (initialPos && newPos) {
        // Position should have changed (planet orbits)
        const moved = initialPos.distanceTo(newPos) > 0.001
        expect(moved).toBe(true)
      }
    })
  })

  describe('dispose', () => {
    it('can be called without throwing', () => {
      expect(() => solarSystem.dispose()).not.toThrow()
    })
  })
})
