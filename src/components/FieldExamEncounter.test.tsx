// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fieldExamApproaches } from '../data/fieldExam';
import { getOriginStoryScene } from '../data/originStory';
import { createFieldExam, resolveFieldExamPlan } from '../game/fieldExam';
import { completeFieldExamReturn } from '../game/fieldExamProgression';
import { advanceOriginStory, chooseOriginStoryPath, createNewCampaignProfile } from '../game/progression';
import type { CampaignProfile, FieldExamChoiceId, FieldExamState } from '../types';
import { Chronicle } from './Chronicle';
import { FieldExamEncounter } from './FieldExamEncounter';
import { TitleScreen } from './TitleScreen';

const noop = () => {};
const choices: FieldExamChoiceId[] = ['rescue-team', 'split-route', 'defy-order'];

function render(state: FieldExamState) {
  return renderToStaticMarkup(<FieldExamEncounter state={state} onStart={noop} onPlan={noop} onRetry={noop} onReturn={noop} onAdvance={noop} onExit={noop} />);
}
function profileAt(state: FieldExamState): CampaignProfile {
  const profile = createNewCampaignProfile();
  profile.originStory.currentSceneId = 'field-exam';
  const chosen = chooseOriginStoryPath(profile, 'field-exam', state.choiceId);
  return { ...chosen, originStory: { ...chosen.originStory, fieldExam: state } };
}
function title(profile: CampaignProfile) {
  return renderToStaticMarkup(<TitleScreen profile={profile} activeSlot={1} slots={[]} onNavigate={noop} onReset={noop} onSelectSlot={noop} />);
}
function buttons(markup: string) {
  return Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), (match) => match[0]);
}
function radio(markup: string, actor: 'raon' | 'leo', order: string) {
  return Array.from(markup.matchAll(/<input\b[^>]*>/g), (match) => match[0])
    .find((input) => input.includes(`name="field-exam-${actor}"`) && input.includes(`value="${order}"`));
}
function returnState() {
  let state = createFieldExam('split-route', 1);
  for (let index = 0; index < 3; index += 1) state = resolveFieldExamPlan(state, { raon: 'left', leo: 'right' });
  expect(state.phase).toBe('return');
  return state;
}

