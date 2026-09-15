import type { CaptainTrialAction, CaptainTrialChoiceId, CaptainTrialSceneId, CaptainTrialState } from '../types';

export const captainTrialRules = { initialPoise: 6, maxPoise: 6, initialBreath: 4, maxBreath: 4, goal: 3, turnLimit: 18 } as const;

const choices: Record<Exclude<CaptainTrialSceneId, 'hadori-wall'>, CaptainTrialChoiceId[]> = {
  'captain-trials': ['break-spear-not-kain', 'use-sixteenth-gap', 'declare-my-name'],
  'kazrin-duel': ['trust-her-recovery', 'change-old-rhythm', 'step-beside-not-behind'],
};

export function isCaptainTrialSceneId(value: unknown): value is CaptainTrialSceneId {
  return value === 'captain-trials' || value === 'kazrin-duel' || value === 'hadori-wall';
}

export function isCaptainTrialChoiceId(value: unknown): value is CaptainTrialChoiceId {
  return typeof value === 'string' && Object.values(choices).some((entries) => entries.includes(value as CaptainTrialChoiceId));
}

export function isCaptainTrialChoiceForScene(sceneId: CaptainTrialSceneId, choiceId: unknown): choiceId is CaptainTrialChoiceId {
  return sceneId !== 'hadori-wall' && isCaptainTrialChoiceId(choiceId) && choices[sceneId].includes(choiceId);
}

