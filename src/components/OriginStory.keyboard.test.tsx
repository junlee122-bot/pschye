// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOriginStoryScene } from '../data/originStory';
import { createNewCampaignProfile } from '../game/progression';
import { OriginStory } from './OriginStory';

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;
let container: HTMLDivElement;
let root: Root;
const onChoose = vi.fn();
const onAdvance = vi.fn();
const onExit = vi.fn();

beforeAll(() => {
  previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderScene(selected = false, sceneId = 'capital-gate') {
  const profile = createNewCampaignProfile();
  profile.originStory.currentSceneId = sceneId;
  const scene = getOriginStoryScene(sceneId);
  if (selected) profile.originStory.choices[sceneId] = scene.choices[0].id;
  act(() => root.render(<OriginStory profile={profile} onChoose={onChoose} onAdvance={onAdvance} onExit={onExit} />));
  return scene;
}
function heading() { return container.querySelector('h1')!; }
function key(target: EventTarget, value: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
  act(() => { target.dispatchEvent(event); });
  return event;
}

describe('origin story keyboard ownership', () => {
  it('focuses the scene title on entry and a new scene, keeping plain number and Enter shortcuts on the page', () => {
    const scene = renderScene();
    expect(document.activeElement).toBe(heading());
    for (const [index, choice] of scene.choices.entries()) {
      expect(key(heading(), String(index + 1)).defaultPrevented).toBe(true);
      expect(onChoose).toHaveBeenNthCalledWith(index + 1, scene.id, choice.id);
    }
    expect(key(heading(), 'Enter').defaultPrevented).toBe(false);
    expect(onAdvance).not.toHaveBeenCalled();

    renderScene(true, 'seventh-oath');
    expect(document.activeElement).toBe(heading());
    expect(heading().textContent).toBe(getOriginStoryScene('seventh-oath').title);
    expect(key(heading(), 'Enter').defaultPrevented).toBe(true);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not advance a selected scene when Enter targets the title-exit button or its child', () => {
    renderScene(true);
    const exit = container.querySelector<HTMLButtonElement>('.origin-back')!;
    exit.focus();
    expect(key(exit, 'Enter').defaultPrevented).toBe(false);
    expect(key(exit.querySelector('svg')!, 'Enter').defaultPrevented).toBe(false);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
    // jsdom does not synthesize a native click from a KeyboardEvent.
    act(() => exit.click());
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('leaves the advance button activation to its own handler instead of advancing twice', () => {
    renderScene(true);
    const advance = container.querySelector<HTMLButtonElement>('.origin-advance')!;
    advance.focus();
    expect(key(advance, 'Enter').defaultPrevented).toBe(false);
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => advance.click());
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not let global shortcuts change choices from interactive descendants or editing areas', () => {
    renderScene();
    for (const tag of ['button', 'a', 'input', 'select', 'textarea', 'div']) {
      const control = document.createElement(tag);
      if (tag === 'a') control.setAttribute('href', '#review');
      if (tag === 'div') control.setAttribute('contenteditable', 'true');
      container.append(control);
      const target = ['button', 'a', 'div'].includes(tag) ? control.appendChild(document.createElement('span')) : control;
      expect(key(target, '1').defaultPrevented).toBe(false);
      expect(onChoose).not.toHaveBeenCalled();
      control.remove();
    }
    renderScene(true);
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'plaintext-only');
    container.append(editor);
    expect(key(editor, 'Enter').defaultPrevented).toBe(false);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('ignores prevented, repeated, modified and composing keys while allowing later plain shortcuts', () => {
    renderScene();
    const ignored: KeyboardEventInit[] = [
      { repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true },
    ];
    for (const options of ignored) key(heading(), '1', options);
    const prevented = new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true });
    prevented.preventDefault();
    act(() => { heading().dispatchEvent(prevented); });
    expect(onChoose).not.toHaveBeenCalled();
    expect(key(heading(), '3').defaultPrevented).toBe(true);
    expect(onChoose).toHaveBeenCalledTimes(1);

    renderScene(true);
    for (const options of ignored) key(heading(), 'Enter', options);
    const blockedEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    blockedEnter.preventDefault();
    act(() => { heading().dispatchEvent(blockedEnter); });
    expect(onAdvance).not.toHaveBeenCalled();
    expect(key(document.body, 'Enter').defaultPrevented).toBe(true);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('removes the shortcut listener when leaving the story screen', () => {
    renderScene(true);
    act(() => root.render(<p>다른 화면</p>));
    expect(key(document.body, 'Enter').defaultPrevented).toBe(false);
    expect(key(document.body, '1').defaultPrevented).toBe(false);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
