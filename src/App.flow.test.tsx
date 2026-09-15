// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { missions } from './data/campaign';
import { getOriginStoryScene, originStoryScenes } from './data/originStory';
import { campaignStorageKey, createNewCampaignProfile, loadCampaignProfile, saveCampaignProfile, setActiveCampaignSlot } from './game/progression';
import type { CaptainTrialAction, CaptainTrialSceneId } from './types';

// No component, reducer, or persistence mocks. This is a DOM/navigation/save
// integration test; jsdom does not verify images, canvas rendering or physics.
// Earlier scenes are fixture preparation, outside this test's playable scope.
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;
let container: HTMLDivElement;
let root: Root;
beforeAll(() => {
  previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/?section=campaign');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function control(selector: string) {
  const element = container.querySelector<HTMLButtonElement | HTMLInputElement>(selector);
  expect(element, `Missing control: ${selector}`).not.toBeNull();
  expect(element!.closest('[hidden]'), `Hidden control: ${selector}`).toBeNull();
  return element!;
}

async function click(selector: string) {
  const element = control(selector);
  expect(element.disabled, `Disabled control: ${selector}`).toBe(false);
  await act(async () => element.click());
  await act(async () => { await vi.dynamicImportSettled(); });
}

async function saved() {
  expect(container.querySelector('.save-failure-banner')).toBeNull();
  expect(window.localStorage.getItem(`${campaignStorageKey}-slot-1`)).not.toBeNull();
  const result = await loadCampaignProfile(1);
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error('The actual save did not reload');
  expect(result.source).toBe('local');
  return result.profile;
}

async function mount() {
  await act(async () => root.render(<App />));
  await act(async () => { await vi.dynamicImportSettled(); });
}

async function remount() {
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
}

async function chooseInsight(sceneId: string) {
  const scene = getOriginStoryScene(sceneId);
  expect(container.querySelector('.origin-heading h1')?.textContent).toBe(scene.title);
  expect((await saved()).originStory.currentSceneId).toBe(sceneId);
  const choice = scene.choices.find((entry) => entry.path === 'insight')!;
  await click('.origin-choice.insight');
  expect((await saved()).originStory.choices[sceneId]).toBe(choice.id);
  return choice;
}

async function playTrial(sceneId: Extract<CaptainTrialSceneId, 'captain-trials' | 'kazrin-duel'>, actions: CaptainTrialAction[]) {
  const choice = await chooseInsight(sceneId);
  expect((await saved()).originStory.captainTrials?.[sceneId]?.phase).toBe('ready');
  await click('.captain-trial-primary');
  for (const [index, action] of actions.entries()) {
    expect(control('.captain-trial-primary[type="submit"]').disabled).toBe(true);
    await click(`input[name="captain-trial-action"][value="${action}"]`);
    await click('.captain-trial-primary[type="submit"]');
    const profile = await saved();
    expect(profile.originStory.captainTrials?.[sceneId]).toMatchObject({ attempt: 1, turn: index + 1, phase: index === actions.length - 1 ? 'resolved' : 'active' });
    expect(profile.originStory.flags).not.toContain(choice.flag);
    expect(profile.world.npcMemories[getOriginStoryScene(sceneId).speakerId]?.rememberedFacts).not.toContain(choice.result);
    expect(container.querySelector('.captain-trial-stats')?.textContent).toContain(`동작${index + 1}`);
  }
  await click('.captain-trial-primary');
  const confirmed = await saved();
  expect(confirmed.originStory.captainTrials?.[sceneId]?.phase).toBe('complete');
  expect(confirmed.originStory.flags.filter((flag) => flag === choice.flag)).toHaveLength(1);
  expect(confirmed.world.npcMemories[getOriginStoryScene(sceneId).speakerId]?.rememberedFacts.filter((fact) => fact === choice.result)).toHaveLength(1);
  await click('.captain-trial-primary');
}

describe('actual App DOM journey after the village prologue', () => {
  it('plays the field exam, Maru training and three trials through induction and the first mission mode choice, saving every action', async () => {
    const seed = createNewCampaignProfile();
    const firstTestedIndex = originStoryScenes.findIndex((scene) => scene.id === 'field-exam');
    seed.originStory.currentSceneId = 'field-exam';
    seed.originStory.completedSceneIds = originStoryScenes.slice(0, firstTestedIndex).map((scene) => scene.id);
    // Real local storage and real save/load APIs; unavailable IndexedDB uses the existing local fallback.
    setActiveCampaignSlot(1);
    expect(await saveCampaignProfile(seed, 1)).toBe(true);
    await mount();

    const fieldChoice = await chooseInsight('field-exam');
    expect((await saved()).originStory.fieldExam?.phase).toBe('ready');
    await click('.field-exam-primary');
    for (let turn = 1; turn <= 3; turn += 1) {
      expect(control('.field-exam-primary[type="submit"]').disabled).toBe(true);
      await click('input[name="field-exam-raon"][value="left"]');
      await click('input[name="field-exam-leo"][value="right"]');
      expect(container.querySelector('.field-exam-preview')?.textContent).toContain('서로 다른 통로');
      await click('.field-exam-primary[type="submit"]');
      const profile = await saved();
      expect(profile.originStory.fieldExam).toMatchObject({ turn, left: turn, right: turn, integrity: turn === 3 ? 2 : 6 - turn, phase: turn === 3 ? 'return' : 'active' });
      expect(profile.originStory.flags).not.toContain(fieldChoice.flag);
      expect(container.querySelector('[role="meter"][aria-label="통로 버팀"]')?.getAttribute('aria-valuenow')).toBe(String(profile.originStory.fieldExam!.integrity));
      if (turn === 1) {
        await remount();
        expect((await saved()).originStory.fieldExam?.turn).toBe(1);
        expect(container.querySelector('.field-exam-stats')?.textContent).toContain('실행한 명령1');
      }
    }
    await click('.field-exam-primary');
    expect((await saved()).originStory.fieldExam?.phase).toBe('complete');
    expect((await saved()).originStory.flags).toContain(fieldChoice.flag);
    await click('.field-exam-primary');

    await chooseInsight('suspended-candidate');
    await click('.origin-advance');
    await chooseInsight('maru-door');
    await click('.origin-advance');
    const petalChoice = await chooseInsight('sixteen-petals');
    expect((await saved()).originStory.petalTraining?.phase).toBe('ready');
    await click('.petal-training-primary');
    for (let turn = 1; turn <= 6; turn += 1) {
      expect(control('.petal-training-primary[type="submit"]').disabled).toBe(true);
      await click('input[name="petal-training-action"][value="balance"]');
      await click('.petal-training-primary[type="submit"]');
      const profile = await saved();
      expect(profile.originStory.petalTraining).toMatchObject({ turn, petals: Math.min(16, turn * 3), burden: turn, phase: turn === 6 ? 'review' : 'active' });
      expect(profile.originStory.flags).not.toContain(petalChoice.flag);
      expect(container.querySelector('[role="meter"][aria-label="몸의 부담"]')?.getAttribute('aria-valuenow')).toBe(String(turn));
    }
    await click('.petal-training-primary');
    expect((await saved()).originStory.petalTraining?.phase).toBe('complete');
    expect((await saved()).originStory.flags).toContain(petalChoice.flag);
    await click('.petal-training-primary');

    await playTrial('captain-trials', ['parry', 'counter', 'sidestep', 'counter', 'parry', 'counter']);
    await playTrial('kazrin-duel', ['sidestep', 'parry', 'counter', 'sidestep', 'parry', 'counter', 'sidestep', 'parry', 'counter']);
    expect((await saved()).originStory.currentSceneId).toBe('hadori-wall');
    expect(container.querySelector('.origin-choice-grid')).toBeNull();
    await click('.captain-trial-primary');
    expect((await saved()).originStory.captainTrials?.['hadori-wall']?.phase).toBe('active');
    await click('.captain-trial-primary');
    const defeated = await saved();
    expect(defeated.originStory.captainTrials?.['hadori-wall']).toMatchObject({ phase: 'resolved', turn: 1, poise: 0 });
    expect(defeated.originStory.choices['hadori-wall']).toBeUndefined();
    expect(container.querySelector('.captain-trial-message h2')?.textContent).toBe('한 방, 그리고 의무동.');
    await click('.captain-trial-primary');
    expect((await saved()).originStory.captainTrials?.['hadori-wall']?.phase).toBe('complete');
    await chooseInsight('hadori-wall');
    await click('.origin-advance');
    await chooseInsight('seventh-oath');
    await click('.origin-advance');

    const inducted = await saved();
    expect(inducted.originStory.completed).toBe(true);
    expect(inducted.originStory.completedSceneIds).toEqual(originStoryScenes.map((scene) => scene.id));
    expect(inducted.heroProgress).toEqual(seed.heroProgress);
    for (const key of ['day', 'supplies', 'intel', 'relics', 'renown'] as const) expect(inducted[key]).toBe(seed[key]);
    expect(inducted.unlockedRecords).toContain('psyche-generation-07');
    expect(inducted.storyChoices).toEqual({});
    expect(container.querySelector('.raon-journey-heading h2')?.textContent).toBe('라온의 기록');
    expect(container.querySelector<HTMLButtonElement>('.story-launch-button')!.disabled).toBe(true);
    await click('.conversation-next');
    await click('.stage-navigation-row button.stage-next-button');
    await click('.story-choice-card.choice-insight');
    expect((await saved()).storyChoices[missions[0]!.id]).toBe('insight');
    await click('.raon-choice-section .stage-next-button');
    expect(control('.story-launch-button').disabled).toBe(false);
    await click('.story-launch-button');

    const launched = await saved();
    expect(container.querySelector('#combat-mode-title')?.textContent).toBe('라온은 어떻게 전장에 들어갈까?');
    expect(container.querySelectorAll('.combat-mode-card')).toHaveLength(2);
    expect(control('.combat-mode-card.action').disabled).toBe(false);
    expect(control('.combat-mode-card.tactical').disabled).toBe(false);
    expect(container.querySelector('canvas')).toBeNull();
    expect(launched.battleAttempt).toMatchObject({ missionId: missions[0]!.id, mode: 'select', difficulty: 'standard', raonStance: 'insight', settled: false, battle: { outcome: 'active' } });
    expect(launched.battleAttempt!.heroes).toHaveLength(6);
    expect(launched.completedMissions).toEqual([]);
    expect(launched.heroProgress).toEqual(seed.heroProgress);
  }, 20000);
});