function stance(state: CaptainTrialState) {
  if (state.choiceId === 'use-sixteenth-gap' || state.choiceId === 'change-old-rhythm') return 'insight';
  if (state.choiceId === 'declare-my-name' || state.choiceId === 'step-beside-not-behind') return 'resolve';
  return 'compassion';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function isCaptainTrialState(value: unknown): value is CaptainTrialState {
  if (!isObject(value) || !isCaptainTrialSceneId(value.sceneId)
    || !isInteger(value.attempt, 0, Number.MAX_SAFE_INTEGER) || !isInteger(value.turn, 0, captainTrialRules.turnLimit)
    || !isInteger(value.poise, 0, captainTrialRules.maxPoise) || !isInteger(value.breath, 0, captainTrialRules.maxBreath)
    || !isInteger(value.progress, 0, captainTrialRules.goal) || typeof value.opening !== 'boolean'
    || !Array.isArray(value.log) || value.log.length > 16 || !value.log.every((line) => typeof line === 'string')) return false;
  if (value.sceneId === 'hadori-wall' ? value.choiceId !== undefined : !isCaptainTrialChoiceForScene(value.sceneId, value.choiceId)) return false;
  const initial = value.turn === 0 && value.poise === captainTrialRules.initialPoise && value.breath === captainTrialRules.initialBreath
    && value.progress === 0 && value.opening === false;
  if (value.phase === 'ready') return value.attempt === 0 && initial;
  if (value.attempt < 1) return false;
  if (value.sceneId === 'hadori-wall') {
    if (value.attempt !== 1) return false;
    if (value.phase === 'active') return initial;
    return (value.phase === 'resolved' || value.phase === 'complete') && value.turn === 1 && value.poise === 0
      && value.breath === captainTrialRules.initialBreath && value.progress === 0 && value.opening === false;
  }
  if (value.turn === 0 && !initial) return false;
  if (value.progress > value.turn * 2) return false;
  if (value.phase === 'active') return value.turn < captainTrialRules.turnLimit && value.poise > 0 && value.progress < captainTrialRules.goal;
  if (value.phase === 'failed') return value.turn > 0 && (value.poise === 0 || (value.turn === captainTrialRules.turnLimit && value.progress < captainTrialRules.goal));
  return (value.phase === 'resolved' || value.phase === 'complete') && value.turn > 0 && value.poise > 0 && value.progress === captainTrialRules.goal;
}

export function createCaptainTrial(sceneId: CaptainTrialSceneId, choiceId?: CaptainTrialChoiceId, attempt = 0): CaptainTrialState {
  return {
    sceneId, ...(choiceId ? { choiceId } : {}), phase: attempt === 0 ? 'ready' : 'active', attempt, turn: 0,
    poise: captainTrialRules.initialPoise, breath: captainTrialRules.initialBreath, progress: 0, opening: false,
    log: [sceneId === 'hadori-wall' ? '하도리가 원형장에서 라온을 기다린다.' : '상대의 움직임과 호흡을 살피며 대결을 준비했다.'],
  };
}

export function getCaptainTrialIntent(state: CaptainTrialState): 'thrust' | 'sweep' | 'recover' | 'overwhelm' {
  if (state.sceneId === 'hadori-wall') return 'overwhelm';
  if (state.sceneId === 'kazrin-duel') return (['sweep', 'thrust', 'recover'] as const)[state.turn % 3];
  return (['thrust', 'recover', 'sweep', 'recover'] as const)[state.turn % 4];
}

export function canApplyCaptainTrialAction(state: CaptainTrialState, action: CaptainTrialAction): boolean {
  if (!isCaptainTrialState(state) || state.phase !== 'active') return false;
  if (state.sceneId === 'hadori-wall') return action === 'challenge';
  if (action === 'recover') return true;
  if (action === 'parry' || action === 'sidestep') return state.breath >= (stance(state) === 'insight' ? 0 : 1);
  return action === 'counter' && getCaptainTrialIntent(state) === 'recover' && state.opening && state.breath >= 1;
}

export function resolveCaptainTrialAction(state: CaptainTrialState, action: CaptainTrialAction): CaptainTrialState {
  if (!canApplyCaptainTrialAction(state, action)) return state;
  if (state.sceneId === 'hadori-wall') return {
    ...state, phase: 'resolved', turn: 1, poise: 0, progress: 0, opening: false,
    log: ['첫발을 내디딘 순간, 하도리의 한 방에 대결이 끝났다.', ...state.log].slice(0, 16),
  };
  const intent = getCaptainTrialIntent(state);
  const path = stance(state);
  let { poise, breath, progress } = state;
  let opening = false;
  if (action === 'counter') {
    breath -= 1;
    progress = Math.min(captainTrialRules.goal, progress + (path === 'resolve' ? 2 : 1));
  } else if (action === 'recover') {
    breath = Math.min(captainTrialRules.maxBreath, breath + (path === 'compassion' ? 3 : 2));
    if (intent === 'recover') poise = Math.min(captainTrialRules.maxPoise, poise + (path === 'compassion' ? 2 : 1));
    else poise = Math.max(0, poise - (path === 'resolve' ? 3 : 2));
  } else {
    breath -= path === 'insight' ? 0 : 1;
    if (intent !== 'recover') {
      const correct = intent === 'thrust' ? action === 'parry' : action === 'sidestep';
      if (correct) opening = state.sceneId === 'kazrin-duel' && state.turn % 3 === 1 ? state.opening : true;
      else poise = Math.max(0, poise - (path === 'resolve' ? 3 : 2));
    }
  }
  const turn = state.turn + 1;
  const phase = poise === 0 ? 'failed' : progress === captainTrialRules.goal ? 'resolved'
    : turn >= captainTrialRules.turnLimit ? 'failed' : 'active';
  const labels: Record<CaptainTrialAction, string> = { parry: '창 흘리기', sidestep: '비켜딛기', counter: '검로 잇기', recover: '거리 두고 호흡', challenge: '첫발 내딛기' };
  const log = [`${turn}번째 동작 · ${labels[action]} · 균형 ${poise}, 호흡 ${breath}, 승부 진행 ${progress} / ${captainTrialRules.goal}`];
  if (phase === 'resolved') log.unshift('상대의 흐름을 끊고 대결을 마쳤다. 결과를 확인할 차례다.');
  if (phase === 'failed') log.unshift(poise === 0 ? '균형이 무너졌다. 호흡과 방어를 다시 살펴보자.' : '이번 대결의 동작이 끝났다. 다시 준비해야 한다.');
  return { ...state, phase, turn, poise, breath, progress, opening, log: [...log, ...state.log].slice(0, 16) };
}
