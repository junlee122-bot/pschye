import type { CaptainTrialChoiceId, CaptainTrialSceneId } from '../types';

export const captainTrialDefinitions: Record<CaptainTrialSceneId, {
  opponent: string;
  portrait: string;
  title: string;
  subtitle: string;
  background: string;
  prelude: string;
  method: string;
  completion: string;
  nextLabel: string;
}> = {
  'captain-trials': {
    opponent: '카인',
    portrait: '/art/archive/kain-sheet.webp',
    title: '재능이 예상하지 못한 검',
    subtitle: '라온을 고른 카인이 창끝을 겨눕니다.',
    background: '/art/story/scenes/captain-trials/battle.webp',
    prelude: '마을에서 지켜본 어깨의 움직임을 떠올립니다. 마루에게 배워 다시 만든 검로를 실전에서 이어 볼 차례입니다.',
    method: '찌르기는 창 흘리기, 횡공격은 비켜딛기로 받습니다. 방어해 만든 틈은 상대가 창을 회수할 때 검로 잇기로 이어 가세요.',
    completion: '카인의 습관을 읽고 열여섯 꽃잎의 흐름을 이어 승부를 마쳤습니다.',
    nextLabel: '카즈린과의 대결로',
  },
  'kazrin-duel': {
    opponent: '카즈린',
    portrait: '/art/archive/kazrin-sheet.webp',
    title: '따라온 사람을 넘어서는 순간',
    subtitle: '카즈린은 오래된 친구에게도 창을 늦추지 않습니다.',
    background: '/art/story/scenes/kazrin-duel/battle.webp',
    prelude: '마을에서 오래 보아 온 보법이 더 정교해졌습니다. 익숙한 상대를 믿는 마음과 다음 흐름을 읽는 집중이 함께 필요합니다.',
    method: '횡공격에는 비켜딛기, 이어지는 찌르기에는 창 흘리기를 맞춰야 틈이 열립니다. 두 공방을 잇고 창을 회수할 때 반격하세요.',
    completion: '오래 지켜본 창의 흐름을 읽어 근소하게 승부를 마쳤습니다. 라온이 제2조장의 자리에 섭니다.',
    nextLabel: '하도리에게 도전하기',
  },
  'hadori-wall': {
    opponent: '하도리',
    portrait: '/art/archive/hadori-sheet.webp',
    title: '제1조장에게 내딛는 한 걸음',
    subtitle: '두 대결을 마친 라온 앞에 하도리가 섭니다.',
    background: '/art/story/scenes/one-hit/battle.webp',
    prelude: '하도리는 라온에게 준비되면 오라고 말합니다. 라온은 지금의 검이 어디까지 닿는지 확인하려 합니다.',
    method: '호흡을 가다듬고 첫발을 내딛습니다. 이 도전에서는 한 번의 입력으로 첫 공방을 이어 갑니다.',
    completion: '하도리의 한 방으로 도전전은 끝났습니다. 의무동에서 눈을 뜬 라온 앞에 하도리가 앉아 있습니다.',
    nextLabel: '하도리와 이야기하기',
  },
};

export const captainTrialApproaches: Record<CaptainTrialChoiceId, {
  label: string;
  method: string;
  pending: string;
  completion: string;
}> = {
  'break-spear-not-kain': {
    label: '카인이 아니라 창의 흐름을 끊는다',
    method: '거리 두고 호흡을 선택하면 호흡을 3 회복합니다. 상대가 회수 중이면 균형도 2 회복합니다.',
    pending: '상대를 다치게 하기보다 창의 흐름을 끊어 승부를 끝내기로 했다.',
    completion: '카인의 손목을 베지 않고 창대를 흘려 승부를 마쳤다.',
  },
  'use-sixteenth-gap': {
    label: '열여섯 번째 틈에서만 검을 멈춘다',
    method: '창 흘리기와 비켜딛기는 호흡을 소모하지 않습니다. 반격에 쓸 호흡을 남기며 다음 동작을 읽습니다.',
    pending: '익숙한 습관에서 다음 동작을 읽고, 이어 갈 틈을 기다리기로 했다.',
    completion: '카인의 습관을 읽고 마지막 틈에서 검을 멈추며 승부를 마쳤다.',
  },
  'declare-my-name': {
    label: '빌린 검임을 인정하고 정면으로 돌파한다',
    method: '성공한 반격은 승부 진행을 2 올립니다. 잘못 대응하면 균형이 3 줄어드니 공방의 순서를 확인하세요.',
    pending: '빌린 검의 흔적을 인정하고, 지금의 선택은 자신의 이름으로 감당하기로 했다.',
    completion: '마루에게서 배워 다시 만든 검로를 자신의 의지로 이어 승부를 마쳤다.',
  },
  'trust-her-recovery': {
    label: '카즈린이 막아낼 것을 믿고 끝까지 들어간다',
    method: '거리 두고 호흡을 선택하면 호흡을 3 회복합니다. 상대가 회수 중이면 균형도 2 회복합니다.',
    pending: '카즈린을 보호할 상대가 아닌 대등한 무인으로 믿고, 끝까지 공방을 잇기로 했다.',
    completion: '대등한 무인으로 창과 검을 맞댄 끝에, 오래 보아 온 흐름을 읽어 근소하게 승부를 마쳤다.',
  },
  'change-old-rhythm': {
    label: '카즈린이 기억하는 라온의 박자를 버린다',
    method: '창 흘리기와 비켜딛기는 호흡을 소모하지 않습니다. 두 방어를 이어 반격할 틈을 준비합니다.',
    pending: '카즈린이 기억하는 박자에서 벗어나, 지금의 발로 다음 흐름을 만들기로 했다.',
    completion: '서로 익숙했던 박자를 바꾸어 창의 궤도를 벗어나고 근소하게 승부를 마쳤다.',
  },
  'step-beside-not-behind': {
    label: '창끝 안쪽으로 들어가 나란히 선다',
    method: '성공한 반격은 승부 진행을 2 올립니다. 잘못 대응하면 균형이 3 줄어드니 두 방어를 먼저 잇습니다.',
    pending: '뒤에서 따라가던 자리를 벗어나, 카즈린과 나란히 설 검로를 잇기로 했다.',
    completion: '창끝 안쪽에서 마지막 검을 멈추며 근소하게 승부를 마쳤다. 라온은 카즈린과 나란히 설 첫걸음을 뗐다.',
  },
};

export const captainTrialIntents: Record<'thrust' | 'sweep' | 'recover' | 'overwhelm', {
  label: string;
  hint: string;
}> = {
  thrust: { label: '찌르기', hint: '곧게 오는 창을 창 흘리기로 비껴 냅니다.' },
  sweep: { label: '횡공격', hint: '옆으로 쓸어 오는 창을 비켜딛기로 벗어납니다.' },
  recover: { label: '창 회수', hint: '틈을 만들었다면 검로 잇기로 반격합니다. 거리를 두고 호흡과 균형을 되찾을 수도 있습니다.' },
  overwhelm: { label: '첫 공방', hint: '준비한 검을 들고 하도리에게 첫발을 내딛습니다.' },
};
