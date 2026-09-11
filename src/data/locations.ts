import {
  getEpisodeScenes,
  grandStoryEpisodes,
  grandStorySagas,
  type GrandStoryEpisode,
  type GrandStorySagaId,
  type GrandStoryScene,
} from './grandStory';
import {
  getStoryBeatAsset,
  getStoryEpisodeAsset,
  getStoryEpisodeThumbnail,
  type StorySceneAssetVariant,
} from './sceneAssets';

export type WorldLocationCategory =
  | 'frontier'
  | 'psyche'
  | 'capital'
  | 'cursed-land'
  | 'cheshi'
  | 'denin'
  | 'battlefront'
  | 'memory';

export interface WorldLocationCategoryMeta {
  id: WorldLocationCategory;
  label: string;
  englishLabel: string;
  description: string;
  accent: string;
  cover: string;
}

export interface WorldLocationEpisode {
  id: string;
  title: string;
  chapter: string;
  time: string;
  sagaId: GrandStorySagaId;
  sagaTitle: string;
  theme: string;
  cast: string[];
  sceneCount: number;
  scenes: GrandStoryScene[];
}

export interface WorldLocationVisualSet {
  episodeId: string;
  thumbnail: string;
  variants: Record<StorySceneAssetVariant, string>;
  beats: string[];
}

export interface WorldLocation {
  id: string;
  name: string;
  category: WorldLocationCategory;
  categoryLabel: string;
  accent: string;
  cover: string;
  firstSagaId: GrandStorySagaId;
  firstSagaTitle: string;
  firstTime: string;
  primaryEpisodeId: string;
  episodeCount: number;
  sceneCount: number;
  visualCount: number;
  cast: string[];
  themes: string[];
  episodeIds: string[];
  episodes: WorldLocationEpisode[];
  visuals: WorldLocationVisualSet[];
  searchText: string;
}

export const worldLocationCategories: WorldLocationCategoryMeta[] = [
  {
    id: 'frontier',
    label: '변방과 마을',
    englishLabel: 'FRONTIER SETTLEMENTS',
    description: '라온의 시작점과 피난민 도로, 농촌·교량·설원에 흩어진 생활권입니다.',
    accent: '#c69a58',
    cover: '/art/locations/atlas-frontier.webp',
  },
  {
    id: 'psyche',
    label: '프시케 시설',
    englishLabel: 'PSYCHE FACILITIES',
    description: '훈련장, 기록보관소, 숙소와 지하 시설까지 제국 최정예 조직의 생활 공간입니다.',
    accent: '#d4b879',
    cover: '/art/locations/atlas-capital-psyche.webp',
  },
  {
    id: 'capital',
    label: '제국 수도',
    englishLabel: 'IMPERIAL CAPITAL',
    description: '황궁과 시민구, 성벽과 수로가 겹쳐진 현재 제국의 정치·생활 중심지입니다.',
    accent: '#7897b5',
    cover: '/art/locations/atlas-capital-psyche.webp',
  },
  {
    id: 'cursed-land',
    label: '저주받은 땅',
    englishLabel: 'THE CURSED LAND',
    description: '혼혈과 추방자들이 살아남은 균열 지대이자 라미와 가람의 시작점입니다.',
    accent: '#9a72b3',
    cover: '/art/locations/atlas-cursed-land.webp',
  },
  {
    id: 'cheshi',
    label: '체시 지배권',
    englishLabel: 'CHESHI DOMINION',
    description: '부유요새, 연구소, 처형탑과 수도권으로 이어지는 아름답고 억압적인 옛 지배체제입니다.',
    accent: '#d8d5cd',
    cover: '/art/locations/atlas-cheshi.webp',
  },
  {
    id: 'denin',
    label: '데닌 영지',
    englishLabel: 'DENIN TERRITORIES',
    description: '붉은 머리와 날개 없는 이들이 박해 속에서도 가문과 도시를 보존한 땅입니다.',
    accent: '#b7655d',
    cover: '/art/locations/atlas-denin.webp',
  },
  {
    id: 'battlefront',
    label: '전선과 작전지',
    englishLabel: 'WAR FRONTS',
    description: '여섯 군단과 제7기가 선택의 대가를 치르는 요새·야영지·작전 구역입니다.',
    accent: '#ad7f60',
    cover: '/art/generated/campaign-world-map.webp',
  },
  {
    id: 'memory',
    label: '기억과 금지구역',
    englishLabel: 'MEMORY SITES',
    description: '빛의 분화구와 삭제된 기록층처럼 과거가 현재를 침식하는 장소입니다.',
    accent: '#6fa3ad',
    cover: '/art/generated/campaign-world-map.webp',
  },
];

export const worldLocationCategoryById = Object.fromEntries(
  worldLocationCategories.map((category) => [category.id, category]),
) as Record<WorldLocationCategory, WorldLocationCategoryMeta>;

