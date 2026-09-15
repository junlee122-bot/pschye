import type { PetalTrainingAction, PetalTrainingChoiceId, PetalTrainingState } from '../types';

export const petalTrainingRules = { goal: 16, maxBurden: 8, turnLimit: 10 } as const;

export function isPetalTrainingChoiceId(value: unknown): value is PetalTrainingChoiceId {
  return value === 'remember-voices' || value === 'distribute-weight' || value === 'step-beyond-fall';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function isPetalTrainingState(value: unknown): value is PetalTrainingState {
  if (!isObject(value) || !isPetalTrainingChoiceId(value.choiceId)
    || !isInteger(value.attempt, 0, Number.MAX_SAFE_INTEGER)
    || !isInteger(value.turn, 0, petalTrainingRules.turnLimit)
    || !isInteger(value.petals, 0, petalTrainingRules.goal)
    || !isInteger(value.burden, 0, petalTrainingRules.maxBurden)
    || !Array.isArray(value.log) || value.log.length > 16 || !value.log.every((line) => typeof line === 'string')) return false;
  const initial = value.turn === 0 && value.petals === 0 && value.burden === 0;
  if (value.phase === 'ready') return value.attempt === 0 && initial;
  if (value.attempt < 1 || (value.turn === 0 && !initial)) return false;
  const maximumPetalsPerTurn = value.choiceId === 'step-beyond-fall' ? 5 : 3;
  if (value.petals > value.turn * maximumPetalsPerTurn) return false;
  if (value.phase === 'active') return value.turn < petalTrainingRules.turnLimit
    && value.petals < petalTrainingRules.goal && value.burden < petalTrainingRules.maxBurden;
  if (value.phase === 'failed') return value.turn > 0 && (value.burden === petalTrainingRules.maxBurden
    || (value.turn === petalTrainingRules.turnLimit && value.petals < petalTrainingRules.goal));
  if (value.phase === 'review' || value.phase === 'complete') return value.turn > 0
    && value.petals === petalTrainingRules.goal && value.burden < petalTrainingRules.maxBurden;
  return false;
}

export function createPetalTraining(choiceId: PetalTrainingChoiceId, attempt = 0): PetalTrainingState {
  return {
    phase: attempt === 0 ? 'ready' : 'active', choiceId, attempt, turn: 0, petals: 0, burden: 0,
    log: [attempt === 0 ? '마루가 기억하는 궤적을 자신의 몸으로 이어 갈 방법을 정했다.' : '검로와 몸의 부담을 살피며 수련을 시작했다.'],
  };
}

export function canApplyPetalTrainingAction(state: PetalTrainingState, action: PetalTrainingAction): boolean {
  if (!isPetalTrainingState(state) || state.phase !== 'active') return false;
  if (action === 'breathe') return state.burden > 0;
  return action === 'trace' || action === 'balance';
}

export function resolvePetalTrainingAction(state: PetalTrainingState, action: PetalTrainingAction): PetalTrainingState {
  if (!canApplyPetalTrainingAction(state, action)) return state;
  const petalGain = action === 'trace' ? state.choiceId === 'step-beyond-fall' ? 5 : 3
    : action === 'balance' ? state.choiceId === 'distribute-weight' ? 3 : 2 : 0;
  const burdenChange = action === 'trace' ? state.choiceId === 'step-beyond-fall' ? 3 : 2
    : action === 'balance' ? 1 : state.choiceId === 'remember-voices' ? -4 : -3;
  const petals = Math.min(petalTrainingRules.goal, state.petals + petalGain);
  const burden = Math.max(0, Math.min(petalTrainingRules.maxBurden, state.burden + burdenChange));
  const turn = state.turn + 1;
  const phase = burden >= petalTrainingRules.maxBurden ? 'failed' : petals === petalTrainingRules.goal ? 'review'
    : turn >= petalTrainingRules.turnLimit ? 'failed' : 'active';
  const labels: Record<PetalTrainingAction, string> = { trace: '보법 이어가기', balance: '무게 나누기', breathe: '호흡 고르기' };
  const log = [`${turn}번째 동작 · ${labels[action]} · 궤적 ${petals} / ${petalTrainingRules.goal}, 부담 ${burden} / ${petalTrainingRules.maxBurden}`];
  if (phase === 'review') log.unshift('열여섯 움직임을 이었다. 마루 앞에서 이번 수련을 마무리할 준비가 됐다.');
  if (phase === 'failed') log.unshift(burden === petalTrainingRules.maxBurden
    ? '몸의 부담이 한계에 닿았다. 수련을 멈추고 다시 준비해야 한다.' : '이번 수련의 동작이 끝났다. 호흡과 검로를 다시 살펴보자.');
  return { ...state, phase, turn, petals, burden, log: [...log, ...state.log].slice(0, 16) };
}
