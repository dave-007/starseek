# StarSeek

## What Is This?

StarSeek is a multiplatform game of elemental attunement and galactic exploration. Players begin at a single point on the surface of a sphere representing a playable galaxy. Each point is a solar system. The galaxy itself is a living, responsive ambient intelligence — not an opponent, but a partner to attune to.

## Core Loop

1. Arrive at a solar system (a point on the galactic sphere)
2. Zoom in to solar system level — discover planets, moons, asteroids
3. Zoom in again to planet/object level — from sun down to asteroid
4. Develop resources, discover hidden resources, express an elemental way of being
5. Attune — the galaxy responds to your choices, revealing and concealing
6. Build power sufficient to seek and hop to a nearby solar system
7. Repeat — each system is a fresh canvas shaped by your accumulated way of being

## Elemental Ways of Being

Players begin with four elemental affinities: Air, Earth, Fire, Water. These are not just resource types — they represent approaches to exploration, development, and interaction. The system elaborates over time as the player deepens their attunement.

## Key Design Decisions

- Platform: Web-native, multiplatform from day one
- Tech stack: Three.js or Babylon.js, TypeScript
- Visual style: Minimalist/abstract (think Osmos, .kkrieger)
- AI role: Ambient intelligence — the galaxy is alive and responsive, not adversarial
- Multiplayer: Single-player first, multiplayer added later
- Purpose: Personal exploration and learning; direction may evolve

## Project Structure

starseek/
├── CLAUDE.md          — this file
├── docs/
│   └── game-design.md — full game design document
├── src/               — game source code (TypeScript)
├── public/            — static assets, index.html
└── package.json

## Development Philosophy

This project follows a partnership approach to development — Claude Code is a co-creator, not just a tool. When working on StarSeek:

- Explore before optimizing — this is a discovery-phase project
- Favor clarity over cleverness — code should teach as well as function
- Respect the vision — the ambient intelligence concept is central, not a feature to bolt on later
- Small, playable increments — always keep something running in the browser

## Tech Notes

- TypeScript with ES modules
- Three.js (preferred) or Babylon.js for 3D rendering
- Vite for dev server and bundling
- No backend required initially — everything runs client-side
- Target: modern browsers (Chrome, Firefox, Safari, Edge)