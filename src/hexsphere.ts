// Hexagonal sphere via dual of a subdivided icosahedron.
// Produces ~all hexagons with exactly 12 pentagons (geodesic / Goldberg polyhedron).

import * as THREE from 'three'

const PHI = (1 + Math.sqrt(5)) / 2

const BASE_VERTS: [number, number, number][] = [
  [-1,  PHI, 0], [ 1,  PHI, 0], [-1, -PHI, 0], [ 1, -PHI, 0],
  [ 0, -1,  PHI], [ 0,  1,  PHI], [ 0, -1, -PHI], [ 0,  1, -PHI],
  [ PHI, 0, -1], [ PHI, 0,  1], [-PHI, 0, -1], [-PHI, 0,  1],
]

const BASE_FACES: [number, number, number][] = [
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
]

function getMid(verts: THREE.Vector3[], a: number, b: number, cache: Map<string, number>): number {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const idx = verts.length
  verts.push(verts[a].clone().add(verts[b]).normalize())
  cache.set(key, idx)
  return idx
}

function subdivide(
  verts: THREE.Vector3[],
  faces: [number, number, number][],
  levels: number
): [number, number, number][] {
  let cur = faces
  for (let l = 0; l < levels; l++) {
    const cache = new Map<string, number>()
    const next: [number, number, number][] = []
    for (const [a, b, c] of cur) {
      const ab = getMid(verts, a, b, cache)
      const bc = getMid(verts, b, c, cache)
      const ca = getMid(verts, c, a, cache)
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca])
    }
    cur = next
  }
  return cur
}

// Sort the faces surrounding a vertex into cyclic (ring) order.
// Relies on the fact that each face has exactly two edge-vertices (not vi).
function sortFacesAround(vi: number, fis: number[], faces: [number, number, number][]): number[] {
  if (fis.length <= 2) return fis

  // edge vertices per face
  const ev = new Map<number, [number, number]>()
  for (const fi of fis) {
    const [a, b, c] = faces[fi]
    const others = [a, b, c].filter(v => v !== vi) as [number, number]
    ev.set(fi, others)
  }

  // vertex → faces containing it
  const vf = new Map<number, number[]>()
  for (const fi of fis) {
    for (const v of ev.get(fi)!) {
      if (!vf.has(v)) vf.set(v, [])
      vf.get(v)!.push(fi)
    }
  }

  const sorted: number[] = []
  const seen = new Set<number>()
  let curr = fis[0]
  let [fwd] = ev.get(curr)! // pick one direction to walk

  while (sorted.length < fis.length) {
    if (seen.has(curr)) break
    sorted.push(curr)
    seen.add(curr)

    // next face shares edge (vi → fwd) with curr
    const next = (vf.get(fwd) ?? []).find(f => f !== curr && !seen.has(f))
    if (next === undefined) break

    // advance fwd to the other edge-vertex in next (not the shared one)
    const [e1, e2] = ev.get(next)!
    fwd = e1 === fwd ? e2 : e1
    curr = next
  }

  return sorted
}

export function buildHexSphere(subdivisions: number, radius: number, color: number): THREE.LineSegments {
  const verts = BASE_VERTS.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize())
  const faces = subdivide(verts, BASE_FACES.map(f => [f[0], f[1], f[2]]), subdivisions)

  // vertex → face list
  const vFaces: number[][] = Array.from({ length: verts.length }, () => [])
  for (let fi = 0; fi < faces.length; fi++) {
    for (const vi of faces[fi]) vFaces[vi].push(fi)
  }

  // face centroids on unit sphere
  const centroids = faces.map(([a, b, c]) =>
    verts[a].clone().add(verts[b]).add(verts[c]).normalize()
  )

  // Build line segments from dual edges (hex/penta outlines)
  const positions: number[] = []
  const edgeSeen = new Set<string>()

  function addEdge(a: THREE.Vector3, b: THREE.Vector3) {
    const ka = `${(a.x * 1e5) | 0},${(a.y * 1e5) | 0},${(a.z * 1e5) | 0}`
    const kb = `${(b.x * 1e5) | 0},${(b.y * 1e5) | 0},${(b.z * 1e5) | 0}`
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
    if (edgeSeen.has(key)) return
    edgeSeen.add(key)
    positions.push(
      a.x * radius, a.y * radius, a.z * radius,
      b.x * radius, b.y * radius, b.z * radius
    )
  }

  for (let vi = 0; vi < verts.length; vi++) {
    const fis = vFaces[vi]
    if (fis.length < 3) continue
    const ring = sortFacesAround(vi, fis, faces)
    for (let i = 0; i < ring.length; i++) {
      addEdge(centroids[ring[i]], centroids[ring[(i + 1) % ring.length]])
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })
  )
}

