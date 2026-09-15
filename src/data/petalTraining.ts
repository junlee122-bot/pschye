import type { PetalTrainingChoiceId } from '../types';

export const petalTrainingApproaches: Record<PetalTrainingChoiceId, {
  label: string;
  instruction: string;
  method: string;
  pending: string;
  completion: string;
}> = {
  'remember-voices': {
    label: '지켜야 할 사람들의 호흡에 검로를 맞춘다',
    instruction: '보법과 무게 나누기로 궤적을 잇고, 부담이 쌓이면 호흡을 고릅니다.',
    method: '기억한 사람들의 호흡과 간격을 떠올립니다. 호흡 고르기로 부담을 4 줄일 수 있습니다.',
    pending: '혼자 움직이는 박자 대신, 지켜야 할 사람들이 움직일 간격에 검로를 맞춰 보기로 했다.',
    completion: '동료가 움직일 간격을 떠올리며 열여섯 궤적을 한 번 끝까지 이었다. 마루 앞에서 그 흐름을 마무리했다.',
  },
  'distribute-weight': {
    label: '다리의 부담을 허리와 어깨로 분산한다',
    instruction: '무게 나누기로 궤적을 잇되, 부담이 한계에 닿기 전에 호흡을 고릅니다.',
    method: '다리에 몰리던 부담을 나누는 방법을 살핍니다. 무게 나누기는 궤적 3개를 잇고 부담이 1 늘어납니다.',
    pending: '같은 모양을 흉내 내기보다, 다음 발이 이어지는 이유와 무게를 나눌 방법을 찾아보기로 했다.',
    completion: '다리에 몰리던 무게를 나누며 열여섯 궤적을 한 번 이었다. 마루 앞에서 부담을 나눌 첫 단서를 돌아봤다.',
  },
  'step-beyond-fall': {
    label: '넘어진 자리에서 다음 발을 억지로 잇는다',
    instruction: '보법을 더 멀리 잇는 만큼 부담도 빠르게 쌓입니다. 한계에 닿기 전에 호흡을 고르세요.',
    method: '한 번 더 이어갈 발을 찾습니다. 보법 이어가기는 궤적 5개를 잇고 부담이 3 늘어납니다.',
    pending: '선발전에서 쓸 한 번을 위해, 넘어진 자리에서 다음 발을 다시 이어 보기로 했다.',
    completion: '무리의 위험을 안고 열여섯 궤적을 한 번 이었다. 마루 앞에서 발을 멈추고 그 흐름을 돌아봤다.',
  },
};
