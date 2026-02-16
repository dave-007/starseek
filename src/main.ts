import * as THREE from 'three'
import './style.css'
import { unlockAudio, SystemLoop } from './audio'
import { buildHexSphere } from './hexsphere'
import { SolarSystem } from './solarsystem'
import { PlanetView, DEFAULT_MIX, ElementMix, ElementKey, SEED_EVENTS, SeedEvent, ELEMENT_COLORS } from './planetview'

// ---------------------------------------------------------------------------
// Renderer & Scene
// ---------------------------------------------------------------------------
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000008)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 0, 3)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------------------------------------------------------------------------
// Galaxy objects
// ---------------------------------------------------------------------------
const galaxyGroup = new THREE.Group()
scene.add(galaxyGroup)

const galaxy = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.18 })
)
galaxyGroup.add(galaxy)

const hexGrid = buildHexSphere(4, 1.002, 0x4422aa)
galaxyGroup.add(hexGrid)

galaxyGroup.add(new THREE.AmbientLight(0x221133, 1.5))
const sun = new THREE.DirectionalLight(0x8866ff, 2)
sun.position.set(5, 3, 5)
galaxyGroup.add(sun)

// Stars — shared between both views
const starPos = new Float32Array(2000 * 3)
for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 200
const starGeo = new THREE.BufferGeometry()
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })))

// ---------------------------------------------------------------------------
// Starting systems
// ---------------------------------------------------------------------------
interface System {
  id: number
  localPos: THREE.Vector3
  dot: THREE.Mesh
  color: THREE.Color
  rings: Array<{ mesh: THREE.Mesh; phase: number }>
  pulseSpeed: number
  maxScale: number
  audio: SystemLoop
  audioSeed: number
}

function randomSpherePoint(): THREE.Vector3 {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi))
}

function randomSystemColor(): THREE.Color {
  return new THREE.Color().setHSL(Math.random(), 0.7 + Math.random() * 0.3, 0.55 + Math.random() * 0.2)
}

const systems: System[] = []
const systemCount = 3

for (let i = 0; i < systemCount; i++) {
  const localPos = randomSpherePoint()
  const normal = localPos.clone().normalize()
  const color = randomSystemColor()
  const pulseSpeed = 0.3 + Math.random() * 0.7
  const maxScale = 2.0 + Math.random() * 2.5
  const dotR = 0.014 + Math.random() * 0.018

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(dotR, 12, 12),
    new THREE.MeshBasicMaterial({ color: color.clone() })
  )
  dot.position.copy(localPos)
  galaxy.add(dot)

  const rings: System['rings'] = []
  for (let r = 0; r < 3; r++) {
    const ir = dotR * 1.4
    const rm = new THREE.Mesh(
      new THREE.RingGeometry(ir, ir * 1.55, 48),
      new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    )
    rm.position.copy(localPos.clone().multiplyScalar(1.005))
    rm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    galaxy.add(rm)
    rings.push({ mesh: rm, phase: r / 3 })
  }

  const audioSeed = Math.round((localPos.x + localPos.y + localPos.z + 3) * 1e6)
  systems.push({ id: i, localPos, dot, color, rings, pulseSpeed, maxScale, audio: new SystemLoop(audioSeed), audioSeed })
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
// "Start here?" label
const label = document.createElement('div')
label.style.cssText = `
  position:fixed; font-family:'Courier New',monospace; font-size:13px;
  letter-spacing:.12em; pointer-events:none; display:none; white-space:nowrap;
`
document.body.appendChild(label)

// Thought bubble for Goldilocks planets
const thoughtBubble = document.createElement('div')
thoughtBubble.style.cssText = `
  position:fixed; font-family:'Courier New',monospace; font-size:11px;
  line-height:1.5; letter-spacing:.06em; pointer-events:none; display:none;
  max-width:260px; padding:14px 18px; background:rgba(0,8,16,0.88);
  border:1px solid rgba(68,255,170,0.35); border-radius:8px;
  color:rgba(255,255,255,0.85); box-shadow:0 0 24px rgba(68,255,170,0.15);
`
document.body.appendChild(thoughtBubble)

