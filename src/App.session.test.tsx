// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { getOriginStoryScene } from './data/originStory';
import type { CampaignLoadResult } from './game/persistence';
import { advanceOriginStory, chooseOriginStoryPath, createNewCampaignProfile } from './game/progression';
import { executeGameCommand } from './game/simulation';
import { startVillageRescue } from './game/villageRescueProgression';
import type { CampaignProfile } from './types';

type VillageProps = ComponentProps<typeof import('./components/VillageAdventure').VillageAdventure>;
type RescueProps = ComponentProps<typeof import('./components/VillageRescueEncounter').VillageRescueEncounter>;
const harness = vi.hoisted(() => ({
  profiles: new Map<number, CampaignProfile>(),
  village: undefined as VillageProps | undefined,
  rescue: undefined as RescueProps | undefined,
  load: vi.fn<(slot: number) => Promise<CampaignLoadResult>>(),
  save: vi.fn<(profile: CampaignProfile, slot: number) => Promise<boolean>>(),
  activeSlot: vi.fn(() => 1),
  setSlot: vi.fn(),
}));

// Keep the actual reducers and CampaignSlotSession. Only storage I/O is controlled.
vi.mock('./game/progression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./game/progression')>();
  return {
    ...actual,
    loadCampaignProfile: harness.load,
    saveCampaignProfile: harness.save,
    getActiveCampaignSlot: harness.activeSlot,
    setActiveCampaignSlot: harness.setSlot,
    listCampaignSlots: () => [1, 2, 3].map((slot) => {
      const profile = harness.profiles.get(slot);
      return { slot, exists: Boolean(profile), day: profile?.day ?? 1, originCompleted: profile?.originStory.completed ?? false,
        sceneTitle: profile?.originStory.currentSceneId ?? '새로운 여정', missions: profile?.completedMissions.length ?? 0 };
    }),
  };
});

// Capture callbacks supplied by the real App, without recreating its guards.
// Other views, including TitleScreen's navigation/reset/slot controls, are real.
vi.mock('./components/VillageAdventure', () => ({
  VillageAdventure: (props: VillageProps) => {
    harness.village = props;
    return <main data-testid="village-surface"><button onClick={props.onExit}>타이틀</button></main>;
  },
}));
vi.mock('./components/VillageRescueEncounter', () => ({
  VillageRescueEncounter: (props: RescueProps) => {
    harness.rescue = props;
    return <main data-testid="rescue-surface"><button onClick={props.onExit}>타이틀</button>
      {props.state.phase === 'failed' && <button onClick={props.onRetry}>다시 시도</button>}
    </main>;
  },
}));

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
  harness.profiles.clear();
  harness.village = undefined;
  harness.rescue = undefined;
  vi.clearAllMocks();
  harness.activeSlot.mockReturnValue(1);
  harness.load.mockImplementation(async (slot) => ({
    status: 'ready', source: 'local', profile: structuredClone(harness.profiles.get(slot) ?? createNewCampaignProfile()),
  }));
  harness.save.mockImplementation(async (profile, slot) => {
    harness.profiles.set(slot, structuredClone(profile));
    return true;
  });
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function villageAt(x: number, y: number) {
  const profile = createNewCampaignProfile();
  return { ...profile, world: executeGameCommand(profile.world, { type: 'move', x, y }).state };
}

function activeRescue() {
  let profile = createNewCampaignProfile();
  for (const sceneId of ['village-dawn', 'windmill-trouble']) {
    profile = chooseOriginStoryPath(profile, sceneId, getOriginStoryScene(sceneId).choices[0].id);
    profile = advanceOriginStory(profile);
  }
  return startVillageRescue(chooseOriginStoryPath(profile, 'river-incident', 'save-child'));
}

async function click(selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button, `Missing control: ${selector}`).not.toBeNull();
  await act(async () => button!.click());
}

async function mount(profile = villageAt(366, 606)) {
  harness.profiles.set(1, profile);
  await act(async () => root.render(<App />));
  await click('.title-actions .primary-action');
  await act(async () => { await vi.dynamicImportSettled(); });
}

async function switchToSlotTwo() {
  await click('[data-testid] button');
  const slotTwo = [...container.querySelectorAll<HTMLButtonElement>('.title-save-grid button')]
    .find((button) => button.textContent?.includes('SLOT 02'));
  expect(slotTwo).toBeDefined();
  await act(async () => slotTwo!.click());
  expect(harness.load).toHaveBeenLastCalledWith(2);
  await click('.title-actions .primary-action');
}

