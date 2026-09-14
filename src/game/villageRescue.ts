import type { VillageRescueAction, VillageRescueChoiceId, VillageRescueState } from '../types';

export const villageRescueRules = { columns: 5, rows: 3, maxHp: 5, turnLimit: 24, goal: 3 } as const;
export const villageRescueReturnPoint = { x: 478, y: 348, radius: 94 } as const;

export function isVillageRescueChoiceId(value: unknown): value is VillageRescueChoiceId {
  return value === 'save-child' || value === 'mark-safe-route' || value === 'draw-the-beast';
}

export function isVillageRescueState(value: unknown): value is VillageRescueState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const integer = (key: string, min: number, max: number) => typeof state[key] === 'number'
    && Number.isSafeInteger(state[key]) && state[key] >= min && state[key] <= max;
  if (!isVillageRescueChoiceId(state.choiceId)
    || !integer('attempt', 0, Number.MAX_SAFE_INTEGER) || !integer('turn', 0, villageRescueRules.turnLimit)
    || !integer('hp', 0, villageRescueRules.maxHp) || !integer('x', 0, villageRescueRules.columns - 1)
    || !integer('y', 0, villageRescueRules.rows - 1) || !integer('threatRow', 0, villageRescueRules.rows - 1)
    || !integer('progress', 0, villageRescueRules.goal)
    || !Array.isArray(state.markedColumns) || !state.markedColumns.every((column) => Number.isInteger(column) && column >= 1 && column <= 3)
    || new Set(state.markedColumns).size !== state.markedColumns.length
    || !Array.isArray(state.log) || state.log.length > 16 || !state.log.every((line) => typeof line === 'string')) return false;
  const saved = value as VillageRescueState;
  if (saved.threatRow !== saved.turn % villageRescueRules.rows
    || (saved.choiceId === 'mark-safe-route' ? saved.progress !== saved.markedColumns.length : saved.markedColumns.length !== 0)) return false;
  if (saved.phase === 'ready') return saved.attempt === 0 && saved.turn === 0 && saved.hp === 5
    && saved.x === 0 && saved.y === 1 && saved.progress === 0;
  if (saved.attempt < 1) return false;
  if (saved.phase === 'active') return saved.hp > 0 && saved.turn < villageRescueRules.turnLimit
    && !(saved.progress === 3 && saved.x === 0);
  if (saved.phase === 'failed') return saved.turn > 0 && (saved.hp === 0 || saved.turn === villageRescueRules.turnLimit);
  return (saved.phase === 'return' || saved.phase === 'complete') && saved.turn > 0 && saved.hp > 0
    && saved.progress === 3 && saved.x === 0;
}

export function createVillageRescue(choiceId: VillageRescueChoiceId, attempt = 0): VillageRescueState {
  return {
    phase: attempt === 0 ? 'ready' : 'active', choiceId, attempt, turn: 0,
    hp: villageRescueRules.maxHp, x: 0, y: 1, threatRow: 0, progress: 0, markedColumns: [],
    log: [attempt === 0 ? '구출 방법을 정했다. 준비되면 수로로 들어가자.' : '아이를 구한 뒤 왼쪽 둑으로 돌아오자. 실험체를 공격할 필요는 없다.'],
  };
}

export function canApplyVillageRescueAction(state: VillageRescueState, action: VillageRescueAction): boolean {
  if (state.phase !== 'active') return false;
  if (action.type === 'guard') return true;
  if (action.type === 'move') {
    return Number.isInteger(action.dx) && Number.isInteger(action.dy)
      && Math.abs(action.dx) + Math.abs(action.dy) === 1
      && state.x + action.dx >= 0 && state.x + action.dx < villageRescueRules.columns
      && state.y + action.dy >= 0 && state.y + action.dy < villageRescueRules.rows;
  }
  if (action.type !== 'assist' || state.progress >= villageRescueRules.goal) return false;
  if (state.choiceId === 'save-child') return state.x >= 3;
  if (state.choiceId === 'draw-the-beast') return state.x >= 2;
  return state.x >= 1 && state.x <= 3 && !state.markedColumns.includes(state.x);
}

export function resolveVillageRescueAction(state: VillageRescueState, action: VillageRescueAction): VillageRescueState {
  if (!canApplyVillageRescueAction(state, action)) return state;
  const next = { ...state, turn: state.turn + 1, markedColumns: [...state.markedColumns] };
  let actionLine: string;
  if (action.type === 'move') {
    next.x += action.dx;
    next.y += action.dy;
    actionLine = `라온이 ${next.x + 1}열 ${next.y + 1}행으로 이동했다.`;
  } else if (action.type === 'assist') {
    next.progress += 1;
    if (state.choiceId === 'mark-safe-route') {
      next.markedColumns.push(state.x);
      actionLine = `${state.x + 1}열에 안전한 발판을 표시했다. (${next.progress}/3)`;
    } else if (state.choiceId === 'save-child') {
      actionLine = `아이가 목소리를 따라 다음 발판으로 움직였다. (${next.progress}/3)`;
    } else {
      actionLine = `실험체의 시선을 끌어 카즈린이 아이에게 다가갈 틈을 만들었다. (${next.progress}/3)`;
    }
  } else {
    actionLine = '몸을 낮추고 실험체의 움직임을 막아 냈다.';
  }
  const hit = next.y === state.threatRow && action.type !== 'guard';
  if (hit) next.hp -= 1;
  const escaped = next.progress === villageRescueRules.goal && next.x === 0;
  if (next.hp <= 0) next.phase = 'failed';
  else if (escaped) next.phase = 'return';
  else if (next.turn >= villageRescueRules.turnLimit) next.phase = 'failed';
  next.threatRow = (state.threatRow + 1) % villageRescueRules.rows;
  const result = next.phase === 'return'
    ? '아이와 라온이 둑으로 빠져나왔다. 마을의 카즈린에게 돌아가 확인하자.'
    : next.phase === 'failed'
      ? (next.hp <= 0 ? '더 버틸 수 없어 물러났다. 준비를 가다듬고 다시 시도하자.' : '구출할 틈을 놓쳐 물러났다. 다시 시도하자.')
      : undefined;
  next.log = [result, hit ? '실험체의 돌진에 휩쓸렸다. 체력 -1.' : undefined, actionLine, ...state.log]
    .filter((line): line is string => Boolean(line)).slice(0, 16);
  return next;
}
