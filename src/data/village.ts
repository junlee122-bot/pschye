import type { OriginStoryScene } from '../types';

export type VillageAmbience = 'dawn' | 'morning' | 'river-alert' | 'arrival' | 'night';

const villageArt = '/art/village';

export const villageMapAssets: Record<VillageAmbience, string> = {
  dawn: `${villageArt}/frontier-village-dawn.webp`,
  morning: `${villageArt}/frontier-village-morning.webp`,
  'river-alert': `${villageArt}/frontier-village-river-alert.webp`,
  arrival: `${villageArt}/frontier-village-arrival.webp`,
  night: `${villageArt}/frontier-village-night.webp`,
};

export const villageMinimapAsset = `${villageArt}/frontier-village-minimap.webp`;
export const villageRaonAsset = `${villageArt}/raon-explore.webp`;

export interface VillageInteractionPoint {
  sceneId: string;
  x: number;
  y: number;
  objective: string;
  landmark: string;
  prompt: string;
  ambience: VillageAmbience;
  targetSprite: string;
}

export interface VillageResident {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  sprite: string;
  height: number;
  schedule: string;
}

export interface VillageProp {
  id: string;
  x: number;
  y: number;
  sprite: string;
  height: number;
  alpha?: number;
}

export interface VillageLandmark {
  id: string;
  name: string;
  x: number;
  y: number;
  discoveryRadius: number;
}

export const villageInteractionPoints: VillageInteractionPoint[] = [
  {
    sceneId: 'village-dawn',
    x: 810,
    y: 346,
    objective: '훈련장의 카즈린을 찾아간다',
    landmark: '폐풍차 훈련터',
    prompt: '카즈린에게 오늘의 선발 이야기를 듣는다',
    ambience: 'dawn',
    targetSprite: `${villageArt}/kazrin-explore.webp`,
  },
  {
    sceneId: 'windmill-trouble',
    x: 744,
    y: 366,
    objective: '카인의 창끝 앞에 선다',
    landmark: '풍차 아래 대련장',
    prompt: '카인과의 대련에 개입한다',
    ambience: 'morning',
    targetSprite: `${villageArt}/kain-explore.webp`,
  },
  {
    sceneId: 'river-incident',
    x: 932,
    y: 548,
    objective: '북쪽 수로의 비명을 확인한다',
    landmark: '저주받은 수로',
    prompt: '물속에서 들리는 울음을 확인한다',
    ambience: 'river-alert',
    targetSprite: `${villageArt}/kazrin-explore.webp`,
  },
  {
    sceneId: 'recruiters-arrive',
    x: 478,
    y: 348,
    objective: '공동회관의 선발 공고를 확인한다',
    landmark: '마을 공동회관',
    prompt: '벨라트리체에게 지원서를 받는다',
    ambience: 'arrival',
    targetSprite: `${villageArt}/psyche-recruiter.webp`,
  },
  {
    sceneId: 'departure-night',
    x: 1052,
    y: 244,
    objective: '마을 언덕에서 카즈린을 만난다',
    landmark: '오래된 풍차 언덕',
    prompt: '떠나기 전 마지막 약속을 남긴다',
    ambience: 'night',
    targetSprite: `${villageArt}/kazrin-explore.webp`,
  },
];

export const villageResidents: VillageResident[] = [
  { id: 'baker', name: '마르타', role: '마을 빵집 주인', x: 224, y: 557, sprite: `${villageArt}/maryu-baker.webp`, height: 88, schedule: '새벽에는 빵집, 오후에는 공동 우물' },
  { id: 'smith', name: '올렌', role: '대장장이', x: 571, y: 591, sprite: `${villageArt}/haren-smith.webp`, height: 94, schedule: '낮 동안 대장간에서 농기구를 고친다' },
  { id: 'fisher', name: '도안', role: '수로지기', x: 908, y: 535, sprite: `${villageArt}/arian-fisher.webp`, height: 91, schedule: '해 질 무렵 북쪽 수로를 순찰한다' },
  { id: 'child', name: '밀로', role: '풍차를 좋아하는 아이', x: 862, y: 379, sprite: `${villageArt}/baro-child.webp`, height: 72, schedule: '훈련터 주변에서 프시케 흉내를 낸다' },
  { id: 'stable', name: '세라', role: '마차 관리인', x: 352, y: 590, sprite: `${villageArt}/ella-stable.webp`, height: 91, schedule: '수도행 마차와 말을 준비한다' },
];

export const villageProps: VillageProp[] = [
  { id: 'hall-banner', x: 395, y: 348, sprite: `${villageArt}/prop-banner.webp`, height: 72 },
  { id: 'square-signpost', x: 610, y: 386, sprite: `${villageArt}/prop-signpost.webp`, height: 66 },
  { id: 'training-cart', x: 690, y: 410, sprite: `${villageArt}/prop-haycart.webp`, height: 64 },
  { id: 'forge-supplies', x: 636, y: 584, sprite: `${villageArt}/prop-supplies.webp`, height: 55 },
  { id: 'training-dummy-a', x: 700, y: 329, sprite: `${villageArt}/prop-dummy.webp`, height: 63, alpha: 0.92 },
  { id: 'training-dummy-b', x: 886, y: 337, sprite: `${villageArt}/prop-dummy.webp`, height: 58, alpha: 0.86 },
  { id: 'bakery-lantern', x: 286, y: 574, sprite: `${villageArt}/prop-lantern.webp`, height: 47 },
  { id: 'forge-lantern', x: 664, y: 596, sprite: `${villageArt}/prop-lantern.webp`, height: 48 },
  { id: 'river-lantern', x: 884, y: 593, sprite: `${villageArt}/prop-lantern.webp`, height: 43 },
  { id: 'road-flowers', x: 696, y: 619, sprite: `${villageArt}/prop-wildflowers.webp`, height: 55, alpha: 0.88 },
  { id: 'river-flowers', x: 950, y: 473, sprite: `${villageArt}/prop-wildflowers.webp`, height: 48, alpha: 0.78 },
];

export const villageLandmarks: VillageLandmark[] = [
  { id: 'bakery', name: '마르타의 빵집', x: 185, y: 505, discoveryRadius: 122 },
  { id: 'hall', name: '마을 공동회관', x: 324, y: 283, discoveryRadius: 150 },
  { id: 'smithy', name: '올렌의 대장간', x: 542, y: 545, discoveryRadius: 126 },
  { id: 'training', name: '폐풍차 훈련터', x: 805, y: 322, discoveryRadius: 156 },
  { id: 'hill', name: '오래된 풍차 언덕', x: 1060, y: 233, discoveryRadius: 138 },
  { id: 'river', name: '저주받은 수로', x: 944, y: 546, discoveryRadius: 132 },
];

export function getVillageInteraction(scene: OriginStoryScene) {
  return villageInteractionPoints.find((entry) => entry.sceneId === scene.id) ?? villageInteractionPoints[0];
}

export function isVillageOriginScene(scene: OriginStoryScene) {
  return scene.sequence <= villageInteractionPoints.length;
}