// ---------------------------------------------------------------------------
// Filled surface mesh for planet view — triangulated dual cells with
// dynamic per-cell vertex colours for the spreading civilisation animation.
// ---------------------------------------------------------------------------
export interface SurfaceMesh {
  mesh:           THREE.Mesh
  cellCount:      number
  topCell:        number                  // cell index closest to (0,1,0)
  adj:            number[][]              // adjacency list indexed by cell
  cellCentroids:  THREE.Vector3[]         // unit-sphere centre of each cell
  setCell(i: number, r: number, g: number, b: number): void
  flush():        void
}

export function buildSurfaceMesh(subdivisions: number, radius: number): SurfaceMesh {
  const verts = BASE_VERTS.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize())
  const faces = subdivide(verts, BASE_FACES.map(f => [f[0], f[1], f[2]]), subdivisions)

  const vFaces: number[][] = Array.from({ length: verts.length }, () => [])
  for (let fi = 0; fi < faces.length; fi++) {
    for (const vi of faces[fi]) vFaces[vi].push(fi)
  }

  const centroids = faces.map(([a, b, c]) =>
    verts[a].clone().add(verts[b]).add(verts[c]).normalize()
  )

  // Map: original vertex index → cell index (skip degenerate verts)
  const vertToCell = new Map<number, number>()
  const cellToVert: number[] = []
  for (let vi = 0; vi < verts.length; vi++) {
    if (vFaces[vi].length >= 3) {
      vertToCell.set(vi, cellToVert.length)
      cellToVert.push(vi)
    }
  }
  const cellCount = cellToVert.length

  // Cell adjacency from icosphere edges
  const adj: number[][] = Array.from({ length: cellCount }, () => [])
  for (const [a, b, c] of faces) {
    for (const [x, y] of [[a, b], [b, c], [a, c]] as [number, number][]) {
      const ci = vertToCell.get(x), cj = vertToCell.get(y)
      if (ci !== undefined && cj !== undefined && !adj[ci].includes(cj)) {
        adj[ci].push(cj); adj[cj].push(ci)
      }
    }
  }

  // Build triangulated geometry — fan from poly[0] for each hex/penta cell
  const posArr: number[] = []
  const colArr: number[] = []
  const cellStart: number[] = new Array(cellCount)
  const cellLen:   number[] = new Array(cellCount)

  for (let ci = 0; ci < cellCount; ci++) {
    const vi   = cellToVert[ci]
    const ring = sortFacesAround(vi, vFaces[vi], faces)
    const poly = ring.map(fi => centroids[fi])
    cellStart[ci] = posArr.length / 3
    for (let i = 1; i < poly.length - 1; i++) {
      for (const p of [poly[0], poly[i], poly[i + 1]]) {
        posArr.push(p.x * radius, p.y * radius, p.z * radius)
        colArr.push(0, 0, 0)
      }
    }
    cellLen[ci] = posArr.length / 3 - cellStart[ci]
  }

  const colAttr = new THREE.Float32BufferAttribute(new Float32Array(colArr), 3)
  colAttr.setUsage(THREE.DynamicDrawUsage)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geo.setAttribute('color', colAttr)

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }))

  // Top cell: closest to (0, 1, 0)
  let topCell = 0, topY = -Infinity
  for (let ci = 0; ci < cellCount; ci++) {
    const y = verts[cellToVert[ci]].y
    if (y > topY) { topY = y; topCell = ci }
  }

  function setCell(i: number, r: number, g: number, b: number) {
    const arr = colAttr.array as Float32Array
    const s = cellStart[i], n = cellLen[i]
    for (let v = s; v < s + n; v++) { arr[v * 3] = r; arr[v * 3 + 1] = g; arr[v * 3 + 2] = b }
  }

  function flush() { colAttr.needsUpdate = true }

  // Cell centroids on unit sphere — average of the face centroids in the ring
  const cellCentroids: THREE.Vector3[] = []
  for (let ci = 0; ci < cellCount; ci++) {
    cellCentroids.push(verts[cellToVert[ci]].clone().normalize())
  }

  return { mesh, cellCount, topCell, adj, cellCentroids, setCell, flush }
}
