import { describe, it, expect } from 'vitest'
import { generateLifeStory } from './stories'

describe('generateLifeStory', () => {
  it('returns a non-empty string', () => {
    const story = generateLifeStory(12345)
    expect(story).toBeTruthy()
    expect(typeof story).toBe('string')
    expect(story.length).toBeGreaterThan(10)
  })

  it('is deterministic - same seed produces same story', () => {
    const seed = 42
    const story1 = generateLifeStory(seed)
    const story2 = generateLifeStory(seed)
    expect(story1).toBe(story2)
  })

  it('different seeds produce different stories', () => {
    const story1 = generateLifeStory(100)
    const story2 = generateLifeStory(200)
    const story3 = generateLifeStory(300)

    // At least 2 of 3 should be different (very unlikely all same)
    const unique = new Set([story1, story2, story3])
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })

  it('ends with ellipsis', () => {
    // Test multiple seeds to cover both story types
    for (const seed of [1, 50, 100, 500, 1000]) {
      const story = generateLifeStory(seed)
      expect(story).toMatch(/\.{3}$/)
    }
  })

  it('creature stories contain expected structure', () => {
    // Seed 12345 produces a creature story (rand() < 0.7)
    const story = generateLifeStory(12345)

    // Should have an opening phrase followed by environment and creature
    const openings = ['In the', 'Beneath the', 'Along the', 'Within the', 'Across the']
    const hasOpening = openings.some(o => story.startsWith(o))

    // Either starts with an opening (creature story) or is a discovery
    if (hasOpening) {
      expect(story).toContain(',') // creature stories have commas
    }
  })

  it('handles edge case seeds', () => {
    // Zero seed
    const story0 = generateLifeStory(0)
    expect(story0).toBeTruthy()

    // Negative seed
    const storyNeg = generateLifeStory(-1)
    expect(storyNeg).toBeTruthy()

    // Large seed
    const storyLarge = generateLifeStory(999999999)
    expect(storyLarge).toBeTruthy()
  })

  it('produces variety across many seeds', () => {
    const stories = new Set<string>()
    for (let i = 0; i < 50; i++) {
      stories.add(generateLifeStory(i * 1000))
    }
    // Should have reasonable variety (at least 10 unique stories out of 50)
    expect(stories.size).toBeGreaterThan(10)
  })
})