// Thought bubble tail (pointer)
const bubbleTail = document.createElement('div')
bubbleTail.style.cssText = `
  position:absolute; width:0; height:0;
  border-left:8px solid transparent; border-right:8px solid transparent;
  border-top:10px solid rgba(68,255,170,0.35);
  bottom:-10px; left:20px;
`
thoughtBubble.appendChild(bubbleTail)

// Black fade overlay
const overlay = document.createElement('div')
overlay.style.cssText = `
  position:fixed; inset:0; background:#000; pointer-events:none;
  opacity:0; transition:opacity 0.4s ease;
`
document.body.appendChild(overlay)

// Corner nav — appears in any corner on hover while in solar-system view
const CORNER_MARGIN = 96  // px from edge counts as "in corner"
const cornerDefs = [
  { top: '18px',  left:  '18px',  text: '↙ start over' },
  { top: '18px',  right: '18px',  text: '↘ start over' },
  { bottom: '18px', left: '18px', text: '↗ start over' },
  { bottom: '18px', right: '18px', text: '↖ start over' },
]
const cornerEls = cornerDefs.map(def => {
  const el = document.createElement('div')
  el.textContent = def.text
  const pos = Object.entries(def)
    .filter(([k]) => k !== 'text')
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
  el.style.cssText = `
    position:fixed; ${pos};
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.12em;
    color:rgba(255,255,255,0); pointer-events:none; display:none;
    transition:color 0.25s ease; white-space:nowrap;
  `
  document.body.appendChild(el)
  return el
})

let activeCorner = -1   // which corner is currently lit (-1 = none)
let mouseScreenX = 0, mouseScreenY = 0

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
type AppState = 'galaxy' | 'zooming-in' | 'solar-system' | 'zooming-out' | 'planet'
let state: AppState = 'galaxy'
let selectedSystem: System | null = null
let solarSystem: SolarSystem | null = null
let planetView: PlanetView | null = null
let currentHoveredPlanetIdx = -1
let solarCamAngle = 0  // kept for compat; replaced by theta/phi
let solarCamTheta = 0        // azimuth around Y
let solarCamPhi   = Math.PI / 3  // elevation from top (radians)
const SOLAR_CAM_DIST = 14
let solarVelTheta = 0
let solarVelPhi   = 0
let solarDragSpeed = 0
let zoomT = 0           // 0→1 for zoom-in, 1→0 for zoom-out
let zoomStartCamPos = new THREE.Vector3()
let zoomTargetCamPos = new THREE.Vector3()

function setGalaxyOpacity(alpha: number) {
  galaxy.material.opacity = 0.18 * alpha
  ;(galaxy.material as THREE.MeshStandardMaterial).transparent = true
  ;(hexGrid.material as THREE.LineBasicMaterial).opacity = 0.2 * alpha
  for (const sys of systems) {
    ;(sys.dot.material as THREE.MeshBasicMaterial).opacity = alpha
    for (const ring of sys.rings) {
      ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = alpha * 0.7
    }
  }
}

function startZoomIn(sys: System) {
  if (state !== 'galaxy') return
  state = 'zooming-in'
  selectedSystem = sys
  zoomT = 0
  zoomStartCamPos.copy(camera.position)
  // Target: from the direction of the system point, just above sphere surface
  sys.localPos.clone().applyMatrix4(galaxy.matrixWorld).normalize().multiplyScalar(1.6)
  zoomTargetCamPos.copy(sys.localPos).applyMatrix4(galaxy.matrixWorld).normalize().multiplyScalar(1.6)
  if (activeAudio) { activeAudio.stop(); activeAudio = null }
}

function enterSolarSystem() {
  hoveredSystem = null   // clear stale galaxy hover so mouseup can't retrigger zoom-in
  galaxyGroup.visible = false
  const sys = selectedSystem!
  solarSystem = new SolarSystem(sys.audioSeed, sys.color, sys.pulseSpeed)
  scene.add(solarSystem.group)
  solarCamTheta = 0
  solarCamPhi   = Math.PI / 3
  solarVelTheta = 0
  solarVelPhi   = 0
  const cp = solarCamPos()
  camera.position.copy(cp)
  camera.lookAt(0, 0, 0)
  state = 'solar-system'
  overlay.style.opacity = '0'
}

