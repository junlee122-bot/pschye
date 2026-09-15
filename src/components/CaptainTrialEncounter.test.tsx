import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { captainTrialApproaches, captainTrialDefinitions } from '../data/captainTrial';
import { getOriginStoryScene } from '../data/originStory';
import { createCaptainTrial, resolveCaptainTrialAction } from '../game/captainTrial';
import { completeCaptainTrial } from '../game/captainTrialProgression';
import { advanceOriginStory, chooseOriginStoryPath, createNewCampaignProfile } from '../game/progression';
import type { CampaignProfile, CaptainTrialAction, CaptainTrialChoiceId, CaptainTrialSceneId, CaptainTrialState } from '../types';
import { CaptainTrialEncounter } from './CaptainTrialEncounter';
import { Chronicle } from './Chronicle';
import { TitleScreen } from './TitleScreen';

const noop = () => {};
const duelChoices: Array<[CaptainTrialSceneId, CaptainTrialChoiceId]> = [
  ['captain-trials', 'break-spear-not-kain'], ['captain-trials', 'use-sixteenth-gap'], ['captain-trials', 'declare-my-name'],
  ['kazrin-duel', 'trust-her-recovery'], ['kazrin-duel', 'change-old-rhythm'], ['kazrin-duel', 'step-beside-not-behind'],
];

function render(state: CaptainTrialState) {
  return renderToStaticMarkup(<CaptainTrialEncounter state={state} onStart={noop} onAction={noop} onRetry={noop} onComplete={noop} onAdvance={noop} onExit={noop} />);
}
function profileAt(state: CaptainTrialState): CampaignProfile {
  const profile = createNewCampaignProfile();
  profile.originStory.currentSceneId = state.sceneId;
  const chosen = state.choiceId ? chooseOriginStoryPath(profile, state.sceneId, state.choiceId) : profile;
  return { ...chosen, originStory: { ...chosen.originStory, captainTrials: { [state.sceneId]: state } } };
}
function title(profile: CampaignProfile) {
  return renderToStaticMarkup(<TitleScreen profile={profile} activeSlot={1} slots={[]} onNavigate={noop} onReset={noop} onSelectSlot={noop} />);
}
function buttons(markup: string) {
  return Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), (match) => match[0]);
}
function radio(markup: string, action: CaptainTrialAction) {
  return Array.from(markup.matchAll(/<input\b[^>]*>/g), (match) => match[0])
    .find((input) => input.includes('name="captain-trial-action"') && input.includes(`value="${action}"`));
}
function practice(sceneId: CaptainTrialSceneId, choiceId: CaptainTrialChoiceId | undefined, actions: CaptainTrialAction[]) {
  return actions.reduce(resolveCaptainTrialAction, createCaptainTrial(sceneId, choiceId, 1));
}
function kainResolved() {
  const state = practice('captain-trials', 'use-sixteenth-gap', ['parry', 'counter', 'sidestep', 'counter', 'parry', 'counter']);
  expect(state.phase).toBe('resolved');
  return state;
}
function kainFailed() {
  const state = practice('captain-trials', 'declare-my-name', ['sidestep', 'recover', 'parry', 'recover', 'sidestep']);
  expect(state.phase).toBe('failed');
  return state;
}
function expectNoDuelResults(markup: string) {
  for (const [, choiceId] of duelChoices) expect(markup).not.toContain(captainTrialApproaches[choiceId].completion);
  expect(buttons(markup).some((button) => button.includes('카즈린과의 대결로') || button.includes('하도리에게 도전하기'))).toBe(false);
}