describe('App callback lifetime across saves and village retries', () => {
  it('ignores a previous slot’s movement callback after another slot loads the same village scene', async () => {
    const slotTwo = villageAt(470, 350);
    harness.profiles.set(2, slotTwo);
    await mount();
    const oldMove = harness.village!.onMove!;
    await switchToSlotTwo();
    await act(async () => oldMove(111, 222, 'old-slot'));
    expect(harness.village!.profile).toEqual(slotTwo);
    expect(harness.profiles.get(2)).toEqual(slotTwo);
    await act(async () => harness.village!.onMove!(480, 360));
    expect(harness.profiles.get(2)!.world.village).toMatchObject({ playerX: 480, playerY: 360 });
  });

  it('ignores a previous slot’s choice callback without changing the new slot’s choice, score or relationship', async () => {
    const slotTwo = villageAt(470, 350);
    harness.profiles.set(2, slotTwo);
    await mount();
    const oldChoice = harness.village!.onChoose;
    await switchToSlotTwo();
    const scene = getOriginStoryScene('village-dawn');
    await act(async () => oldChoice(scene.id, scene.choices[0].id));
    expect(harness.village!.profile).toEqual(slotTwo);
    expect(harness.profiles.get(2)).toEqual(slotTwo);
    await act(async () => harness.village!.onChoose(scene.id, scene.choices[1].id));
    expect(harness.profiles.get(2)).toEqual(chooseOriginStoryPath(slotTwo, scene.id, scene.choices[1].id));
  });

  it('accepts only one rescue action from two calls captured in the same render', async () => {
    await mount(activeRescue());
    const oldAction = harness.rescue!.onAction;
    await act(async () => {
      oldAction({ type: 'move', dx: 1, dy: 0 });
      oldAction({ type: 'move', dx: 1, dy: 0 });
    });
    expect(harness.rescue!.state).toMatchObject({ attempt: 1, turn: 1, x: 1 });
    expect(harness.profiles.get(1)!.originStory.villageRescue).toEqual(harness.rescue!.state);
    await act(async () => harness.rescue!.onAction({ type: 'move', dx: 1, dy: 0 }));
    expect(harness.rescue!.state).toMatchObject({ turn: 2, x: 2 });
  });

  it('rejects an old rescue action after a real timeout and retry creates the next attempt', async () => {
    await mount(activeRescue());
    const oldAction = harness.rescue!.onAction;
    for (let turn = 0; turn < 24; turn += 1) await act(async () => harness.rescue!.onAction({ type: 'guard' }));
    expect(harness.rescue!.state).toMatchObject({ phase: 'failed', attempt: 1, turn: 24 });
    await click('[data-testid="rescue-surface"] button:last-child');
    expect(harness.rescue!.state).toMatchObject({ phase: 'active', attempt: 2, turn: 0 });
    const retried = structuredClone(harness.profiles.get(1)!);
    await act(async () => oldAction({ type: 'move', dx: 1, dy: 0 }));
    expect(harness.profiles.get(1)).toEqual(retried);
    expect(harness.rescue!.state).toEqual(retried.originStory.villageRescue);
    await act(async () => harness.rescue!.onAction({ type: 'move', dx: 1, dy: 0 }));
    expect(harness.rescue!.state).toMatchObject({ attempt: 2, turn: 1, x: 1 });
  });

  it('ignores movement and choice callbacks from before a new game in the same slot', async () => {
    await mount();
    const oldMove = harness.village!.onMove!;
    const oldChoice = harness.village!.onChoose;
    await click('[data-testid="village-surface"] button');
    await click('.title-reset');
    expect(window.confirm).toHaveBeenCalledTimes(1);
    await click('.title-actions .primary-action');
    const fresh = createNewCampaignProfile();
    expect(harness.profiles.get(1)).toEqual(fresh);
    await act(async () => {
      oldMove(111, 222, 'previous-game');
      oldChoice('village-dawn', getOriginStoryScene('village-dawn').choices[0].id);
    });
    expect.soft(harness.village!.profile.world).toEqual(fresh.world);
    expect.soft(harness.village!.profile.originStory).toEqual(fresh.originStory);
    expect(harness.profiles.get(1)).toEqual(fresh);
  });
});
