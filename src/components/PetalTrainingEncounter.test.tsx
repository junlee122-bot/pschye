// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { petalTrainingApproaches } from '../data/petalTraining';
import { getOriginStoryScene } from '../data/originStory';
import { createPetalTraining, resolvePetalTrainingAction } from '../game/petalTraining';
import { completePetalTraining } from '../game/petalTrainingProgression';
import { advanceOriginStory, chooseOriginStoryPath, createNewCampaignProfile } from '../game/progression';
import type { CampaignProfile, PetalTrainingAction, PetalTrainingChoiceId, PetalTrainingState } from '../types';
import { Chronicle } from './Chronicle';
import { PetalTrainingEncounter } from './PetalTrainingEncounter';
import { TitleScreen } from './TitleScreen';

const noop = () => {};
const choices: PetalTrainingChoiceId[] = ['remember-voices', 'distribute-weight', 'step-beyond-fall'];

function render(state: PetalTrainingState) {
  return renderToStaticMarkup(<PetalTrainingEncounter state={state} onStart={noop} onAction={noop} onRetry={noop} onComplete={noop} onAdvance={noop} onExit={noop} />);
}
function profileAt(state: PetalTrainingState): CampaignProfile {
  const profile = createNewCampaignProfile();
  profile.originStory.currentSceneId = 'sixteen-petals';
  const chosen = chooseOriginStoryPath(profile, 'sixteen-petals', state.choiceId);
  return { ...chosen, originStory: { ...chosen.originStory, petalTraining: state } };
}
function title(profile: CampaignProfile) {
  return renderToStaticMarkup(<TitleScreen profile={profile} activeSlot={1} slots={[]} onNavigate={noop} onReset={noop} onSelectSlot={noop} />);
}
function buttons(markup: string) {
  return Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), (match) => match[0]);
}
function radio(markup: string, action: PetalTrainingAction) {
  return Array.from(markup.matchAll(/<input\b[^>]*>/g), (match) => match[0])
    .find((input) => input.includes('name="petal-training-action"') && input.includes(`value="${action}"`));
}
function practice(choice: PetalTrainingChoiceId, actions: PetalTrainingAction[]) {
  return actions.reduce(resolvePetalTrainingAction, createPetalTraining(choice, 1));
}
function reviewState() {
  const state = practice('distribute-weight', ['balance', 'balance', 'balance', 'balance', 'balance', 'balance']);
  expect(state.phase).toBe('review');
  return state;
}
function failedAtSixteen() {
  const state = practice('step-beyond-fall', ['trace', 'trace', 'balance', 'trace']);
  expect(state).toMatchObject({ phase: 'failed', petals: 16, burden: 8 });
  return state;
}
function expectNoCompletion(markup: string) {
  for (const choice of choices) expect(markup).not.toContain(petalTrainingApproaches[choice].completion);
  expect(markup).not.toContain('이번 수련을 마쳤습니다');
  expect(buttons(markup).some((button) => button.includes('조장 선발전으로'))).toBe(false);
}