describe('field exam player-facing stage boundaries', () => {
  it.each(choices)('shows only the chosen plan before %s starts, with no completed outcome or advance control', (choice) => {
    const markup = render(createFieldExam(choice));
    expect(markup).toContain(fieldExamApproaches[choice].pending);
    expect(buttons(markup).some((button) => button.includes('구조 지휘 시작'))).toBe(true);
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('선발 12일차 · 다음 장면');
    expect(markup).not.toContain('모두와 함께 철수');
    for (const candidate of choices) {
      expect(markup).not.toContain(fieldExamApproaches[candidate].completion);
      if (candidate !== choice) expect(markup).not.toContain(fieldExamApproaches[candidate].pending);
    }
  });

  it('requires Raon to brace before Hadori takes over, while Leo can act immediately', () => {
    const state = createFieldExam('defy-order', 1);
    const initial = render(state);
    expect(radio(initial, 'raon', 'left')).toContain('disabled=""');
    expect(radio(initial, 'raon', 'right')).toContain('disabled=""');
    expect(radio(initial, 'raon', 'brace')).toBeDefined();
    expect(radio(initial, 'raon', 'brace')).not.toContain('disabled=""');
    expect(radio(initial, 'leo', 'left')).not.toContain('disabled=""');
    expect(initial).not.toContain('하도리가 지지대의 하중을 넘겨받았습니다.');
    expect(buttons(initial).find((button) => button.includes('두 명령 함께 실행'))).toContain('disabled=""');

    const afterHandover = render(resolveFieldExamPlan(state, { raon: 'brace', leo: 'left' }));
    expect(afterHandover).toContain('하도리가 지지대의 하중을 넘겨받았습니다.');
    expect(radio(afterHandover, 'raon', 'left')).not.toContain('disabled=""');
    expect(radio(afterHandover, 'raon', 'right')).not.toContain('disabled=""');
    expect(afterHandover).not.toContain(fieldExamApproaches['defy-order'].completion);
  });

  it('keeps exit arrival separate from confirmed withdrawal and the next story day', () => {
    const waiting = returnState();
    const waitingMarkup = render(waiting);
    expect(waitingMarkup).toContain('아직 시험 결과를 기록하지 않았습니다.');
    expect(waitingMarkup).toContain('모두와 함께 철수');
    expect(waitingMarkup).not.toContain(fieldExamApproaches['split-route'].completion);
    expect(waitingMarkup).not.toContain('선발 12일차 · 다음 장면');
    expect(waitingMarkup).not.toContain('<form');

    const completed = completeFieldExamReturn(profileAt(waiting), waiting.attempt).originStory.fieldExam!;
    const completedMarkup = render(completed);
    expect(completedMarkup).toContain(fieldExamApproaches['split-route'].completion);
    expect(completedMarkup).toContain('선발 12일차 · 다음 장면');
    expect(buttons(completedMarkup).some((button) => button.includes('모두와 함께 철수'))).toBe(false);
    expect(completedMarkup).not.toContain('<form');
  });

  it('offers a retry after a collapse without announcing death, withdrawal or a changed admission result', () => {
    let state = createFieldExam('rescue-team', 1);
    for (let index = 0; index < 3; index += 1) state = resolveFieldExamPlan(state, { raon: 'left', leo: 'right' });
    expect(state.phase).toBe('failed');
    const markup = render(state);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('같은 선택으로 재도전');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('선발 12일차 · 다음 장면');
    expect(buttons(markup).some((button) => button.includes('모두와 함께 철수'))).toBe(false);
    for (const candidate of choices) expect(markup).not.toContain(fieldExamApproaches[candidate].completion);
    expect(markup).not.toMatch(/사망|퇴학|입단 실패/);
  });

  it('disables completed routes for both actors while retaining named command groups and progress labels', () => {
    let state = createFieldExam('rescue-team', 1);
    state = resolveFieldExamPlan(state, { raon: 'left', leo: 'left' });
    state = resolveFieldExamPlan(state, { raon: 'left', leo: 'brace' });
    expect(state.phase).toBe('active');
    const markup = render(state);
    expect(radio(markup, 'raon', 'left')).toContain('disabled=""');
    expect(radio(markup, 'leo', 'left')).toContain('disabled=""');
    expect(radio(markup, 'raon', 'right')).not.toContain('disabled=""');
    expect(radio(markup, 'leo', 'brace')).not.toContain('disabled=""');
    expect(markup.match(/<fieldset\b/g)).toHaveLength(2);
    expect(markup).toContain('<span>라온</span>');
    expect(markup).toContain('<span>레오</span>');
    expect(markup).toContain('aria-label="왼쪽 통로 구조 진행 3 / 3"');
    expect(markup).toContain('role="meter" aria-label="통로 버팀"');
  });
});

describe('field exam resume and earned memories', () => {
  it.each([
    ['ready', '폐광 구조 준비 · 선택한 방침으로 시작'],
    ['active', '폐광 구조 중 · 0턴 · 통로 버팀 6'],
    ['failed', '폐광 구조 재도전 대기'],
    ['return', '지원자 둘 출구 도착 · 함께 철수할 차례'],
    ['complete', '폐광 전원 철수 완료 · 선발 12일차로'],
  ] as const)('identifies the saved %s stage on the title continue action', (phase, description) => {
    let state = phase === 'ready' ? createFieldExam('split-route') : createFieldExam('split-route', 1);
    if (phase === 'return' || phase === 'complete') state = returnState();
    if (phase === 'failed') {
      state = createFieldExam('rescue-team', 1);
      for (let index = 0; index < 3; index += 1) state = resolveFieldExamPlan(state, { raon: 'left', leo: 'right' });
    }
    let profile = profileAt(state);
    if (phase === 'complete') profile = completeFieldExamReturn(profile, state.attempt);
    const markup = title(profile);
    expect(markup).toContain(description);
    expect(buttons(markup).filter((button) => button.includes('라온의 이야기 계속'))).toHaveLength(1);
    if (phase !== 'complete') expect(markup).not.toContain('폐광 전원 철수 완료');
  });

  it('does not leak a pending outcome into the chronicle or another profile, and does not reopen a completed legacy scene', () => {
    const pending = profileAt(createFieldExam('defy-order', 1));
    const memories = renderToStaticMarkup(<Chronicle profile={pending} />);
    for (const choice of getOriginStoryScene('field-exam').choices) expect(memories).not.toContain(choice.result);
    expect(memories).not.toContain('이기는 조와 돌아오는 조');
    expect(title(pending)).toContain('폐광 구조 중');
    const fresh = title(createNewCampaignProfile());
    expect(fresh).toContain('변방 마을에서 시작');
    expect(fresh).not.toContain('폐광');

    const completed = completeFieldExamReturn(profileAt(returnState()), 1);
    const advanced = advanceOriginStory(completed);
    expect(advanced.originStory.currentSceneId).toBe('suspended-candidate');
    delete advanced.originStory.fieldExam;
    const legacyTitle = title(advanced);
    expect(legacyTitle).toContain('발전 보류');
    expect(legacyTitle).not.toContain('폐광 구조 준비');
    expect(legacyTitle).not.toContain('폐광 구조 중');
    expect(renderToStaticMarkup(<Chronicle profile={advanced} />)).toContain(getOriginStoryScene('field-exam').choices[1].result);
  });
});