function goBack() {
  if (state !== 'solar-system') return
  cornerEls.forEach(el => { el.style.display = 'none' })
  thoughtBubble.style.display = 'none'
  label.style.display = 'none'
  overlay.style.opacity = '1'
  setTimeout(() => {
    if (activeAudio) { activeAudio.stop(); activeAudio = null }
    if (solarSystem) { scene.remove(solarSystem.group); solarSystem.dispose(); solarSystem = null }
    galaxyGroup.visible = true
    setGalaxyOpacity(1)
    camera.position.set(0, 0, 3)
    camera.lookAt(0, 0, 0)
    activeCorner = -1
    cornerEls.forEach(el => { el.style.color = 'rgba(255,255,255,0)'; el.style.display = 'none' })
    state = 'galaxy'
    zoomT = 0
    overlay.style.opacity = '0'
  }, 420)
}

// (solar-system back nav is via corner hover — no button)

// ---------------------------------------------------------------------------
// Element selector UI  (shown only in planet state)
// Click a button to select an element, then paint the planet by clicking/dragging
// ---------------------------------------------------------------------------
const ELEMENTS: { key: ElementKey; label: string; color: string }[] = [
  { key: 'fire',  label: 'FIRE',  color: '#ff5500' },
  { key: 'water', label: 'WATER', color: '#0099ff' },
  { key: 'earth', label: 'EARTH', color: '#44aa22' },
  { key: 'air',   label: 'AIR',   color: '#aaccff' },
]

let selectedElement: ElementKey | null = null

const elementBar = document.createElement('div')
elementBar.style.cssText = `
  position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
  display:none; gap:10px; flex-direction:row; align-items:center;
`
document.body.appendChild(elementBar)

const elementBtns: HTMLElement[] = []
ELEMENTS.forEach(({ key, label, color }) => {
  const btn = document.createElement('div')
  btn.style.cssText = `
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.12em;
    color:${color}; border:1px solid ${color}44; padding:7px 18px; cursor:pointer;
    transition:background .15s, border-color .15s, box-shadow .15s; user-select:none;
    background:${color}0d;
  `
  btn.textContent = label
  btn.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    selectedElement = selectedElement === key ? null : key
    updateElementUI()
  })
  elementBar.appendChild(btn)
  elementBtns.push(btn)
})

function updateElementUI() {
  ELEMENTS.forEach(({ key, color }, i) => {
    const active = selectedElement === key
    // Subtle resonance hint: · if planet wants more of this element
    const mix = planetView?.currentMix ?? DEFAULT_MIX
    const isHinted = planetView && (planetView.resonance[key] - mix[key] > 0.14)
    const hint = isHinted ? ' ·' : ''
    elementBtns[i].textContent = `${ELEMENTS[i].label}${hint}`
    if (active) {
      elementBtns[i].style.background   = `${color}44`
      elementBtns[i].style.borderColor  = color
      elementBtns[i].style.boxShadow    = `0 0 14px ${color}88`
    } else {
      elementBtns[i].style.background   = isHinted ? `${color}22` : `${color}0d`
      elementBtns[i].style.borderColor  = isHinted ? `${color}99` : `${color}44`
      elementBtns[i].style.boxShadow    = 'none'
    }
  })
}

// ---------------------------------------------------------------------------
// Seeding event picker UI
// ---------------------------------------------------------------------------
const eventPicker = document.createElement('div')
eventPicker.style.cssText = `
  position:fixed; inset:0; display:none; align-items:center; justify-content:center;
  flex-direction:column; gap:20px; background:rgba(0,0,4,0.82); z-index:10;
`
document.body.appendChild(eventPicker)

const eventTitle = document.createElement('div')
eventTitle.style.cssText = `
  font-family:'Courier New',monospace; font-size:13px; letter-spacing:.18em;
  color:rgba(255,255,255,0.55); text-transform:uppercase;
`
eventTitle.textContent = 'Choose a seeding event'
eventPicker.appendChild(eventTitle)