const deninKeywords = ['데닌', '아스텔', '벨루아', '아르카'];
const cheshiKeywords = ['체시', '부유요새', '처형대', '처형탑', '신성 주입', '대경기장'];
const cursedKeywords = ['저주받은', '가람 진영', '혼혈 도시', '연합촌', '자유 훈련도시'];
const psycheKeywords = ['프시케', '제3기', '제5기', '조장', '작전실'];
const capitalKeywords = ['황궁', '황실', '수도', '남문', '북문', '성벽', '상업구', '시민구', '병기열차', '의회당'];
const memoryKeywords = ['기억', '분화구', '기록고', '기록층', '기록보관소', '지워진', '제0구역'];
const frontierKeywords = ['마을', '촌락', '변방', '폐풍차', '교각', '설원', '검문선', '폐선로', '수로'];

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function inferWorldLocationCategory(name: string): WorldLocationCategory {
  if (includesAny(name, deninKeywords)) return 'denin';
  if (includesAny(name, cheshiKeywords)) return 'cheshi';
  if (includesAny(name, cursedKeywords)) return 'cursed-land';
  if (includesAny(name, psycheKeywords)) return 'psyche';
  if (includesAny(name, capitalKeywords)) return 'capital';
  if (includesAny(name, memoryKeywords)) return 'memory';
  if (includesAny(name, frontierKeywords)) return 'frontier';
  if (name.includes('훈련장')) return 'psyche';
  return 'battlefront';
}

function createLocationEpisode(entry: GrandStoryEpisode): WorldLocationEpisode {
  const saga = grandStorySagas.find((candidate) => candidate.id === entry.sagaId);
  const scenes = getEpisodeScenes(entry.id);

  return {
    id: entry.id,
    title: entry.title,
    chapter: entry.chapter,
    time: entry.time,
    sagaId: entry.sagaId,
    sagaTitle: saga?.title ?? entry.sagaId,
    theme: entry.theme,
    cast: entry.cast,
    sceneCount: scenes.length,
    scenes,
  };
}

function createLocationVisualSet(entry: GrandStoryEpisode): WorldLocationVisualSet {
  return {
    episodeId: entry.id,
    thumbnail: getStoryEpisodeThumbnail(entry.id),
    variants: {
      explore: getStoryEpisodeAsset(entry.id, 'explore'),
      dialogue: getStoryEpisodeAsset(entry.id, 'dialogue'),
      battle: getStoryEpisodeAsset(entry.id, 'battle'),
      aftermath: getStoryEpisodeAsset(entry.id, 'aftermath'),
    },
    beats: entry.beats.map((_, index) => getStoryBeatAsset(entry.id, index + 1)),
  };
}

function buildWorldLocations(): WorldLocation[] {
  const grouped = new Map<string, GrandStoryEpisode[]>();

  for (const entry of grandStoryEpisodes) {
    const existing = grouped.get(entry.location) ?? [];
    existing.push(entry);
    grouped.set(entry.location, existing);
  }

  return Array.from(grouped.entries()).map(([name, entries], index) => {
    const primary = entries[0];
    const category = inferWorldLocationCategory(name);
    const categoryMeta = worldLocationCategoryById[category];
    const saga = grandStorySagas.find((candidate) => candidate.id === primary.sagaId);
    const episodes = entries.map(createLocationEpisode);
    const visuals = entries.map(createLocationVisualSet);
    const cast = Array.from(new Set(entries.flatMap((entry) => entry.cast)));
    const themes = Array.from(new Set(entries.map((entry) => entry.theme)));
    const searchText = [
      name,
      categoryMeta.label,
      categoryMeta.englishLabel,
      ...cast,
      ...themes,
      ...entries.flatMap((entry) => [entry.title, entry.chapter, entry.time]),
    ].join(' ').toLocaleLowerCase('ko-KR');

    return {
      id: `location-${String(index + 1).padStart(3, '0')}-${primary.id}`,
      name,
      category,
      categoryLabel: categoryMeta.label,
      accent: categoryMeta.accent,
      cover: categoryMeta.cover,
      firstSagaId: primary.sagaId,
      firstSagaTitle: saga?.title ?? primary.sagaId,
      firstTime: primary.time,
      primaryEpisodeId: primary.id,
      episodeCount: entries.length,
      sceneCount: episodes.reduce((total, entry) => total + entry.sceneCount, 0),
      visualCount: entries.length * 11,
      cast,
      themes,
      episodeIds: entries.map((entry) => entry.id),
      episodes,
      visuals,
      searchText,
    };
  });
}

export const worldLocations = buildWorldLocations();
export const worldLocationCount = worldLocations.length;
export const worldLocationVisualCount = worldLocations.reduce((total, location) => total + location.visualCount, 0);

export function getWorldLocation(locationId: string) {
  return worldLocations.find((location) => location.id === locationId);
}

export function getWorldLocationByName(name: string) {
  return worldLocations.find((location) => location.name === name);
}

export function getWorldLocationsByCategory(category: WorldLocationCategory) {
  return worldLocations.filter((location) => location.category === category);
}
