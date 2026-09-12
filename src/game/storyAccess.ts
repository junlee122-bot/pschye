import { missions } from '../data/campaign';
import { characters } from '../data/lore';
import { originStoryScenes } from '../data/originStory';
import type { CampaignProfile, CharacterRecord } from '../types';

export type StoryProgress = Pick<CampaignProfile, 'originStory' | 'completedMissions' | 'unlockedRecords'>;

export function getCompletedOriginScenes(profile: StoryProgress) {
  return originStoryScenes.filter((scene) => profile.originStory.completed || profile.originStory.completedSceneIds.includes(scene.id));
}

export function getKnownMissions(profile: StoryProgress) {
  return missions.filter((mission) => profile.completedMissions.includes(mission.id)
    || (profile.originStory.completed && mission.prerequisites.every((id) => profile.completedMissions.includes(id))));
}

export function hasMissionWitness(profile: StoryProgress, missionId: string) {
  return profile.completedMissions.includes(missionId)
    && Boolean(missions.find((mission) => mission.id === missionId)?.revelation)
    && profile.unlockedRecords.includes(`witness-${missionId}`);
}

export function getPlayerTestimonies(profile: StoryProgress) {
  return missions.filter((mission) => hasMissionWitness(profile, mission.id)).map((mission) => ({
    id: mission.id, title: mission.title, heroId: mission.revelation!.heroId,
    speaker: mission.enemies.find((enemy) => enemy.id === mission.revelation!.enemyId)?.name ?? '현장 증언',
    text: mission.revelation!.line,
  }));
}

const publicNotes: Record<string, { role: string; summary: string; style: string; weapon: string }> = {
  raon: { role: '변방 마을의 소년', summary: '놀기를 좋아하고 체능 훈련에는 서툴다. 사람의 표정과 위험한 순간을 유심히 살핀다.', style: '수련 중', weapon: '훈련용 검' },
  kazrin: { role: '소꿉친구 · 창술 신동', summary: '마을에서 라온과 함께 자란 창술 신동. 프시케 선발을 준비한다.', style: '라티계 앤류', weapon: '창' },
  kain: { role: '명문 무가의 지원자', summary: '기욤과 벨라트리체의 아들. 자신의 재능과 정확한 창술을 자부한다.', style: '기욤류 · 앤류', weapon: '창' },
  hadori: { role: '괴력의 지원자', summary: '과묵하고 신체 능력이 뛰어나다. 위험한 순간에는 말보다 먼저 움직인다.', style: '신체 능력', weapon: '글러브' },
  leo: { role: '기본기에 충실한 동료', summary: '말수가 적고 기본기를 반복하는 진훤류 사용자. 주변 사람의 상태를 살핀다.', style: '진훤류', weapon: '맨손과 단검' },
  chris: { role: '상인 귀족 출신 검사', summary: '가벼운 미소와 능숙한 검술이 눈에 띄는 제7기의 동료.', style: '리스트류', weapon: '세이버' },
  jinhwon: { role: '프시케 전체 단장', summary: '기본기를 중시하고 신입 선발에도 직접 참여하는 프시케 단장.', style: '진훤류', weapon: '맨손격투' },
  maru: { role: '은둔 현자', summary: '구시대 라면에 집착하는 괴짜. 라온이 검을 배우기 위해 찾아간 사람.', style: '관찰과 검술 지도', weapon: '나뭇가지와 단검' },
};

/** Build a player projection explicitly: author epithets, quotes and endings never cross this boundary. */
export function getPlayerCharacters(profile: StoryProgress): CharacterRecord[] {
  const scenes = getCompletedOriginScenes(profile);
  const known = new Set(['raon', ...scenes.map((scene) => scene.speakerId)]);
  if (profile.originStory.completed) ['kazrin', 'kain', 'hadori', 'leo', 'chris', 'jinhwon', 'maru'].forEach((id) => known.add(id));
  const testimony = getPlayerTestimonies(profile);
  return characters.filter((character) => known.has(character.id) && publicNotes[character.id]).map((character) => {
    const note = publicNotes[character.id];
    const witnessed = testimony.filter((entry) => entry.heroId === character.id);
    const past = scenes.filter((scene) => scene.speakerId === character.id);
    const portrait = character.id === 'jinhwon' || character.id === 'maru'
      ? `/art/portraits/${character.id}-stage-v2.png` : `/art/portraits/${character.id}-v1.webp`;
    return {
      id: character.id, name: character.name, romanized: character.romanized, era: character.era,
      art: portrait, accent: character.accent, epithet: note.role,
      generation: profile.originStory.completed && character.era === '7기' ? character.generation : note.role,
      affiliation: profile.originStory.completed ? '프시케와 그 주변' : '라온의 여정',
      role: note.role, weapon: note.weapon,
      style: character.id === 'raon' && scenes.some((scene) => scene.id === 'sixteen-petals') ? '해찬류의 16꽃잎을 수련 중' : note.style,
      officialSummary: note.summary,
      hiddenTruth: witnessed.map((entry) => `${entry.title} · ${entry.speaker}: ${entry.text}`).join('\n\n'),
      quote: past.at(-1)?.dialogue ?? '',
      readerJourney: past.map((scene) => scene.title),
      keywords: [note.weapon, note.style],
    };
  });
}

export function getPlayerMemories(profile: StoryProgress) {
  return [
    ...getCompletedOriginScenes(profile).map((scene) => {
      const choice = scene.choices.find((entry) => entry.id === profile.originStory.choices[scene.id]);
      return {
        id: `origin-${scene.id}`, title: scene.title, period: scene.time, location: scene.location,
        image: scene.background, summary: scene.narration.join(' '),
        choice: choice ? `${choice.title} — ${choice.result}` : undefined,
      };
    }),
    ...missions.filter((mission) => profile.completedMissions.includes(mission.id)).map((mission) => ({
      id: `mission-${mission.id}`, title: mission.title, period: mission.operation, location: mission.objectiveLabel,
      image: mission.background, summary: mission.summary, choice: undefined,
    })),
  ];
}

export function isAuthorWorkspace(development: boolean, search: string) {
  return development && new URLSearchParams(search).get('workspace') === 'author';
}