const eventGrid = document.createElement('div')
eventGrid.style.cssText = `display:grid; grid-template-columns:repeat(3,1fr); gap:10px; max-width:480px; width:100%;`
eventPicker.appendChild(eventGrid)

function showEventPicker(onSelect: (ev: SeedEvent) => void) {
  eventGrid.innerHTML = ''
  const all = [...SEED_EVENTS, null]  // null = random
  for (const ev of all) {
    const btn = document.createElement('div')
    const label = ev ? `${ev.emoji} ${ev.label}` : '? Random'
    const col = ev ? '#' + ev.flashColor.getHexString() : '#ffffff'
    btn.style.cssText = `
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:.1em;
      color:${col}; border:1px solid ${col}44; padding:10px 8px; cursor:pointer;
      text-align:center; transition:background .2s, border-color .2s;
      background:${col}0a; white-space:nowrap;
    `
    btn.textContent = label
    btn.addEventListener('mouseenter', () => { btn.style.background = `${col}22`; btn.style.borderColor = col })
    btn.addEventListener('mouseleave', () => { btn.style.background = `${col}0a`; btn.style.borderColor = `${col}44` })
    btn.addEventListener('click', () => {
      eventPicker.style.display = 'none'
      const chosen = ev ?? SEED_EVENTS[Math.floor(Math.random() * SEED_EVENTS.length)]
      onSelect(chosen)
    })
    eventGrid.appendChild(btn)
  }
  eventPicker.style.display = 'flex'
}

let currentPlanetIdx = -1

// Planet enter / exit
function enterPlanet(idx: number) {
  if (state !== 'solar-system' || !solarSystem) return
  const pi = solarSystem.planetInfos[idx]
  currentPlanetIdx = idx
  thoughtBubble.style.display = 'none'
  label.style.display = 'none'
  overlay.style.opacity = '1'
  setTimeout(() => {
    if (solarSystem) solarSystem.group.visible = false
    selectedElement = null
    planetView = new PlanetView(idx * 999 + (selectedSystem?.audioSeed ?? 0), pi.baseColor)
    scene.add(planetView.group)
    camera.position.set(0, 0, 2.4)
    camera.lookAt(0, 0, 0)
    state = 'planet'
    elementBar.style.display = 'flex'
    restartBtn.style.display = 'block'
    planetStatus.style.display = 'block'
    updateElementUI()
    overlay.style.opacity = '0'
    // Planet is paused until event picker is dismissed
    showEventPicker(applyEvent)
  }, 420)
}

// Planet status bar (match score + coverage)
const planetStatus = document.createElement('div')
planetStatus.style.cssText = `
  position:fixed; top:18px; left:50%; transform:translateX(-50%);
  font-family:'Courier New',monospace; font-size:10px; letter-spacing:.14em;
  color:rgba(255,255,255,0.38); pointer-events:none; display:none; white-space:nowrap;
`
document.body.appendChild(planetStatus)

// Restart button (planet view) — top-right corner, unobtrusive
const restartBtn = document.createElement('div')
restartBtn.textContent = '↺ reseed'
restartBtn.style.cssText = `
  position:fixed; top:18px; right:18px;
  font-family:'Courier New',monospace; font-size:11px; letter-spacing:.14em;
  color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.12);
  padding:5px 14px; cursor:pointer; display:none;
  transition:color .2s, border-color .2s; background:rgba(0,0,8,0.5);
`
restartBtn.addEventListener('mouseenter', () => { restartBtn.style.color = 'rgba(255,255,255,0.85)'; restartBtn.style.borderColor = 'rgba(255,255,255,0.45)' })
restartBtn.addEventListener('mouseleave', () => { restartBtn.style.color = 'rgba(255,255,255,0.35)'; restartBtn.style.borderColor = 'rgba(255,255,255,0.12)' })
restartBtn.addEventListener('click', () => {
  if (state === 'planet') showEventPicker(applyEvent)
})
document.body.appendChild(restartBtn)

function applyEvent(ev: SeedEvent) {
  document.getElementById('planet-outcome')?.remove()
  planetView?.reset(ev)
  // Pre-select the event's seed element so player can immediately start painting
  selectedElement = ev.seedElement
  updateElementUI()
}

