import type { FieldExamChoiceId } from '../types';

export const fieldExamApproaches: Record<FieldExamChoiceId, {
  label: string;
  instruction: string;
  cooperation: string;
  completion: string;
  pending: string;
}> = {
  'rescue-team': {
    label: '전원을 돌려 구조한다',
    instruction: '라온과 레오에게 통로를 나눠 맡기고, 버팀이 부족하면 통로를 받칩니다.',
    cooperation: '카즈린도 구조를 돕습니다. 통로 받치기 한 명령마다 버팀을 3 회복합니다.',
    completion: '두 지원자와 함께 갱도를 빠져나왔다. 시험 점수는 낮아졌지만 함께 구조한 이들이 라온 곁에 모였다.',
    pending: '시험 목표보다 사람을 먼저 생각하며 전원이 구조에 집중하기로 했다.',
  },
  'split-route': {
    label: '레오와 구조하고 카즈린은 깃발을 지킨다',
    instruction: '라온과 레오를 서로 다른 미완료 통로에 배치하면 이번 턴의 하중이 줄어듭니다.',
    cooperation: '카즈린은 시험 목표를 지킵니다. 두 사람이 서로 다른 미완료 통로를 구조하면 하중이 1 줄어듭니다.',
    completion: '레오와 두 지원자를 구조해 돌아왔다. 카즈린은 시험 목표를 지켰고 서로 다른 역할이 하나의 명령으로 이어졌다.',
    pending: '라온과 레오는 구조를, 카즈린은 시험 목표 유지를 맡기로 했다.',
  },
  'defy-order': {
    label: '시험 중단을 외치고 지지대를 몸으로 받친다',
    instruction: '첫 턴에는 라온이 통로를 받쳐야 합니다. 하도리가 하중을 넘겨받으면 라온도 구조에 합류합니다.',
    cooperation: '라온이 잠깐 버틴 뒤 하도리가 지지대의 무게를 대신 받습니다. 다음 턴부터 라온의 명령을 자유롭게 정할 수 있습니다.',
    completion: '하도리가 지지대의 무게를 대신 받았다. 두 지원자가 빠져나온 뒤 라온도 돌아왔다.',
    pending: '시험 중단을 요청하고 라온이 먼저 통로 받치기를 맡기로 했다.',
  },
};