describe('captain trial guidance and result gates', () => {
  it('presents each of the six choices as an intention without exposing another choice or a completed result', () => {
    for (const [sceneId, choiceId] of duelChoices) {
      const markup = render(createCaptainTrial(sceneId, choiceId));
      expect(markup).toContain(captainTrialApproaches[choiceId].label);
      expect(markup).toContain(captainTrialApproaches[choiceId].pending);
      expect(markup).toContain(captainTrialApproaches[choiceId].method);
      expect(markup).toContain(captainTrialDefinitions[sceneId].method);
      expect(markup).toContain('동작을 실행할 때만 공방이 진행됩니다.');
      expect(buttons(markup).some((button) => button.includes('대결 시작'))).toBe(true);
      expect(markup).not.toContain('<form');
      expectNoDuelResults(markup);
      for (const [, other] of duelChoices.filter(([, id]) => id !== choiceId)) expect(markup).not.toContain(captainTrialApproaches[other].pending);
    }
  });

  it('keeps Hadori aftermath out of preparation and treats the one-blow loss as a normal confirmation step', () => {
    const ready = createCaptainTrial('hadori-wall');
    const active = createCaptainTrial('hadori-wall', undefined, 1);
    for (const state of [ready, active]) {
      const markup = render(state);
      expect(markup).toContain('제1조장에게 내딛는 한 걸음');
      expect(markup).not.toContain('의무동');
      expect(markup).not.toContain('한 방');
      expect(markup).not.toContain('<form');
      expect(markup).not.toContain('대결 다시 시도');
      for (const choice of getOriginStoryScene('hadori-wall').choices) {
        expect(markup).not.toContain(choice.title);
        expect(markup).not.toContain(choice.result);
      }
    }
    expect(buttons(render(ready)).some((button) => button.includes('하도리 앞에 서기'))).toBe(true);
    expect(buttons(render(active)).some((button) => button.includes('첫 발을 내딛기'))).toBe(true);
    const resolved = resolveCaptainTrialAction(active, 'challenge');
    expect(resolved).toMatchObject({ phase: 'resolved', turn: 1, poise: 0 });
    const markup = render(resolved);
    expect(markup).toContain('하도리의 한 방으로 도전전은 끝났습니다.');
    expect(markup).toContain('의무동에서 눈뜨기');
    expect(markup).not.toContain('대결 다시 시도');
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('열두 번째');
    expect(markup).not.toContain('검을 거두고 승부 확인');

    const completed = completeCaptainTrial(profileAt(resolved), 'hadori-wall', resolved.attempt);
    expect(render(completed.originStory.captainTrials!['hadori-wall']!)).toContain(captainTrialDefinitions['hadori-wall'].completion);
    const beforeConfirmation = profileAt(resolved);
    expect(chooseOriginStoryPath(beforeConfirmation, 'hadori-wall', 'thank-hadori')).toBe(beforeConfirmation);
    expect(chooseOriginStoryPath(completed, 'hadori-wall', 'thank-hadori').originStory.choices['hadori-wall']).toBe('thank-hadori');
  });

  it('distinguishes Kazrin first defense from the counter opening earned by both defenses', () => {
    const initial = createCaptainTrial('kazrin-duel', 'change-old-rhythm', 1);
    const first = resolveCaptainTrialAction(initial, 'sidestep');
    expect(first.opening).toBe(true);
    const partial = render(first);
    expect(partial).toContain('첫 공격을 읽었습니다. 이어지는 찌르기도 받아내세요.');
    expect(partial).not.toContain('반격할 틈이 열렸습니다.');
    expect(radio(partial, 'counter')).toContain('disabled=""');

    const opened = render(resolveCaptainTrialAction(first, 'parry'));
    expect(opened).toContain('반격할 틈이 열렸습니다.');
    expect(radio(opened, 'counter')).toBeDefined();
    expect(radio(opened, 'counter')).not.toContain('disabled=""');
    const missed = render(practice('kazrin-duel', 'change-old-rhythm', ['parry', 'parry']));
    expect(missed).toContain('이어갈 틈을 만들지 못했습니다.');
    expect(radio(missed, 'counter')).toContain('disabled=""');
    expectNoDuelResults(partial);
    expectNoDuelResults(opened);
  });

  it('explains breath exhaustion and gives only a retry after an interrupted duel', () => {
    const spent = practice('captain-trials', 'break-spear-not-kain', ['parry', 'counter', 'sidestep', 'counter']);
    expect(spent).toMatchObject({ phase: 'active', breath: 0 });
    const markup = render(spent);
    expect(markup).toContain('<legend>이번 공방의 동작</legend>');
    expect(radio(markup, 'parry')).toContain('disabled=""');
    expect(radio(markup, 'sidestep')).toContain('disabled=""');
    expect(radio(markup, 'recover')).not.toContain('disabled=""');
    expect(markup).toContain('호흡이 부족합니다.');
    expect(buttons(markup).find((button) => button.includes('선택한 대응 실행'))).toContain('disabled=""');

    const exhaustedOpening = practice('captain-trials', 'break-spear-not-kain', ['recover', 'parry', 'sidestep', 'counter', 'parry']);
    expect(exhaustedOpening).toMatchObject({ phase: 'active', breath: 0, opening: true, turn: 5 });
    const exhausted = render(exhaustedOpening);
    expect(radio(exhausted, 'counter')).toContain('disabled=""');
    expect(exhausted).toContain('틈은 있지만 호흡이 부족합니다. 호흡을 되찾으세요.');
    expect(exhausted).not.toContain('반격 가능');
    expect(exhausted).not.toContain('반격할 틈이 열렸습니다.');

    const failed = render(kainFailed());
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('대결 다시 시도');
    expect(failed).not.toContain('<form');
    expect(failed).not.toContain('검을 거두고 승부 확인');
    expectNoDuelResults(failed);

    const timeout = practice('captain-trials', 'use-sixteenth-gap', Array.from({ length: 18 }, (_, turn) =>
      (['parry', 'recover', 'sidestep', 'recover'] as const)[turn % 4]));
    expect(timeout).toMatchObject({ phase: 'failed', turn: 18, poise: 6 });
    const timedOut = render(timeout);
    expect(timedOut).toContain('정해진 동작 안에 검로를 잇지 못했습니다.');
    expect(timedOut).not.toContain('균형을 잃어 연결이 끊겼습니다.');
    expect(timedOut).toContain('대결 다시 시도');
    expectNoDuelResults(timedOut);
  });

  it('requires explicit victory confirmation before displaying the chosen outcome and the next duel', () => {
    const resolved = kainResolved();
    const pending = render(resolved);
    expect(pending).toContain('검을 거두고 승부 확인');
    expect(pending).not.toContain('<form');
    expectNoDuelResults(pending);
    const completed = completeCaptainTrial(profileAt(resolved), 'captain-trials', resolved.attempt);
    const markup = render(completed.originStory.captainTrials!['captain-trials']!);
    expect(markup).toContain(captainTrialApproaches['use-sixteenth-gap'].completion);
    expect(buttons(markup).some((button) => button.includes('카즈린과의 대결로'))).toBe(true);
    expect(markup).not.toContain('검을 거두고 승부 확인');
    expect(markup).not.toContain('대결 다시 시도');
    expect(markup).not.toContain('<form');
  });
});