describe('petal training stage and action guidance', () => {
  it.each(choices)('presents %s as an intended method and Maru as a guide to remembered movements', (choice) => {
    const markup = render(createPetalTraining(choice));
    expect(markup).toContain(petalTrainingApproaches[choice].pending);
    expect(markup).toContain(petalTrainingApproaches[choice].method);
    expect(markup).toContain('마루는 손가락으로 궤적을 짚습니다.');
    expect(markup).toContain('그 선을 몸으로 다시 만드는 일은 라온의 몫입니다.');
    expect(markup).not.toContain('열여섯 궤적을 한 번 끝까지 이었습니다.');
    expect(buttons(markup).some((button) => button.includes('궤적 수련 시작'))).toBe(true);
    expect(markup).not.toContain('<form');
    expectNoCompletion(markup);
    for (const other of choices.filter((id) => id !== choice)) expect(markup).not.toContain(petalTrainingApproaches[other].pending);
  });

  it('disables breathing at zero burden and enables it after exertion without suggesting the training is already complete', () => {
    const state = createPetalTraining('remember-voices', 1);
    const initial = render(state);
    expect(radio(initial, 'breathe')).toContain('disabled=""');
    expect(radio(initial, 'trace')).toBeDefined();
    expect(radio(initial, 'trace')).not.toContain('disabled=""');
    expect(radio(initial, 'balance')).not.toContain('disabled=""');
    expect(buttons(initial).find((button) => button.includes('선택한 동작 실행'))).toContain('disabled=""');
    expect(initial).toContain('<legend>라온의 수련 동작</legend>');
    expect(initial).toContain('aria-label="몸의 부담"');
    expectNoCompletion(initial);

    const strained = render(resolvePetalTrainingAction(state, 'trace'));
    expect(radio(strained, 'breathe')).not.toContain('disabled=""');
    expect(strained).toContain('aria-label="이어진 궤적 3 / 16"');
    expectNoCompletion(strained);
  });

  it('requires Maru review before displaying the chosen result or a captain-trials advance control', () => {
    const state = reviewState();
    const review = render(state);
    expectNoCompletion(review);
    expect(buttons(review).some((button) => button.includes('마루 앞에서 수련 마무리'))).toBe(true);
    expect(review).not.toContain('<form');

    const profile = completePetalTraining(profileAt(state), state.attempt);
    const completed = render(profile.originStory.petalTraining!);
    expect(completed).toContain(petalTrainingApproaches['distribute-weight'].completion);
    expect(buttons(completed).some((button) => button.includes('조장 선발전으로'))).toBe(true);
    expect(buttons(completed).some((button) => button.includes('마루 앞에서 수련 마무리'))).toBe(false);
    expect(completed).not.toContain('<form');
    expect(completed).not.toContain('라온류를 완성');
  });

  it('does not congratulate a sixteen-petal attempt that failed at the burden limit', () => {
    const markup = render(failedAtSixteen());
    expect(markup).toContain('aria-label="이어진 궤적 16 / 16"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('몸에 실린 부담이 한계에 닿았습니다.');
    expect(markup).toContain('쉬고 다시 연습');
    expect(markup).not.toContain('열여섯 궤적을 한 번 끝까지 이었습니다.');
    expect(markup).not.toContain('마루 앞에서 수련 마무리');
    expect(markup).not.toContain('<form');
    expectNoCompletion(markup);
  });
});

describe('petal training earned records', () => {
  it('shows the actual saved stage on the title without skipping review or restarting completed practice', () => {
    const review = reviewState();
    const completed = completePetalTraining(profileAt(review), review.attempt).originStory.petalTraining!;
    const stages: Array<[PetalTrainingState, string]> = [
      [createPetalTraining('remember-voices'), '마루 수련 준비 · 선택한 방침으로 시작'],
      [practice('remember-voices', ['trace']), '마루 수련 중 · 궤적 3/16 · 부담 2/8'],
      [failedAtSixteen(), '마루 수련 · 쉬고 다시 연습할 차례'],
      [review, '열여섯 궤적 연결 · 마루 앞 마무리 대기'],
      [completed, '마루 수련 마무리 · 조장 선발전으로'],
    ];
    for (const [state, description] of stages) {
      const markup = title(profileAt(state));
      expect(markup).toContain(description);
      expect(buttons(markup).filter((button) => button.includes('라온의 이야기 계속'))).toHaveLength(1);
      if (state.phase !== 'complete') expect(markup).not.toContain('마루 수련 마무리 · 조장 선발전으로');
    }
  });

  it('keeps intended and unfinished results out of the chronicle and isolates a fresh profile', () => {
    const pendingStates = [createPetalTraining('remember-voices'), createPetalTraining('remember-voices', 1), failedAtSixteen(), reviewState()];
    for (const state of pendingStates) {
      const markup = renderToStaticMarkup(<Chronicle profile={profileAt(state)} />);
      expect(markup).not.toContain('힘이 빠진 열여섯 꽃잎');
      for (const choice of getOriginStoryScene('sixteen-petals').choices) expect(markup).not.toContain(choice.result);
    }
    const fresh = title(createNewCampaignProfile());
    expect(fresh).toContain('변방 마을에서 시작');
    expect(fresh).not.toContain('마루 앞');
    expect(fresh).not.toContain('수련 준비');

    const review = reviewState();
    const completed = completePetalTraining(profileAt(review), review.attempt);
    const advanced = advanceOriginStory(completed);
    expect(advanced.originStory.currentSceneId).toBe('captain-trials');
    delete advanced.originStory.petalTraining;
    expect(renderToStaticMarkup(<Chronicle profile={advanced} />)).toContain(getOriginStoryScene('sixteen-petals').choices[1].result);
    expect(title(advanced)).toContain('재능이 예상하지 못한 검');
  });
});

describe('petal training command focus', () => {
  const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let previousActEnvironment: boolean | undefined;
  let container: HTMLDivElement;
  let root: Root;
  let currentState: PetalTrainingState;
  beforeAll(() => { previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT; actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  function mount(initial: PetalTrainingState) {
    function Session() {
      const [state, setState] = useState(initial);
      currentState = state;
      return <PetalTrainingEncounter state={state} onStart={noop}
        onAction={(action) => setState((current) => resolvePetalTrainingAction(current, action))}
        onComplete={() => setState((current) => completePetalTraining(profileAt(current), current.attempt).originStory.petalTraining!)}
        onRetry={noop} onAdvance={noop} onExit={noop} />;
    }
    act(() => root.render(<Session />));
  }
  function submit(action: PetalTrainingAction) {
    act(() => container.querySelector<HTMLInputElement>(`input[value="${action}"]`)!.click());
    const form = container.querySelector('form')!;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(false);
    button.focus();
    // jsdom needs explicit submission; native Tab/Enter is verified separately in Edge.
    act(() => form.requestSubmit(button));
  }

  it('focuses the next unselected action each turn, then preserves review and completion focus', () => {
    mount(createPetalTraining('distribute-weight', 1));
    expect(document.activeElement).toBe(container.querySelector('h1'));
    for (let turn = 1; turn <= 6; turn += 1) {
      submit('balance');
      expect(currentState.turn).toBe(turn);
      if (turn < 6) {
        expect(document.activeElement).toBe(container.querySelector('input[value="trace"]'));
        expect(container.querySelectorAll('input:checked')).toHaveLength(0);
        expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      }
    }
    expect(currentState.phase).toBe('review');
    expect(document.activeElement).toBe(container.querySelector('.petal-training-message'));
    act(() => container.querySelector<HTMLButtonElement>('.petal-training-message button')!.click());
    expect(currentState.phase).toBe('complete');
    expect(document.activeElement).toBe(container.querySelector('.petal-training-message'));
  });

  it('focuses the interruption instead of a removed form when the final petal reaches the burden limit', () => {
    mount(practice('step-beyond-fall', ['trace', 'trace', 'balance']));
    submit('trace');
    expect(currentState).toMatchObject({ phase: 'failed', petals: 16, burden: 8 });
    expect(document.activeElement).toBe(container.querySelector('[role="alert"]'));
    expect(container.querySelector('form')).toBeNull();
  });
});
