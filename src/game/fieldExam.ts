import type { FieldExamChoiceId, FieldExamOrder, FieldExamPlan, FieldExamState } from '../types';

export const fieldExamRules = {
  initialIntegrity: 6,
  maxIntegrity: 8,
  turnLimit: 8,
  goal: 3,
  braceGain: 2,
  rescueTeamBraceGain: 3,
} as const;

export function isFieldExamChoiceId(value: unknown): value is FieldExamChoiceId {
  return value === 'rescue-team' || value === 'split-route' || value === 'defy-order';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function isFieldExamState(value: unknown): value is FieldExamState {
  if (!isObject(value) || !isFieldExamChoiceId(value.choiceId)
    || !isInteger(value.attempt, 0, Number.MAX_SAFE_INTEGER)
    || !isInteger(value.turn, 0, fieldExamRules.turnLimit)
    || !isInteger(value.integrity, 0, fieldExamRules.maxIntegrity)
    || !isInteger(value.left, 0, fieldExamRules.goal) || !isInteger(value.right, 0, fieldExamRules.goal)
    || !Array.isArray(value.log) || value.log.length > 16 || !value.log.every((line) => typeof line === 'string')) return false;
  const rescued = value.left === fieldExamRules.goal && value.right === fieldExamRules.goal;
  const initial = value.turn === 0 && value.integrity === fieldExamRules.initialIntegrity && value.left === 0 && value.right === 0;
  if (value.phase === 'ready') return value.attempt === 0 && initial;
  if (value.attempt < 1 || (value.turn === 0 && !initial)) return false;
  const maximumProgress = value.turn * 2 - (value.choiceId === 'defy-order' && value.turn > 0 ? 1 : 0);
  if (value.left + value.right > maximumProgress) return false;
  if (value.phase === 'active') return value.integrity > 0 && value.turn < fieldExamRules.turnLimit && !rescued;
  if (value.phase === 'failed') return value.turn > 0 && (value.integrity === 0 || (value.turn === fieldExamRules.turnLimit && !rescued));
  if (value.phase === 'return' || value.phase === 'complete') return value.turn > 0 && value.integrity > 0 && rescued;
  return false;
}

export function createFieldExam(choiceId: FieldExamChoiceId, attempt = 0): FieldExamState {
  return {
    phase: attempt === 0 ? 'ready' : 'active', choiceId, attempt, turn: 0,
    integrity: fieldExamRules.initialIntegrity, left: 0, right: 0,
    log: [attempt === 0 ? '폐광 안의 두 지원자를 함께 데리고 나올 방법을 정했다.' : '라온과 레오가 두 갱도의 상태를 살폈다.'],
  };
}

// Preview is the next turn's base load. A split-route plan can reduce it by one.
export function getFieldExamLoad(state: FieldExamState): number {
  return (state.turn + 1) % 3 === 0 ? 3 : 2;
}

function isOrder(value: unknown): value is FieldExamOrder {
  return value === 'left' || value === 'right' || value === 'brace';
}

export function canApplyFieldExamPlan(state: FieldExamState, plan: FieldExamPlan): boolean {
  if (!isFieldExamState(state) || state.phase !== 'active' || !isObject(plan)
    || !isOrder(plan.raon) || !isOrder(plan.leo)) return false;
  if (state.choiceId === 'defy-order' && state.turn === 0 && plan.raon !== 'brace') return false;
  return [plan.raon, plan.leo].every((order) => order === 'brace' || state[order] < fieldExamRules.goal);
}

export function resolveFieldExamPlan(state: FieldExamState, plan: FieldExamPlan): FieldExamState {
  if (!canApplyFieldExamPlan(state, plan)) return state;
  const orders = [plan.raon, plan.leo];
  const braceGain = state.choiceId === 'rescue-team' ? fieldExamRules.rescueTeamBraceGain : fieldExamRules.braceGain;
  const bracedIntegrity = Math.min(fieldExamRules.maxIntegrity, state.integrity + orders.filter((order) => order === 'brace').length * braceGain);
  const left = Math.min(fieldExamRules.goal, state.left + orders.filter((order) => order === 'left').length);
  const right = Math.min(fieldExamRules.goal, state.right + orders.filter((order) => order === 'right').length);
  const coordinated = state.choiceId === 'split-route' && plan.raon !== 'brace' && plan.leo !== 'brace' && plan.raon !== plan.leo;
  const load = Math.max(1, getFieldExamLoad(state) - (coordinated ? 1 : 0));
  const integrity = Math.max(0, bracedIntegrity - load);
  const turn = state.turn + 1;
  const phase = integrity === 0 ? 'failed' : left === fieldExamRules.goal && right === fieldExamRules.goal ? 'return'
    : turn >= fieldExamRules.turnLimit ? 'failed' : 'active';
  const labels: Record<FieldExamOrder, string> = { left: '왼쪽 구조', right: '오른쪽 구조', brace: '지지대 받치기' };
  const log = [`${turn}턴 · 라온: ${labels[plan.raon]} / 레오: ${labels[plan.leo]} · 하중 ${load}, 통로 버팀 ${integrity}`];
  if (state.choiceId === 'defy-order' && state.turn === 0) log.unshift('하도리가 지지대의 하중을 이어받았다. 라온은 레오와 구조를 계속할 수 있다.');
  if (phase === 'return') log.unshift('두 지원자를 출구까지 이끌었다. 모두와 함께 철수할 준비가 됐다.');
  if (phase === 'failed') log.unshift(integrity === 0 ? '통로를 유지하지 못했다. 계획을 다시 세워야 한다.' : '구조 제한 턴이 끝났다. 계획을 다시 세워야 한다.');
  return { ...state, phase, turn, integrity, left, right, log: [...log, ...state.log].slice(0, 16) };
}