describe('field exam command focus', () => {
  const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let previousActEnvironment: boolean | undefined;
  let container: HTMLDivElement;
  let root: Root;
  let currentState: FieldExamState;

  beforeAll(() => {
    previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function mount(choice: FieldExamChoiceId) {
    function Session() {
      const [state, setState] = useState(() => createFieldExam(choice, 1));
      currentState = state;
      return <FieldExamEncounter state={state} onStart={noop}
        onPlan={(plan) => setState((current) => resolveFieldExamPlan(current, plan))}
        onReturn={() => setState((current) => completeFieldExamReturn(profileAt(current), current.attempt).originStory.fieldExam!)}
        onRetry={noop} onAdvance={noop} onExit={noop} />;
    }
    act(() => root.render(<Session />));
  }
  function command(actor: 'raon' | 'leo', order: 'left' | 'right' | 'brace') {
    return container.querySelector<HTMLInputElement>(`input[name="field-exam-${actor}"][value="${order}"]`)!;
  }
  function submit(raon: 'left' | 'right' | 'brace', leo: 'left' | 'right' | 'brace') {
    act(() => { command('raon', raon).click(); command('leo', leo).click(); });
    const form = container.querySelector('form')!;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(false);
    button.focus();
    // jsdom does not synthesize native Enter submission or Tab navigation.
    // Exercise the same focused form submit; the native sequence is checked in Edge.
    act(() => form.requestSubmit(button));
  }

  it('returns focus to the first command after each active turn without selecting or submitting it', () => {
    mount('split-route');
    expect(document.activeElement).toBe(container.querySelector('h1'));
    for (let turn = 1; turn <= 2; turn += 1) {
      submit('left', 'right');
      expect(currentState.turn).toBe(turn);
      expect(currentState.phase).toBe('active');
      expect(document.activeElement).toBe(command('raon', 'left'));
      expect(container.querySelectorAll('input:checked')).toHaveLength(0);
      expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    }
  });

  it('skips the newly completed route when focusing the next command', () => {
    mount('rescue-team');
    submit('left', 'left');
    submit('left', 'brace');
    expect(currentState.phase).toBe('active');
    expect(currentState.left).toBe(3);
    expect(command('raon', 'left').disabled).toBe(true);
    expect(document.activeElement).toBe(command('raon', 'right'));
    expect(command('raon', 'right').checked).toBe(false);
  });

  it.each(['split-route', 'rescue-team'] as const)('keeps %s result focus on the outcome, including confirmed withdrawal', (choice) => {
    mount(choice);
    for (let turn = 0; turn < 3; turn += 1) submit('left', 'right');
    const result = container.querySelector('.field-exam-stage-message')!;
    expect(document.activeElement).toBe(result);
    expect(container.querySelector('form')).toBeNull();
    expect(currentState.phase).toBe(choice === 'split-route' ? 'return' : 'failed');
    if (choice === 'split-route') {
      act(() => result.querySelector<HTMLButtonElement>('button')!.click());
      expect(currentState.phase).toBe('complete');
      expect(document.activeElement).toBe(container.querySelector('.field-exam-stage-message'));
    }
  });
});