function showOutcome(text: string, color: string) {
  const el = document.createElement('div')
  el.id = 'planet-outcome'
  el.style.cssText = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    flex-direction:column; gap:22px; pointer-events:none;
  `
  const msg = document.createElement('div')
  msg.style.cssText = `
    font-family:'Courier New',monospace; font-size:28px; letter-spacing:.3em;
    color:${color}; text-shadow:0 0 40px ${color}; text-transform:uppercase;
    animation:fadeIn 1.2s ease;
  `
  msg.textContent = text
  const sub = document.createElement('div')
  sub.style.cssText = `
    font-family:'Courier New',monospace; font-size:11px; letter-spacing:.18em;
    color:rgba(255,255,255,0.45); pointer-events:auto; cursor:pointer;
  `
  sub.textContent = text === 'attuned' ? 'click to reseed a new world' : 'click to try again'
  sub.addEventListener('click', () => {
    el.remove()
    showEventPicker(applyEvent)
  })
  el.appendChild(msg)
  el.appendChild(sub)
  document.body.appendChild(el)
  if (!document.getElementById('planet-outcome-style')) {
    const s = document.createElement('style')
    s.id = 'planet-outcome-style'
    s.textContent = `@keyframes fadeIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }`
    document.head.appendChild(s)
  }
}

function exitPlanet() {
  if (state !== 'planet') return
  eventPicker.style.display = 'none'
  document.getElementById('planet-outcome')?.remove()
  overlay.style.opacity = '1'
  elementBar.style.display = 'none'
  restartBtn.style.display = 'none'
  planetStatus.style.display = 'none'
  label.style.display = 'none'
  thoughtBubble.style.display = 'none'
  setTimeout(() => {
    if (planetView) { scene.remove(planetView.group); planetView.dispose(); planetView = null }
    if (solarSystem) solarSystem.group.visible = true
    camera.position.copy(solarCamPos())
    camera.lookAt(0, 0, 0)
    state = 'solar-system'
    overlay.style.opacity = '0'
  }, 420)
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const mouse = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
let hoveredSystem: System | null = null
let activeAudio: SystemLoop | null = null
let isDragging = false
let isPaintDragging = false
let prevMouseX = 0, prevMouseY = 0
let velX = 0, velY = 0
let dragSpeed = 0
let timeScale = 1.0
let animTime = 0
let prevT = 0
let mouseX = 0, mouseY = 0

// Compute solar camera world position from spherical coords
function solarCamPos(): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(solarCamPhi) * Math.cos(solarCamTheta) * SOLAR_CAM_DIST,
    Math.cos(solarCamPhi) * SOLAR_CAM_DIST,
    Math.sin(solarCamPhi) * Math.sin(solarCamTheta) * SOLAR_CAM_DIST
  )
}

renderer.domElement.addEventListener('mousedown', (e) => {
  unlockAudio()
  if (state === 'planet') {
    if (selectedElement && planetView) isPaintDragging = true
    return
  }
  if (state !== 'galaxy' && state !== 'solar-system') return
  isDragging = true
  prevMouseX = e.clientX; prevMouseY = e.clientY
  if (state === 'galaxy') { velX = 0; velY = 0 }
  else { solarVelTheta = 0; solarVelPhi = 0 }
})

document.addEventListener('mouseup', (e) => {
  if (state === 'planet') {
    isPaintDragging = false
    if (activeCorner >= 0) exitPlanet()
    return
  }
  if (!isDragging) return
  isDragging = false
  const dx = e.clientX - prevMouseX
  const dy = e.clientY - prevMouseY
  if (state === 'galaxy') {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && hoveredSystem) startZoomIn(hoveredSystem)
  } else if (state === 'solar-system') {
    if (activeCorner >= 0) goBack()
    else if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && currentHoveredPlanetIdx >= 0) {
      enterPlanet(currentHoveredPlanetIdx)
    }
  }
})

document.addEventListener('mousemove', (e) => {
  mouseScreenX = e.clientX
  mouseScreenY = e.clientY
  mouseX = (e.clientX / window.innerWidth) * 2 - 1
  mouseY = -((e.clientY / window.innerHeight) * 2 - 1)
  mouse.set(mouseX, mouseY)
  if (!isDragging) return
  const dx = e.clientX - prevMouseX
  const dy = e.clientY - prevMouseY
  const scale = (Math.PI * 2) / window.innerHeight

  if (state === 'galaxy') {
    velX = dy * scale; velY = dx * scale
    dragSpeed = Math.sqrt(dx * dx + dy * dy)
    galaxy.rotation.x += velX; galaxy.rotation.y += velY
    hexGrid.rotation.copy(galaxy.rotation)
  } else if (state === 'solar-system') {
    solarVelTheta = dx * scale
    solarVelPhi   = dy * scale
    solarDragSpeed = Math.sqrt(dx * dx + dy * dy)
    solarCamTheta += solarVelTheta
    solarCamPhi = Math.max(0.12, Math.min(Math.PI / 2, solarCamPhi + solarVelPhi))
  }
  prevMouseX = e.clientX; prevMouseY = e.clientY
})

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

// ---------------------------------------------------------------------------
// Animate
// ---------------------------------------------------------------------------
const tempVec = new THREE.Vector3()

function animate(t: number) {
  requestAnimationFrame(animate)
  const dt = Math.min((t - prevT) * 0.001, 0.05)
  prevT = t

  if (state === 'galaxy') {
    // Time warp + inertia
    const targetScale = isDragging ? 1 + dragSpeed * 0.18 : 1.0
    timeScale += (targetScale - timeScale) * 0.06
    dragSpeed *= 0.8
    animTime += dt * timeScale

    if (!isDragging) {
      velX += (mouseY * 0.00018 - velX) * 0.027
      velY += (mouseX * 0.00018 + 0.00033 - velY) * 0.027
      galaxy.rotation.x += velX
      galaxy.rotation.y += velY
      hexGrid.rotation.copy(galaxy.rotation)
    }

    // Ring animation
    for (const sys of systems) {
      for (const ring of sys.rings) {
        const phase = (animTime * sys.pulseSpeed + ring.phase) % 1
        ring.mesh.scale.setScalar(1 + phase * (sys.maxScale - 1))
        ;(ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.7
      }
    }

    // Hover
    raycaster.setFromCamera(mouse, camera)
    const hits = raycaster.intersectObject(galaxy)
    let newHovered: System | null = null
    if (hits.length > 0) {
      const localHit = galaxy.worldToLocal(hits[0].point.clone()).normalize()
      let minDist = Infinity
      for (const sys of systems) {
        const d = localHit.distanceTo(sys.localPos)
        if (d < minDist) { minDist = d; newHovered = sys }
      }
      if (minDist > 0.22) newHovered = null
    }

    if (newHovered !== hoveredSystem) {
      if (activeAudio) { activeAudio.stop(); activeAudio = null }
      if (newHovered) { newHovered.audio.start(); activeAudio = newHovered.audio }
      hoveredSystem = newHovered
    }

    for (const sys of systems) {
      const mat = sys.dot.material as THREE.MeshBasicMaterial
      mat.color.lerp(sys === hoveredSystem ? new THREE.Color(0xffffff) : sys.color, 0.15)
    }

    // Label
    if (hoveredSystem && !isDragging) {
      tempVec.copy(hoveredSystem.localPos).applyMatrix4(galaxy.matrixWorld)
      tempVec.project(camera)
      const sx = (tempVec.x * 0.5 + 0.5) * window.innerWidth
      const sy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight
      const hex = '#' + hoveredSystem.color.getHexString()
      label.style.display = 'block'
      label.style.left = `${sx + 18}px`
      label.style.top = `${sy - 8}px`
      label.style.color = hex
      label.style.textShadow = `0 0 10px ${hex}, 0 0 22px ${hex}88`
      label.textContent = 'Start here?'
      renderer.domElement.style.cursor = 'pointer'
    } else {
      label.style.display = 'none'
      renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab'
    }

  } else if (state === 'zooming-in') {
    zoomT = Math.min(zoomT + dt / 1.4, 1)
    const e = easeInOut(zoomT)

    // Move camera toward system point
    camera.position.lerpVectors(zoomStartCamPos, zoomTargetCamPos, e)
    camera.lookAt(0, 0, 0)

    // Fade galaxy from halfway through
    const fadeT = Math.max(0, (zoomT - 0.45) / 0.55)
    setGalaxyOpacity(1 - fadeT)

    if (zoomT >= 1) {
      overlay.style.opacity = '1'
      setTimeout(enterSolarSystem, 420)
      state = 'zooming-out' // prevent re-entry; enterSolarSystem sets 'solar-system'
    }

  } else if (state === 'solar-system') {
    raycaster.setFromCamera(mouse, camera)

    const starHovered = solarSystem ? raycaster.intersectObject(solarSystem.star).length > 0 : false

    // Planet hover — check all planet meshes
    let hoveredPlanetIdx = -1
    if (solarSystem && !starHovered) {
      const meshes = solarSystem.planetInfos.map(p => p.mesh)
      const hits = raycaster.intersectObjects(meshes)
      if (hits.length > 0) hoveredPlanetIdx = meshes.indexOf(hits[0].object as THREE.Mesh)
    }
    currentHoveredPlanetIdx = hoveredPlanetIdx  // expose for mouseup

    // Audio: star hover plays the system loop
    const wantAudio = starHovered
    if (wantAudio && !activeAudio && selectedSystem) {
      selectedSystem.audio.start(); activeAudio = selectedSystem.audio
    } else if (!wantAudio && activeAudio) {
      activeAudio.stop(); activeAudio = null
    }

    // Label/thought bubble: show on hover
    if (hoveredPlanetIdx >= 0 && solarSystem) {
      const pi = solarSystem.planetInfos[hoveredPlanetIdx]
      tempVec.copy(pi.mesh.position).applyMatrix4(solarSystem.group.matrixWorld)
      tempVec.project(camera)
      const sx = (tempVec.x * 0.5 + 0.5) * window.innerWidth
      const sy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight
      const hex = '#' + pi.tint.getHexString()

      if (pi.isGoldilocks && pi.lifeStory) {
        // Show thought bubble for Goldilocks planets
        label.style.display = 'none'
        thoughtBubble.style.display = 'block'
        thoughtBubble.style.left = `${sx + 18}px`
        thoughtBubble.style.top = `${sy - 80}px`
        thoughtBubble.innerHTML = `<div style="color:#44ffaa;margin-bottom:6px;font-size:10px;letter-spacing:.14em;">✦ ${pi.label.toUpperCase()}</div>${pi.lifeStory}`
      } else {
        // Show simple label for non-Goldilocks planets
        thoughtBubble.style.display = 'none'
        label.style.display = 'block'
        label.style.left = `${sx + 14}px`
        label.style.top = `${sy - 8}px`
        label.style.color = hex
        label.style.textShadow = `0 0 10px ${hex}`
        label.textContent = pi.label
      }
    } else {
      label.style.display = 'none'
      thoughtBubble.style.display = 'none'
    }

    // Corner nav — detect which corner (if any) the mouse is in
    const W = window.innerWidth, H = window.innerHeight
    const cx = mouseScreenX, cy = mouseScreenY
    const inLeft  = cx < CORNER_MARGIN, inRight  = cx > W - CORNER_MARGIN
    const inTop   = cy < CORNER_MARGIN, inBottom = cy > H - CORNER_MARGIN
    const corner = (inLeft && inTop) ? 0 : (inRight && inTop) ? 1 : (inLeft && inBottom) ? 2 : (inRight && inBottom) ? 3 : -1

    if (corner !== activeCorner) {
      if (activeCorner >= 0) { cornerEls[activeCorner].style.color = 'rgba(255,255,255,0)'; setTimeout(() => { if (activeCorner !== corner) cornerEls[activeCorner >= 0 ? activeCorner : 0].style.display = 'none' }, 280) }
      activeCorner = corner
      if (corner >= 0) { cornerEls[corner].style.display = 'block'; requestAnimationFrame(() => { cornerEls[corner].style.color = 'rgba(255,255,255,0.55)' }) }
    }

    renderer.domElement.style.cursor = corner >= 0 ? 'pointer' : (starHovered || hoveredPlanetIdx >= 0) ? 'pointer' : (isDragging ? 'grabbing' : 'grab')
    solarSystem?.update(dt, starHovered, hoveredPlanetIdx)

    // Time warp on drag (same as galaxy)
    const solarTargetScale = isDragging ? 1 + solarDragSpeed * 0.18 : 1.0
    timeScale += (solarTargetScale - timeScale) * 0.06
    solarDragSpeed *= 0.8
    animTime += dt * timeScale

    if (!isDragging) {
      // Triple inertia + gentle mouse attraction (theta ↔ mouseX, phi ↔ -mouseY)
      solarVelTheta += (mouseX * 0.00018 + 0.00033 - solarVelTheta) * 0.027
      solarVelPhi   += (-mouseY * 0.00012 - solarVelPhi) * 0.027
      solarCamTheta += solarVelTheta
      solarCamPhi = Math.max(0.12, Math.min(Math.PI / 2, solarCamPhi + solarVelPhi))
    }

    camera.position.copy(solarCamPos())
    camera.lookAt(0, 0, 0)
    renderer.domElement.style.cursor = isDragging ? 'grabbing' : 'grab'

  } else if (state === 'planet') {
    planetView?.update(dt)

    // Painting: raycast against planet mesh while mouse is held and element selected
    if (planetView && isPaintDragging && selectedElement) {
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(planetView.group.children, false)
      if (hits.length > 0) {
        const cellIdx = planetView.nearestCell(hits[0].point)
        planetView.paint(cellIdx, selectedElement)
      }
    }

    // Update status bar
    if (planetView) {
      const score = planetView.matchScore
      const pct   = Math.round(planetView.litFraction * 100)
      const bars  = Math.round(score * 10)
      const resonBar = '█'.repeat(bars) + '░'.repeat(10 - bars)
      const scoreColor = score > 0.65 ? '#44ff88' : score > 0.35 ? '#ffdd44' : '#ff4422'
      planetStatus.innerHTML =
        `coverage <span style="color:#aaa">${pct}%</span>&nbsp;&nbsp;` +
        `attunement <span style="color:${scoreColor}">${resonBar}</span>`

      updateElementUI()

      const outcome = planetView.outcome
      if (outcome === 'won' && !document.getElementById('planet-outcome')) showOutcome('attuned', '#44ff88')
      else if (outcome === 'lost' && !document.getElementById('planet-outcome')) showOutcome('planet lost', '#ff4422')
    }

    // Cursor: show element color cursor when element selected and hovering planet
    let planetHovered = false
    if (planetView && selectedElement) {
      raycaster.setFromCamera(mouse, camera)
      planetHovered = raycaster.intersectObjects(planetView.group.children, false).length > 0
    }

    // Corner nav
    const W = window.innerWidth, H = window.innerHeight
    const corner = (mouseScreenX < CORNER_MARGIN && mouseScreenY < CORNER_MARGIN) ? 0
      : (mouseScreenX > W - CORNER_MARGIN && mouseScreenY < CORNER_MARGIN) ? 1
      : (mouseScreenX < CORNER_MARGIN && mouseScreenY > H - CORNER_MARGIN) ? 2
      : (mouseScreenX > W - CORNER_MARGIN && mouseScreenY > H - CORNER_MARGIN) ? 3 : -1

    if (corner !== activeCorner) {
      if (activeCorner >= 0) { cornerEls[activeCorner].style.color = 'rgba(255,255,255,0)' }
      activeCorner = corner
      cornerEls.forEach((el, i) => {
        el.style.display = i === corner ? 'block' : 'none'
        if (i === corner) requestAnimationFrame(() => { el.style.color = 'rgba(255,255,255,0.55)' })
      })
    }
    renderer.domElement.style.cursor = corner >= 0 ? 'pointer' : planetHovered ? 'crosshair' : 'default'
  }

  renderer.render(scene, camera)
}
requestAnimationFrame(animate)
