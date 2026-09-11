import type { RaonStoryChoiceId } from '../types';

export type CharacterEmotion = 'warm' | 'guarded' | 'focused' | 'uneasy' | 'resolved';
export type CharacterCamera = 'intimate' | 'balanced' | 'confrontation';

export interface CharacterPresentation {
  id: string;
  name: string;
  title: string;
  portrait: string;
  cardFolder: string;
  accent: string;
  focus: string;
}

export interface CharacterSceneDirection {
  camera: CharacterCamera;
  speakerEmotion: CharacterEmotion;
  raonEmotion: CharacterEmotion;
  beatLabel: string;
  cardStage: string;
}

const portraits = '/art/portraits';
const characters = '/art/characters';

export const characterPresentations: Record<string, CharacterPresentation> = {
  raon: {
    id: 'raon',
    name: '라온',
    title: '제7기 제2조장 · 미완의 검',
    portrait: `${portraits}/raon-v1.webp`,
    cardFolder: 'raon',
    accent: '#d59a55',
    focus: '50% 28%',
  },
  hadori: {
    id: 'hadori',
    name: '하도리',
    title: '제7기 제1조장 · 전선 지휘',
    portrait: `${portraits}/hadori-v1.webp`,
    cardFolder: 'hadori',
    accent: '#9aabb4',
    focus: '50% 26%',
  },
  kazrin: {
    id: 'kazrin',
    name: '카즈린',
    title: '제7기 제3조장 · 백은의 창',
    portrait: `${portraits}/kazrin-v1.webp`,
    cardFolder: 'kazrin',
    accent: '#d9d6c8',
    focus: '50% 25%',
  },
  kain: {
    id: 'kain',
    name: '카인',
    title: '제7기 제4조장 · 발데르의 창',
    portrait: `${portraits}/kain-v1.webp`,
    cardFolder: 'kain',
    accent: '#aa8b72',
    focus: '50% 25%',
  },
  leo: {
    id: 'leo',
    name: '레오',
    title: '제7기 제5조장 · 침묵의 중심',
    portrait: `${portraits}/leo-v1.webp`,
    cardFolder: 'leo',
    accent: '#b9ad94',
    focus: '50% 27%',
  },
  chris: {
    id: 'chris',
    name: '크리스',
    title: '제7기 제6조장 · 균형검',
    portrait: `${portraits}/chris-v1.webp`,
    cardFolder: 'chris',
    accent: '#d4aa64',
    focus: '50% 25%',
  },
  bellatrice: {
    id: 'bellatrice',
    name: '벨라트리체',
    title: '앤류 창술가 · 선발 추천인',
    portrait: `${portraits}/bellatrice-stage-v2.png`,
    cardFolder: 'bellatrice',
    accent: '#caa277',
    focus: '50% 11%',
  },
  kangrim: {
    id: 'kangrim',
    name: '강림',
    title: '프시케 교관 · 봉인된 속도',
    portrait: `${portraits}/kangrim-stage-v2.png`,
    cardFolder: 'kangrim',
    accent: '#7f9aa4',
    focus: '50% 10%',
  },
  jinhwon: {
    id: 'jinhwon',
    name: '진훤',
    title: '프시케 전체 단장 · 기본기의 극치',
    portrait: `${portraits}/jinhwon-stage-v2.png`,
    cardFolder: 'jinhwon',
    accent: '#a88f67',
    focus: '50% 9%',
  },
  maru: {
    id: 'maru',
    name: '마루',
    title: '비공식 제5조장 · 은둔한 현자',
    portrait: `${portraits}/maru-stage-v2.png`,
    cardFolder: 'maru',
    accent: '#b2915e',
    focus: '50% 12%',
  },
};

const emotionLabels: Record<CharacterEmotion, string> = {
  warm: '마음이 열리는 순간',
  guarded: '서로를 재는 거리',
  focused: '말보다 먼저 읽는 시선',
  uneasy: '흔들리는 침묵',
  resolved: '물러서지 않는 결의',
};

export function getCharacterPresentation(
  id: string,
  fallback: Pick<CharacterPresentation, 'name' | 'title' | 'portrait'>,
): CharacterPresentation {
  return characterPresentations[id] ?? {
    id,
    name: fallback.name,
    title: fallback.title,
    portrait: fallback.portrait,
    cardFolder: id,
    accent: '#c3a36d',
    focus: '50% 28%',
  };
}

export function getCharacterCardAsset(character: CharacterPresentation, stage: string) {
  return `${characters}/${character.cardFolder}/${stage}.webp`;
}

export function getEmotionLabel(emotion: CharacterEmotion) {
  return emotionLabels[emotion];
}

export function getOriginSceneDirection(
  sequence: number,
  speakerId: string,
  selectedPath?: RaonStoryChoiceId,
): CharacterSceneDirection {
  const raonEmotion: CharacterEmotion = selectedPath === 'compassion'
    ? 'warm'
    : selectedPath === 'resolve'
      ? 'resolved'
      : selectedPath === 'insight'
        ? 'focused'
        : 'guarded';

  if (sequence <= 3) {
    return {
      camera: speakerId === 'kain' ? 'confrontation' : 'intimate',
      speakerEmotion: speakerId === 'kain' ? 'guarded' : 'warm',
      raonEmotion,
      beatLabel: '변방의 관계',
      cardStage: '01-origin',
    };
  }

  if (sequence <= 5) {
    return {
      camera: 'balanced',
      speakerEmotion: 'focused',
      raonEmotion,
      beatLabel: '떠나기 전의 약속',
      cardStage: '02-call',
    };
  }

  if (sequence <= 8) {
    return {
      camera: speakerId === 'jinhwon' ? 'confrontation' : 'balanced',
      speakerEmotion: speakerId === 'jinhwon' ? 'resolved' : 'guarded',
      raonEmotion,
      beatLabel: '선발관의 시선',
      cardStage: '03-candidate',
    };
  }

  if (sequence <= 11) {
    return {
      camera: speakerId === 'maru' ? 'intimate' : 'balanced',
      speakerEmotion: speakerId === 'maru' ? 'focused' : 'uneasy',
      raonEmotion,
      beatLabel: '미완의 검을 배우는 시간',
      cardStage: sequence === 9 ? '04-induction' : '05-drill',
    };
  }

  if (sequence <= 14) {
    return {
      camera: 'confrontation',
      speakerEmotion: speakerId === 'hadori' ? 'resolved' : 'focused',
      raonEmotion,
      beatLabel: '조장 선발전',
      cardStage: '13-resolve',
    };
  }

  return {
    camera: 'balanced',
    speakerEmotion: 'resolved',
    raonEmotion,
    beatLabel: '프시케 입단',
    cardStage: '04-induction',
  };
}

export function getFieldSceneDirection(selectedPath?: RaonStoryChoiceId): CharacterSceneDirection {
  return {
    camera: 'balanced',
    speakerEmotion: selectedPath ? 'resolved' : 'focused',
    raonEmotion: selectedPath === 'compassion'
      ? 'warm'
      : selectedPath === 'resolve'
        ? 'resolved'
        : 'focused',
    beatLabel: '현장 대화',
    cardStage: '07-field',
  };
}
