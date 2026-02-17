/**
 * Solar system phenomena — toggleable ambient animations.
 * Each phenomenon is a self-contained group that updates each frame.
 */

import * as THREE from 'three'
import type { PlanetInfo } from './solarsystem'

function makePRNG(seed: number) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

export type PhenomenonKey = 'radio' | 'ufo' | 'comet' | 'lights' | 'formation' | 'anomaly'

export interface Phenomenon {
  readonly group: THREE.Group
  update(dt: number, planets: PlanetInfo[]): void
  dispose(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RADIO SIGNALS — expanding ring pulses from habitable planets
// ─────────────────────────────────────────────────────────────────────────────
export function createRadio(planets: PlanetInfo[]): Phenomenon {
  const group = new THREE.Group()
  const habitable = planets.filter(p => p.isGoldilocks)
  const ringData: { ring: THREE.Mesh; phase: number; planet: PlanetInfo }[] = []

  for (const p of habitable) {
    for (let i = 0; i < 4; i++) {
      const r = 0.18
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r * 1.08, 64),
        new THREE.MeshBasicMaterial({ color: 0x44ffcc, transparent: true, opacity: 0, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      group.add(ring)
      ringData.push({ ring, phase: i / 4, planet: p })
    }
  }

  return {
    group,
    update(dt, planets) {
      for (const d of ringData) {
        d.phase = (d.phase + dt * 0.22) % 1
        d.ring.position.copy(d.planet.mesh.position)
        const scale = 1 + d.phase * 18
        d.ring.scale.setScalar(scale)
        ;(d.ring.material as THREE.MeshBasicMaterial).opacity = (1 - d.phase) * 0.35
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UFO SCOUT — a small disc that drifts between planets
// ─────────────────────────────────────────────────────────────────────────────
export function createUFO(seed: number, planets: PlanetInfo[]): Phenomenon {
  const group   = new THREE.Group()
  const rand    = makePRNG(seed ^ 0xff0)

  // Body: flat saucer
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.14, 0.07, 24),
    new THREE.MeshStandardMaterial({ color: 0x99ccdd, metalness: 0.8, roughness: 0.2, emissive: new THREE.Color(0x224466), emissiveIntensity: 0.4 })
  )
  // Dome on top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xaaeeff, metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.75 })
  )
  dome.position.y = 0.035
  // Glow ring under
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.13, 0.24, 32),
    new THREE.MeshBasicMaterial({ color: 0x00eeff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  )
  glowRing.rotation.x = -Math.PI / 2
  glowRing.position.y = -0.04

  group.add(body); group.add(dome); group.add(glowRing)

  let target = new THREE.Vector3()
  let time   = 0
  let hoverTime = 0
  let hovering  = false
  let glowPhase = 0

  function pickTarget() {
    if (planets.length === 0) { target.set((rand()-0.5)*12, (rand()-0.5)*3, (rand()-0.5)*12); return }
    const p = planets[Math.floor(rand() * planets.length)]
    target.copy(p.mesh.position).add(new THREE.Vector3((rand()-0.5)*1.5, (rand()-0.5)*0.8, (rand()-0.5)*1.5))
  }

  // Start near a random planet
  if (planets.length) group.position.copy(planets[0].mesh.position)
  pickTarget()

  return {
    group,
    update(dt, currentPlanets) {
      time += dt; glowPhase += dt * 2.5

      const gmat = glowRing.material as THREE.MeshBasicMaterial
      gmat.opacity = 0.3 + Math.sin(glowPhase) * 0.25

      if (hovering) {
        hoverTime += dt
        group.rotation.y += dt * 0.8
        group.position.y += Math.sin(time * 1.5) * 0.002
        if (hoverTime > 3 + rand() * 4) { hovering = false; hoverTime = 0; pickTarget() }
      } else {
        // Update target to follow the planet (it moves)
        const dist = group.position.distanceTo(target)
        if (dist < 0.4) {
          hovering = true
        } else {
          const speed = Math.min(dist * 0.6, 3.5)
          const dir = target.clone().sub(group.position).normalize()
          group.position.addScaledVector(dir, speed * dt)
          group.rotation.y += dt * 1.2
          // Tilt in direction of travel
          group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -dir.x * 0.3, 0.05)
        }
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMET — periodic streaker with particle tail
// ─────────────────────────────────────────────────────────────────────────────
export function createComet(seed: number): Phenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xc0e7)

  const HEAD_R = 0.12
  const head   = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xddeeff })
  )

  const TAIL_N  = 80
  const tailPos = new Float32Array(TAIL_N * 3)
  const tailGeo = new THREE.BufferGeometry()
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3))
  const tail = new THREE.Points(tailGeo, new THREE.PointsMaterial({
    color: 0x88ccff, size: 0.06, transparent: true, opacity: 0.7,
    vertexColors: false, sizeAttenuation: true,
  }))

