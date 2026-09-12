import { describe, expect, it } from 'vitest';
import {
  getEpisodeScenes,
  getGrandStoryEpisode,
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

  it('does not promote scene plans to confirmed canon when generating the atlas', () => {
    for (const saga of grandStorySagas) {
      expect(saga.canonStatus, saga.id).toBe('adaptation-draft');
      expect(saga.canonNotice, saga.id).toContain('각색 초안');
    }
    for (const entry of grandStoryEpisodes) {
      expect(['adaptation-draft', 'undecided'], entry.id).toContain(entry.canonStatus);
      for (const scene of getEpisodeScenes(entry.id)) {
        expect(scene.canonStatus, scene.id).toBe(entry.canonStatus);
        expect(scene.canonNotice, scene.id).toBe(entry.canonNotice);
      }
    }
  });

  it('leaves Kain’s outcome unresolved instead of guaranteeing survival, injury, or final battle participation', () => {
    const ending = getGrandStoryEpisode('kain-final-choice');
    expect(ending?.canonStatus).toBe('undecided');
    expect(ending?.canonNotice).toContain('§55·133·171.6.1');
    expect(ending?.beats.at(-1)?.[2]).toContain('성공 여부와 생사, 후유증, 이후 책임 방식은 미정');
    expect(ending?.cliffhanger).toContain('카인의 생존이나 희생 결과로 확정하지 않는다');
    const scenes = getEpisodeScenes('kain-final-choice');
    expect(scenes).toHaveLength(6);
    expect(scenes.every((scene) => scene.canonStatus === 'undecided')).toBe(true);
    expect(scenes.map((scene) => scene.summary).join(' ')).not.toMatch(/오른손 감각을 잃|살아서 책임지기로 한다|생존해 긴 속죄를 시작/);

    const finalBattle = getGrandStoryEpisode('raon-style-final');
    expect(finalBattle?.cast).not.toContain('카인');
    expect(finalBattle?.choices.join(' ')).not.toContain('카인');
    expect(finalBattle?.canonNotice).toContain('최종전 합류를 확정하지 않습니다');
  });

  it('does not place Denin traits or remnants of the first light before the first light', () => {
    const episodes = getSagaEpisodes('lami-origin');
    const firstLightIndex = episodes.findIndex((entry) => entry.id === 'achero-light');
    expect(firstLightIndex).toBeGreaterThan(0);
    const beforeLight = episodes.slice(0, firstLightIndex);
    const corpus = beforeLight.flatMap((entry) => [
      entry.title, entry.location, entry.theme, entry.choicePrompt,
      ...entry.cast, ...entry.choices, ...entry.beats.flat(), entry.cliffhanger,
    ]).join(' ');
    expect(corpus).not.toMatch(/데닌|붉은 머리|날개와 사능을 빼앗|고대 빛|빛 잔해/);
    expect(beforeLight.find((entry) => entry.id === 'denin-betrayal')?.title).toBe('닫힌 피난처');
    expect(getEpisodeScenes('denin-betrayal')).toHaveLength(6);
    expect(episodes[0]?.time).toContain('연대 미정');
    expect(episodes[firstLightIndex]?.time).toContain('연대 미정');
  });

  it('preserves the sourced first-light change without deciding Denin ancestry or Lami’s access to the light', () => {
    const firstLight = getGrandStoryEpisode('achero-light');
    expect(firstLight?.canonStatus).toBe('adaptation-draft');
    const change = firstLight?.beats.find(([title]) => title === '붉은 머리의 탄생')?.[2];
    expect(change).toContain('아케로의 빛 이후 반대파는 붉은 머리가 되고 날개·사능을 잃는다');
    expect(change).toContain('데닌이 이들 자신을 뜻하는지 후손의 별도 명칭인지는 미정');
    expect(firstLight?.cliffhanger).toContain('빛에 접근한 구체 방식은 미정');
    expect(firstLight?.cliffhanger).not.toContain('설계 일부를 훔치고');
  });
});
