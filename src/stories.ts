// Procedural story fragment generator for Goldilocks zone planets

function makePRNG(seed: number) {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

const CREATURES = [
  'crystalline beings', 'bioluminescent drifters', 'song-weavers',
  'root-walkers', 'tide-dancers', 'sky-grazers', 'stone-singers',
  'mist-dwellers', 'light-eaters', 'dream-swimmers', 'spore-keepers',
  'ember-moths', 'glass-fish', 'wind-spinners', 'coral-minds',
]

const ENVIRONMENTS = [
  'shallow seas', 'crystalline caves', 'floating forests',
  'geothermal vents', 'twilight shores', 'singing deserts',
  'luminous depths', 'cloud meadows', 'obsidian plains',
  'phosphorescent tidepools', 'amber valleys', 'whispering canyons',
]

const BEHAVIORS = [
  'pulse in rhythm with the twin moons',
  'weave patterns only the dying can read',
  'remember a time before the stars',
  'sing to seeds that have not yet fallen',
  'dream in colors that have no names',
  'tend gardens of frozen light',
  'speak only in questions',
  'build temples to forgotten visitors',
  'map the spaces between moments',
  'harvest silence from the deep places',
  'trade memories like currency',
  'paint the sky with their migrations',
]

const DISCOVERIES = [
  'Something ancient stirs beneath the surface...',
  'The first thought echoes still...',
  'They have been waiting...',
  'A signal repeats, patient and old...',
  'The stones remember what the water forgot...',
  'Life finds its way, always...',
  'In the quiet, something listens...',
  'The pattern emerges, then fades...',
  'What sleeps here dreams of the stars...',
  'The beginning was not the first beginning...',
]

const OPENINGS = [
  'In the',
  'Beneath the',
  'Along the',
  'Within the',
  'Across the',
]

export function generateLifeStory(seed: number): string {
  const rand = makePRNG(seed)

  // 70% chance: creature-based story, 30% chance: discovery-based
  if (rand() < 0.7) {
    const opening = OPENINGS[Math.floor(rand() * OPENINGS.length)]
    const env = ENVIRONMENTS[Math.floor(rand() * ENVIRONMENTS.length)]
    const creature = CREATURES[Math.floor(rand() * CREATURES.length)]
    const behavior = BEHAVIORS[Math.floor(rand() * BEHAVIORS.length)]
    return `${opening} ${env}, ${creature} ${behavior}...`
  } else {
    return DISCOVERIES[Math.floor(rand() * DISCOVERIES.length)]
  }
}