  // Glow around head
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R * 2.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.18, side: THREE.BackSide })
  )

  group.add(head); group.add(tail); group.add(glow)

  const PERIOD = 14 + rand() * 8   // seconds between comets

  let t      = rand()               // start at random phase
  let startP = new THREE.Vector3()
  let endP   = new THREE.Vector3()
  let ctrlP  = new THREE.Vector3()

  function resetPath() {
    const angle = rand() * Math.PI * 2
    const dist  = 16 + rand() * 6
    startP.set(Math.cos(angle) * dist, (rand()-0.5)*3, Math.sin(angle) * dist)
    endP.set(-startP.x * (0.8+rand()*0.4), (rand()-0.5)*3, -startP.z * (0.8+rand()*0.4))
    ctrlP.set((rand()-0.5)*5, (rand()-0.5)*2, (rand()-0.5)*5)
    t = 0
  }
  resetPath()

  const _tmpA = new THREE.Vector3(), _tmpB = new THREE.Vector3(), _tmpC = new THREE.Vector3()

  return {
    group,
    update(dt) {
      t += dt / PERIOD
      if (t > 1.2) resetPath()

      const tc = Math.max(0, Math.min(1, t))
      // Quadratic bezier
      _tmpA.lerpVectors(startP, ctrlP, tc)
      _tmpB.lerpVectors(ctrlP, endP, tc)
      head.position.lerpVectors(_tmpA, _tmpB, tc)
      glow.position.copy(head.position)

      // Tail: trail of past positions
      for (let k = TAIL_N - 1; k > 0; k--) {
        tailPos[k*3]   = tailPos[(k-1)*3]
        tailPos[k*3+1] = tailPos[(k-1)*3+1]
        tailPos[k*3+2] = tailPos[(k-1)*3+2]
      }
      tailPos[0] = head.position.x; tailPos[1] = head.position.y; tailPos[2] = head.position.z
      tailGeo.attributes.position.needsUpdate = true

      // Fade out when far from centre
      const vis = t > 0 && t < 1.1
      head.visible = glow.visible = tail.visible = vis
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CITY LIGHTS — tiny glow points on the night side of planets
// ─────────────────────────────────────────────────────────────────────────────
export function createCityLights(seed: number, planets: PlanetInfo[]): Phenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xc177)

  const lightGroups: { pts: THREE.Points; planet: PlanetInfo; localDirs: THREE.Vector3[]; twinkle: number[] }[] = []

  for (const p of planets) {
    const count = p.isGoldilocks ? 28 : Math.floor(rand() * 8)
    if (count === 0) continue

    const pos = new Float32Array(count * 3)
    const localDirs: THREE.Vector3[] = []

    for (let k = 0; k < count; k++) {
      // Random point on unit sphere surface
      const theta = rand() * Math.PI * 2
      const phi   = Math.acos(2 * rand() - 1)
      const r     = p.mesh.geometry.boundingSphere?.radius ?? 0.1
      const v = new THREE.Vector3(Math.sin(phi)*Math.cos(theta), Math.sin(phi)*Math.sin(theta), Math.cos(phi))
      localDirs.push(v.clone())
      pos[k*3] = v.x * r * 1.02; pos[k*3+1] = v.y * r * 1.02; pos[k*3+2] = v.z * r * 1.02
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: p.isGoldilocks ? 0xffeeaa : 0xffcc66,
      size: p.isGoldilocks ? 0.04 : 0.025,
      transparent: true, opacity: 0.9, sizeAttenuation: true,
    }))
    p.mesh.add(pts)   // parent to planet so it orbits with it
    lightGroups.push({ pts, planet: p, localDirs, twinkle: localDirs.map(() => rand() * Math.PI * 2) })
  }

  let time = 0
  return {
    group,   // empty — lights parented to planet meshes directly
    update(dt) {
      time += dt
      for (const lg of lightGroups) {
        // Night-side culling: hide lights facing the star (origin)
        const planetPos = lg.planet.mesh.position  // star is at (0,0,0) in group space
        const toStar = planetPos.clone().negate().normalize()
        const positions = (lg.pts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
        for (let k = 0; k < lg.localDirs.length; k++) {
          // World direction of this light point
          const worldDir = lg.localDirs[k].clone().applyQuaternion(lg.planet.mesh.quaternion)
          const nightSide = worldDir.dot(toStar) < -0.1   // roughly night side
          const twinkle = nightSide ? (0.5 + Math.sin(time * 3 + lg.twinkle[k]) * 0.5) : 0
          // Scale point to 0 when day side (hiding it)
          positions[k*3]   = lg.localDirs[k].x * (lg.planet.mesh.geometry.boundingSphere?.radius ?? 0.1) * 1.02 * (nightSide ? 1 : 0)
          positions[k*3+1] = lg.localDirs[k].y * (lg.planet.mesh.geometry.boundingSphere?.radius ?? 0.1) * 1.02 * (nightSide ? 1 : 0)
          positions[k*3+2] = lg.localDirs[k].z * (lg.planet.mesh.geometry.boundingSphere?.radius ?? 0.1) * 1.02 * (nightSide ? 1 : 0)
          lg.twinkle[k] = lg.twinkle[k]  // keep phase
        }
        lg.pts.geometry.attributes.position.needsUpdate = true
        ;(lg.pts.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(time * 0.8) * 0.2
      }
    },
    dispose() {
      for (const lg of lightGroups) { lg.planet.mesh.remove(lg.pts); lg.pts.geometry.dispose() }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FORMATION — V-formation of lights crossing the system
// ─────────────────────────────────────────────────────────────────────────────
export function createFormation(seed: number): Phenomenon {
  const group  = new THREE.Group()
  const rand   = makePRNG(seed ^ 0xf04f)
  const COUNT  = 5

  // Formation offsets in V shape
  const offsets = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.5, 0, 0.45), new THREE.Vector3(0.5, 0, 0.45),
    new THREE.Vector3(-1.0, 0, 0.9),  new THREE.Vector3(1.0, 0, 0.9),
  ]

  const lights: THREE.Mesh[] = []
  for (let i = 0; i < COUNT; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    // Ring glow per light
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.25 })
    )
    m.add(g); group.add(m); lights.push(m)
  }

  const PERIOD = 20 + rand() * 10
  let t    = rand()
  let from = new THREE.Vector3(), to = new THREE.Vector3()
  let up   = new THREE.Vector3(0, 1, 0)
  let dir  = new THREE.Vector3()
  let side = new THREE.Vector3()

  function resetPath() {
    const angle = rand() * Math.PI * 2
    const dist  = 18 + rand() * 4
    from.set(Math.cos(angle)*dist, (rand()-0.5)*4, Math.sin(angle)*dist)
    to.set(-from.x*(0.7+rand()*0.6), (rand()-0.5)*4, -from.z*(0.7+rand()*0.6))
    dir.copy(to).sub(from).normalize()
    side.crossVectors(dir, up).normalize()
    t = 0
  }
  resetPath()

  const _q = new THREE.Quaternion()
  return {
    group,
    update(dt) {
      t += dt / PERIOD
      if (t > 1.15) resetPath()
      const tc = Math.max(0, Math.min(1, t))
      const base = from.clone().lerp(to, tc)
      dir.copy(to).sub(from).normalize()
      side.crossVectors(dir, up).normalize()

      // Occasional formation rotation around forward axis
      const roll = Math.sin(t * 0.8) * 0.4
      _q.setFromAxisAngle(dir, roll)

      for (let i = 0; i < COUNT; i++) {
        const off = offsets[i].clone().applyQuaternion(_q)
        const sp  = side.clone().multiplyScalar(off.x)
        lights[i].position.copy(base).add(sp).add(new THREE.Vector3(0, off.y + off.z*0.1, 0))
        lights[i].visible = tc > 0 && tc < 1
      }
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ANOMALY — slowly rotating wireframe polyhedron that pulses
// ─────────────────────────────────────────────────────────────────────────────
export function createAnomaly(seed: number): Phenomenon {
  const group = new THREE.Group()
  const rand  = makePRNG(seed ^ 0xa0e0)

  const geo1  = new THREE.OctahedronGeometry(0.5, 0)
  const geo2  = new THREE.OctahedronGeometry(0.35, 0)

  const mat1  = new THREE.MeshBasicMaterial({ color: 0x8844ff, wireframe: true })
  const mat2  = new THREE.MeshBasicMaterial({ color: 0xff44aa, wireframe: true })

  const outer = new THREE.Mesh(geo1, mat1)
  const inner = new THREE.Mesh(geo2, mat2)
  // Glow core
  const core  = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.7 })
  )

  group.add(outer); group.add(inner); group.add(core)

  let time   = 0
  let driftV = new THREE.Vector3((rand()-0.5)*0.4, (rand()-0.5)*0.2, (rand()-0.5)*0.4)
  const DRIFT_RANGE = 6

  return {
    group,
    update(dt) {
      time += dt
      outer.rotation.x += dt * 0.3; outer.rotation.y += dt * 0.5; outer.rotation.z += dt * 0.2
      inner.rotation.x -= dt * 0.45; inner.rotation.y -= dt * 0.25
      const pulse = 0.85 + Math.sin(time * 2.2) * 0.18
      core.scale.setScalar(pulse)
      ;(core.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(time * 2.2) * 0.2
      // Slow drift, bounce at boundary
      group.position.addScaledVector(driftV, dt)
      if (Math.abs(group.position.x) > DRIFT_RANGE) driftV.x *= -1
      if (Math.abs(group.position.y) > DRIFT_RANGE * 0.4) driftV.y *= -1
      if (Math.abs(group.position.z) > DRIFT_RANGE) driftV.z *= -1
    },
    dispose() { group.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }) }
  }
}
