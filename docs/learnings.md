# StarSeek — Development Learnings

Accumulated insights from building StarSeek. Use `/log-learning` to add entries, `/recap` to create session recaps.

---

## Learnings

### 2026-02-16 — Hot/cold world thermal pressure creates real tension
Implementing passive thermal decay (hot worlds drain non-fire cells; frozen worlds extinguish fire) transforms planet attunement from a painting puzzle into a living struggle. The key insight: the pressure scales with tempNorm, so the most extreme worlds are hardest. Players need different strategies per world type — this is the replayability engine.

### 2026-02-16 — Eon narrative on failure reframes loss as geological time
Instead of "try again", show a 1-line story of eons passing before the next cataclysm. This turns failure from frustration into wonder. The static `PlanetView.randomEonTale()` pattern is clean — it lives with the gameplay code, not the UI code.

### 2026-02-16 — Galaxy phenomena need world-stable coordinates
Galaxy phenomena must be added to `scene`, not `galaxyGroup`. The galaxy group rotates on drag, which would make phenomena orbit with it. This is subtle — everything _looks_ fine until you drag and see phenomena spinning.

### 2026-02-16 — Invalid hex literals are a recurring trap
TypeScript doesn't catch `0xm01e` or `0xuf0` at the type level — they produce JS syntax errors at runtime. Pattern: always double-check `0x` literals when writing seed constants. Use simple values like `0xf01e` or `0xb04e`.

### 2026-02-16 — Edit tool requires unique old_string
When the same code pattern repeats in a file (e.g. `dispose()` closings), the Edit tool fails with "Found N matches". Solution: include more surrounding context in `old_string` to make it unique, or use `replace_all: true` for intentional global replacements.

### 2026-02-16 — nearestCell worldToLocal is critical for rotated planets
After the planet group is rotated (spin drag), raycasting hits are in world space but cell centroids are in local space. `group.worldToLocal(worldPoint.clone()).normalize()` fixes this. Without it, painting and hitting diverge after any spin.

### 2026-02-16 — Scroll-past-max as navigation gesture feels natural
Instead of adding a separate "return to galaxy" button in the solar system, triggering `goBack()` when the user scrolls past max zoom distance is intuitive. Pair it with a fading hint ("↑ scroll to return to galaxy") that appears as they approach the limit.

### 2026-02-16 — Story fragments on hover are more engaging than "Start here?"
Replacing a generic call-to-action with evocative atmospheric text ("the survey team never filed a report") makes hovering a discovery in itself. 15 fragments cycling by system ID ensures variety. Keep them short (< 8 words), suggestive, and open-ended.

### 2026-02-16 — InstancedMesh for asteroid belts outperforms individual meshes
1–3 belts × up to 60 asteroids = up to 180 objects. Using InstancedMesh with per-asteroid Float32Array data (angle, rotation axis, yOffset, scale) and a single dummy Object3D for matrix computation is the correct Three.js pattern. Updating per frame with setMatrixAt + instanceMatrix.needsUpdate works cleanly.

### 2026-02-16 — BFS zone generation with random frontier selection creates organic shapes
Standard BFS grows circles. Selecting a random element from the frontier instead of the oldest produces irregular, organic blobs — much better for attunement zones. This is the `frontier.splice(Math.floor(rand() * frontier.length), 1)[0]` pattern.

---

## Recurring Bugs to Watch

- Non-hex characters in `0x` literals (TypeScript silent, runtime syntax error)
- Edit tool non-unique match (add more surrounding context)
- Phenomena attached to rotating group instead of scene
- Planet painting ignoring rotation (missing `worldToLocal`)
- Audio context not unlocked (must call `unlockAudio()` on first user interaction)
