import { describe, expect, it } from 'vitest';
import { grandStoryEpisodes } from './grandStory';
import {
  worldLocationCategories,
  worldLocationCount,
  worldLocations,
  worldLocationVisualCount,
} from './locations';

describe('world location atlas', () => {
  it('covers every grand-story location without duplicates', () => {
    const uniqueStoryLocations = new Set(grandStoryEpisodes.map((entry) => entry.location));

    expect(worldLocationCount).toBe(85);
    expect(worldLocationCount).toBe(uniqueStoryLocations.size);
    expect(new Set(worldLocations.map((location) => location.name)).size).toBe(worldLocationCount);
    expect(new Set(worldLocations.flatMap((location) => location.episodeIds)).size).toBe(grandStoryEpisodes.length);
  });

  it('assigns every location to a populated production category', () => {
    expect(worldLocationCategories).toHaveLength(8);

    for (const category of worldLocationCategories) {
      const categoryLocations = worldLocations.filter((location) => location.category === category.id);
      expect(categoryLocations.length, category.label).toBeGreaterThan(0);
      expect(category.cover, category.label).toMatch(/^\/art\/.+\.webp$/);
    }
  });

  it('provides eleven production visuals for every episode appearance', () => {
    expect(worldLocationVisualCount).toBe(946);

    for (const location of worldLocations) {
      expect(location.visualCount, location.name).toBe(location.episodeCount * 11);
      expect(location.visuals, location.name).toHaveLength(location.episodeCount);

      for (const visual of location.visuals) {
        const assets = [
          visual.thumbnail,
          ...Object.values(visual.variants),
          ...visual.beats,
        ];

        expect(assets, `${location.name}/${visual.episodeId}`).toHaveLength(11);
        expect(new Set(assets).size, `${location.name}/${visual.episodeId}`).toBe(11);

        expect(assets.every((asset) => /^\/art\/.+\.webp$/.test(asset))).toBe(true);
      }
    }
  });

  it('keeps location search metadata and story links production-ready', () => {
    for (const location of worldLocations) {
      expect(location.name.length).toBeGreaterThan(1);
      expect(location.searchText).toContain(location.name.toLocaleLowerCase('ko-KR'));
      expect(location.cast.length).toBeGreaterThan(0);
      expect(location.themes.length).toBeGreaterThan(0);
      expect(location.sceneCount).toBe(location.episodeCount * 6);
      expect(location.episodes.every((episode) => episode.scenes.length === 6)).toBe(true);
    }
  });
});