describe('captain trial saved and public records', () => {
  it('resumes the actual duel stage without skipping confirmation or showing Hadori aftermath early', () => {
    const resolved = kainResolved();
    const completed = completeCaptainTrial(profileAt(resolved), 'captain-trials', resolved.attempt).originStory.captainTrials!['captain-trials']!;
    const hadori = practice('hadori-wall', undefined, ['challenge']);
    const hadoriComplete = completeCaptainTrial(profileAt(hadori), 'hadori-wall', hadori.attempt).originStory.captainTrials!['hadori-wall']!;
    const stages: Array<[CaptainTrialState, string]> = [
      [createCaptainTrial('captain-trials', 'use-sixteenth-gap'), '카인 대결 준비'],
      [practice('captain-trials', 'use-sixteenth-gap', ['parry']), '카인 대결 중 · 승부 0/3 · 균형 6/6'],
      [kainFailed(), '카인 대결 · 다시 시도할 차례'],
      [resolved, '카인 대결 · 승부 확인 대기'],
      [completed, '카인 대결 마무리 · 다음 장면으로'],
      [createCaptainTrial('hadori-wall'), '하도리 대결 준비'],
      [createCaptainTrial('hadori-wall', undefined, 1), '하도리에게 첫 발을 내딛을 차례'],
      [hadori, '하도리 도전전 종료 · 의무동으로'],
      [hadoriComplete, '의무동 · 하도리와 나눌 말'],
    ];
    for (const [state, description] of stages) {
      const profile = profileAt(state);
      // Hadori has no pre-duel choice; reaching this scene includes the preceding duel.
      if (state.sceneId === 'hadori-wall') profile.originStory.completedSceneIds = ['kazrin-duel'];
      const markup = title(profile);
      expect(markup).toContain(description);
      expect(buttons(markup).filter((button) => button.includes('라온의 이야기 계속'))).toHaveLength(1);
      if (state.sceneId === 'hadori-wall' && ['ready', 'active'].includes(state.phase)) expect(markup).not.toContain('의무동');
    }
  });

  it('keeps unconfirmed and other choices out of the chronicle while respecting completed legacy progress', () => {
    const resolved = kainResolved();
    const pendingStates = [createCaptainTrial('captain-trials', 'use-sixteenth-gap'), kainFailed(), resolved, practice('hadori-wall', undefined, ['challenge'])];
    for (const state of pendingStates) {
      const markup = renderToStaticMarkup(<Chronicle profile={profileAt(state)} />);
      for (const sceneId of ['captain-trials', 'kazrin-duel', 'hadori-wall']) {
        const scene = getOriginStoryScene(sceneId);
        expect(markup).not.toContain(`<h3>${scene.title}</h3>`);
        for (const choice of scene.choices) expect(markup).not.toContain(choice.result);
      }
    }
    const completed = completeCaptainTrial(profileAt(resolved), 'captain-trials', resolved.attempt);
    const advanced = advanceOriginStory(completed);
    expect(advanced.originStory.currentSceneId).toBe('kazrin-duel');
    delete advanced.originStory.captainTrials;
    const markup = renderToStaticMarkup(<Chronicle profile={advanced} />);
    const [compassion, insight, resolve] = getOriginStoryScene('captain-trials').choices;
    expect(markup).toContain(insight.result);
    expect(markup).not.toContain(compassion.result);
    expect(markup).not.toContain(resolve.result);
    expect(title(advanced)).toContain('따라온 사람을 넘어서는 순간');
    const fresh = title(createNewCampaignProfile());
    expect(fresh).toContain('변방 마을에서 시작');
    expect(fresh).not.toContain('대결 준비');
    expect(fresh).not.toContain('의무동');
  });
});
