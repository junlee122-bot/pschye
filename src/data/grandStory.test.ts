import { describe, expect, it } from 'vitest';
import {
  getEpisodeScenes,
  getSagaEpisodes,
  grandStoryEpisodeCount,
  grandStoryEpisodes,
  grandStorySagas,
  grandStorySceneCount,
  grandStoryScenes,
} from './grandStory';

describe('grand story atlas', () => {
  it('builds the complete public-order saga as 86 episodes and 516 scenes', () => {
    expect(grandStorySagas).toHaveLength(5);
    expect(grandStoryEpisodeCount).toBe(86);
    expect(grandStorySceneCount).toBe(516);
    expect(grandStoryScenes.at(-1)?.globalOrder).toBe(516);
  });

  it('keeps every episode at six playable or observable scenes', () => {
    for (const entry of grandStoryEpisodes) {
      expect(entry.beats, entry.title).toHaveLength(6);
      expect(getEpisodeScenes(entry.id), entry.title).toHaveLength(6);
    }
  });

  it('keeps saga and scene identifiers unique', () => {
    expect(new Set(grandStoryEpisodes.map((entry) => entry.id)).size).toBe(grandStoryEpisodes.length);
    expect(new Set(grandStoryScenes.map((scene) => scene.id)).size).toBe(grandStoryScenes.length);
  });

  it('places a three-path Raon choice in the fifth scene of every episode', () => {
    for (const entry of grandStoryEpisodes) {
      const decision = getEpisodeScenes(entry.id)[4];
      expect(decision?.phase).toBe('decision');
      expect(decision?.choicePrompt).toBe(entry.choicePrompt);
      expect(decision?.choices?.map((choice) => choice.path)).toEqual(['compassion', 'insight', 'resolve']);
      expect(decision?.choices?.every((choice) => choice.line.length > 0)).toBe(true);
    }
  });

  it('preserves the intended reveal order and Raon viewpoint contract', () => {
    expect(grandStorySagas.map((saga) => saga.id)).toEqual([
      'petal-before-bloom',
      'erased-names',
      'six-banners',
      'second-great-war',
      'lami-origin',
    ]);
    expect(grandStorySagas.find((saga) => saga.id === 'six-banners')?.controller).toBe('raon-memory-observer');
    expect(grandStorySagas.find((saga) => saga.id === 'lami-origin')?.controller).toBe('raon-memory-observer');
    expect(grandStorySagas.find((saga) => saga.id === 'second-great-war')?.controller).toBe('raon-present');
  });

  it('covers the essential cast across the full narrative', () => {
    const corpus = grandStoryScenes
      .flatMap((scene) => [scene.title, scene.summary, scene.viewpoint, ...scene.cast])
      .join(' ');
    const requiredCharacters = [
      '라온', '해찬', '라미', '진훤', '앤', '마루', '가람', '나비', '니아',
      '하도리', '카즈린', '카인', '레오', '크리스', '루카', '키티',
      '크라우드', '캄프타', '아델린', '브리짓', '아벨', '모이라',
    ];

    for (const character of requiredCharacters) {
      expect(corpus, character).toContain(character);
    }
  });

  it('locks the decisive canon while keeping uncertain origins explicitly uncertain', () => {
    const haechanCanon = getSagaEpisodes('six-banners').map((entry) => `${entry.title} ${entry.theme} ${entry.beats.join(' ')}`).join(' ');
    const lamiCanon = getSagaEpisodes('lami-origin').map((entry) => `${entry.title} ${entry.theme} ${entry.beats.join(' ')}`).join(' ');

    expect(haechanCanon).toContain('해찬이 모두를 구했지만');
    expect(haechanCanon).toContain('가람');
    expect(haechanCanon).toContain('모든 권능');
    expect(haechanCanon).toContain('두 다리');
    expect(lamiCanon).toContain('정확한 혈통을 확정할 수 없다');
    expect(lamiCanon).toContain('이해와 면죄의 경계');
  });

  it('gives every scene enough production metadata to become game content', () => {
    for (const scene of grandStoryScenes) {
      expect(scene.title.length).toBeGreaterThan(1);
      expect(scene.summary.length).toBeGreaterThan(10);
      expect(scene.playerGoal.length).toBeGreaterThan(10);
      expect(scene.location.length).toBeGreaterThan(1);
      expect(scene.cast.length).toBeGreaterThan(0);
      expect(scene.continuity.length).toBeGreaterThan(5);
    }
  });
});
