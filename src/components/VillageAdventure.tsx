import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Phaser from 'phaser';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpenText, Compass, Footprints, Heart, LocateFixed, MapPin, Search, ShieldCheck, Sparkles, Swords } from 'lucide-react';
import { getOriginStoryScene } from '../data/originStory';
import { villageRescueApproaches } from '../data/villageRescue';
import { getVillageRescue } from '../game/villageRescueProgression';
import { villageRescueReturnPoint } from '../game/villageRescue';
import {
  getVillageInteraction,
  villageInteractionPoints,
  villageLandmarks,
  villageMapAssets,
  villageMinimapAsset,
  villageProps,
  villageRaonAsset,
  villageResidents,
  type VillageAmbience,
} from '../data/village';
import { stabilizePhaserRuntime } from '../game/phaserRuntime';
import { isVillageTargetReady, updateVillageReadiness, type VillageReadiness } from '../game/villageInteraction';
import type { CampaignProfile, OriginStoryChoice, RaonStoryChoiceId } from '../types';
import './VillagePrologue.css';

const WIDTH = 1280;
const HEIGHT = 720;
const READY_EVENT = 'raonjena:village-ready';
const OPEN_EVENT = 'raonjena:village-open';
const MODEL_EVENT = 'raonjena:village-model';
const MOVE_EVENT = 'raonjena:village-move';
const POSITION_EVENT = 'raonjena:village-position';
const SYNC_POSITION_EVENT = 'raonjena:village-sync-position';

interface VillageModel {
  sceneId: string;
  targetX: number;
  targetY: number;
  targetName: string;
  targetSprite: string;
  targetTexture: string;
  landmark: string;
  playerX: number;
  playerY: number;
  ambience: VillageAmbience;
  inputLocked: boolean;
}

interface VillagePosition {
  x: number;
  y: number;
  landmark?: string;
}

let bootVillageModel: VillageModel | null = null;

interface VillageAdventureProps {
  profile: CampaignProfile;
  onChoose: (sceneId: string, choiceId: string) => void;
  onAdvance: () => void;
  onExit: () => void;
  onMove?: (x: number, y: number, landmark?: string) => void;
  onStartRescue: () => void;
  onRescueReturn: () => void;
}

const pathMeta: Record<RaonStoryChoiceId, { label: string; icon: typeof Heart }> = {
  compassion: { label: '연민', icon: Heart },
  insight: { label: '통찰', icon: Search },
  resolve: { label: '결의', icon: Swords },
};

const ambienceLabels: Record<VillageAmbience, string> = {
  dawn: '새벽',
  morning: '한낮',
  'river-alert': '해질녘',
  arrival: '선발일',
  night: '밤',
};

function fitImageHeight(image: Phaser.GameObjects.Image, height: number) {
  const ratio = height / image.height;
  image.setDisplaySize(image.width * ratio, height);
  return image;
}

class FrontierVillageScene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private nightVeil?: Phaser.GameObjects.Rectangle;
  private player?: Phaser.GameObjects.Container;
  private playerSprite?: Phaser.GameObjects.Image;
  private target?: Phaser.GameObjects.Container;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>;
  private currentModel!: VillageModel;
  private readiness?: VillageReadiness;
  private lastPositionBroadcast = 0;
  private lastLandmark?: string;
  private lastBroadcastPosition?: { x: number; y: number };
  private readonly blockedZones = [
    new Phaser.Geom.Rectangle(142, 76, 300, 230),
    new Phaser.Geom.Rectangle(12, 392, 255, 192),
    new Phaser.Geom.Rectangle(410, 432, 233, 184),
    new Phaser.Geom.Rectangle(756, 136, 184, 157),
    new Phaser.Geom.Rectangle(1002, 48, 192, 170),
    new Phaser.Geom.Rectangle(968, 470, 312, 250),
    new Phaser.Geom.Rectangle(720, 681, 560, 39),
  ];

  constructor() {
    super({ key: 'FrontierVillageScene' });
  }

  preload() {
    Object.entries(villageMapAssets).forEach(([ambience, source]) => this.load.image(`village-map-${ambience}`, source));
    this.load.image('village-raon', villageRaonAsset);
    villageResidents.forEach((resident) => this.load.image(`resident-${resident.id}`, resident.sprite));
    villageProps.forEach((prop) => this.load.image(`prop-${prop.id}`, prop.sprite));
    villageInteractionPoints.forEach((interaction) => this.load.image(`target-${interaction.sceneId}`, interaction.targetSprite));
  }

  create() {
    const registryModel = this.game.registry.get('village-model') as VillageModel | undefined;
    const initialModel = registryModel ?? bootVillageModel;
    if (!initialModel) throw new Error('Village scene started without a world model.');
    this.currentModel = initialModel;
    this.readiness = undefined;
    this.lastPositionBroadcast = 0;
    this.lastLandmark = undefined;
    this.lastBroadcastPosition = undefined;

    this.background = this.add.image(WIDTH / 2, HEIGHT / 2, `village-map-${initialModel.ambience}`)
      .setDisplaySize(WIDTH, HEIGHT)
      .setDepth(-50);
    this.nightVeil = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x091124, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(-44);

    this.createAmbientWorld();
    this.createWorldProps();
    this.createResidents();
    this.createLandmarkLabels();
    this.updateAmbience(initialModel.ambience);

    this.target = this.createTarget(initialModel);
    const spawn = this.sanitizeSpawn(initialModel.playerX, initialModel.playerY);
    this.player = this.createPlayer(spawn.x, spawn.y);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,E') as Record<'W' | 'A' | 'S' | 'D' | 'E', Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D', 'E']);
    this.game.events.on(MODEL_EVENT, this.syncModel, this);
    this.game.events.on(MOVE_EVENT, this.virtualMove, this);
    this.game.events.on(SYNC_POSITION_EVENT, this.broadcastPosition, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(MODEL_EVENT, this.syncModel, this);
      this.game.events.off(MOVE_EVENT, this.virtualMove, this);
      this.game.events.off(SYNC_POSITION_EVENT, this.broadcastPosition, this);
    });

    this.cameras.main.fadeIn(650, 12, 13, 12);
    this.publishReadiness(true);
    this.broadcastPosition();
  }

  private createAmbientWorld() {
    const forgeGlow = this.add.circle(538, 551, 54, 0xff9149, 0.13)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-20);
    this.tweens.add({ targets: forgeGlow, alpha: { from: 0.06, to: 0.17 }, scale: { from: 0.86, to: 1.08 }, yoyo: true, repeat: -1, duration: 1450 });

    const riverLight = this.add.graphics().setDepth(-18).setAlpha(0.3);
    riverLight.lineStyle(2, 0xa8edf0, 0.34);
    riverLight.beginPath();
    riverLight.moveTo(954, 515);
    riverLight.lineTo(1015, 543);
    riverLight.lineTo(1080, 530);
    riverLight.moveTo(861, 650);
    riverLight.lineTo(926, 664);
    riverLight.lineTo(1005, 654);
    riverLight.strokePath();
    this.tweens.add({ targets: riverLight, alpha: { from: 0.12, to: 0.42 }, yoyo: true, repeat: -1, duration: 1700 });

    for (let index = 0; index < 18; index += 1) {
      const mote = this.add.circle(
        Phaser.Math.Between(70, 1210),
        Phaser.Math.Between(170, 655),
        Phaser.Math.Between(1, 3),
        index % 3 === 0 ? 0xeecb87 : 0xd8ddd2,
        Phaser.Math.FloatBetween(0.12, 0.32),
      ).setDepth(900);
      this.tweens.add({
        targets: mote,
        x: mote.x + Phaser.Math.Between(20, 75),
        y: mote.y - Phaser.Math.Between(15, 55),
        alpha: 0,
        duration: Phaser.Math.Between(3100, 6100),
        delay: Phaser.Math.Between(0, 1800),
        repeat: -1,
      });
    }

    for (let index = 0; index < 4; index += 1) {
      const mist = this.add.ellipse(-170 - index * 230, 130 + index * 115, 330, 54, 0xe3e7dd, 0.035).setDepth(-24);
      this.tweens.add({ targets: mist, x: WIDTH + 220, duration: 22000 + index * 4200, delay: index * 1800, repeat: -1 });
    }

    const embers = Array.from({ length: 9 }, (_, index) => this.add.circle(528 + index * 4, 559, 2, 0xffb15d, 0.55).setDepth(700));
    embers.forEach((ember, index) => {
      this.tweens.add({ targets: ember, x: ember.x + Phaser.Math.Between(-18, 20), y: ember.y - Phaser.Math.Between(30, 70), alpha: 0, duration: 1200 + index * 170, delay: index * 145, repeat: -1 });
    });
  }

  private createWorldProps() {
    villageProps.forEach((prop) => {
      const container = this.add.container(prop.x, prop.y).setDepth(prop.y + 90).setAlpha(prop.alpha ?? 1);
      const shadow = this.add.ellipse(0, 2, Math.max(22, prop.height * 0.55), Math.max(8, prop.height * 0.14), 0x030403, 0.28);
      const sprite = fitImageHeight(this.add.image(0, 0, `prop-${prop.id}`).setOrigin(0.5, 1), prop.height);
      container.add([shadow, sprite]);
      if (prop.id.includes('lantern')) {
        const glow = this.add.circle(0, -prop.height * 0.55, 18, 0xffbd6c, 0.14).setBlendMode(Phaser.BlendModes.ADD);
        container.addAt(glow, 1);
        this.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.3 }, scale: { from: 0.8, to: 1.2 }, yoyo: true, repeat: -1, duration: 1250 });
      }
    });
  }

  private createResidents() {
    villageResidents.forEach((resident, index) => {
      const container = this.add.container(resident.x, resident.y).setDepth(resident.y + 120);
      const shadow = this.add.ellipse(0, 1, resident.height * 0.38, resident.height * 0.11, 0x020302, 0.4);
      const sprite = fitImageHeight(this.add.image(0, 0, `resident-${resident.id}`).setOrigin(0.5, 1), resident.height);
      const name = this.add.text(0, 8, resident.name, {
        fontFamily: 'Noto Sans KR',
        fontSize: '11px',
        color: '#efe3cd',
        backgroundColor: '#090b0ad8',
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5, 0);
      container.add([shadow, sprite, name]);
      this.tweens.add({ targets: sprite, y: -2, yoyo: true, repeat: -1, duration: 1550 + index * 230, ease: 'Sine.easeInOut' });
      if (resident.id === 'child') {
        this.tweens.add({ targets: container, x: resident.x + 38, duration: 4300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });
  }

  private createLandmarkLabels() {
    villageLandmarks.forEach((landmark) => {
      const label = this.add.text(landmark.x, landmark.y - landmark.discoveryRadius * 0.52, `◆  ${landmark.name}`, {
        fontFamily: 'Noto Serif KR',
        fontSize: '11px',
        color: '#d8c6a5',
        backgroundColor: '#0c0d0bd0',
        padding: { x: 7, y: 4 },
      }).setOrigin(0.5).setDepth(850).setAlpha(0.76);
      this.tweens.add({ targets: label, alpha: { from: 0.52, to: 0.82 }, yoyo: true, repeat: -1, duration: 2400 + landmark.x });
    });
  }

  private createPlayer(x: number, y: number) {
    const container = this.add.container(x, y).setDepth(y + 200);
    const groundGlow = this.add.ellipse(0, 1, 52, 18, 0xd3aa62, 0.12).setStrokeStyle(1, 0xe9cf94, 0.38);
    const shadow = this.add.ellipse(0, 2, 38, 12, 0x000000, 0.48);
    this.playerSprite = fitImageHeight(this.add.image(0, 0, 'village-raon').setOrigin(0.5, 1), 116);
    const label = this.add.text(0, -123, '라온 · YOU', {
      fontFamily: 'Cinzel, Noto Sans KR',
      fontSize: '12px',
      color: '#fff1c8',
      backgroundColor: '#111217e8',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1);
    container.add([groundGlow, shadow, this.playerSprite, label]);
    this.tweens.add({ targets: groundGlow, alpha: { from: 0.05, to: 0.2 }, scale: { from: 0.82, to: 1.16 }, yoyo: true, repeat: -1, duration: 1350 });
    return container;
  }

  private createTarget(model: VillageModel) {
    const container = this.add.container(model.targetX, model.targetY).setDepth(model.targetY + 190);
    const outer = this.add.ellipse(0, 1, 76, 28, 0xcaa665, 0.08).setStrokeStyle(2, 0xe7c67f, 0.72);
    const inner = this.add.ellipse(0, 1, 42, 16, 0xe5c57e, 0.18);
    const targetHeight = model.sceneId === 'recruiters-arrive' ? 120 : 126;
    const sprite = fitImageHeight(this.add.image(0, 0, model.targetTexture).setOrigin(0.5, 1), targetHeight);
    const marker = this.add.text(0, -targetHeight - 34, '◆', { fontFamily: 'Cinzel', fontSize: '25px', color: '#f1d794' }).setOrigin(0.5);
    const label = this.add.text(0, -targetHeight - 10, model.targetName, {
      fontFamily: 'Noto Serif KR',
      fontSize: '13px',
      color: '#fff0c9',
      backgroundColor: '#11120fed',
      padding: { x: 9, y: 5 },
    }).setOrigin(0.5);
    container.add([outer, inner, sprite, marker, label]);
    this.tweens.add({ targets: [outer, marker], alpha: { from: 0.35, to: 1 }, scale: { from: 0.86, to: 1.08 }, yoyo: true, repeat: -1, duration: 920 });
    this.tweens.add({ targets: sprite, y: -2, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.easeInOut' });
    return container;
  }

  private updateAmbience(ambience: VillageAmbience) {
    this.background?.setTexture(`village-map-${ambience}`).setDisplaySize(WIDTH, HEIGHT);
    this.nightVeil?.setAlpha(ambience === 'night' ? 0.2 : ambience === 'river-alert' ? 0.055 : 0);
  }

  private syncModel(model: VillageModel) {
    const ambienceChanged = this.currentModel.ambience !== model.ambience;
    const targetChanged = this.currentModel.sceneId !== model.sceneId
      || this.currentModel.targetX !== model.targetX || this.currentModel.targetY !== model.targetY
      || this.currentModel.targetName !== model.targetName || this.currentModel.targetSprite !== model.targetSprite;
    this.currentModel = model;
    if (ambienceChanged) {
      this.cameras.main.fadeOut(180, 10, 11, 10);
      this.time.delayedCall(190, () => {
        this.updateAmbience(model.ambience);
        this.cameras.main.fadeIn(300, 10, 11, 10);
      });
    }
    if (targetChanged) {
      this.target?.destroy(true);
      this.target = this.createTarget(model);
    }
    // React may subscribe after scene creation or synchronize a new target
    // while the player is stationary. Republish the live geometry in both cases.
    this.publishReadiness(true);
  }

  private virtualMove(vector: { x: number; y: number }) {
    if (this.currentModel.inputLocked) return;
    this.movePlayer(vector.x, vector.y, 28);
    this.publishReadiness();
    this.broadcastPosition();
  }

  private publishReadiness(force = false) {
    if (!this.player || !this.target) return false;
    const next = updateVillageReadiness(this.readiness, this.currentModel.sceneId, this.player, this.target);
    if (force || next !== this.readiness) this.game.events.emit(READY_EVENT, next);
    this.readiness = next;
    return next.nearTarget;
  }

  private sanitizeSpawn(x: number, y: number) {
    const clamped = { x: Phaser.Math.Clamp(x, 32, WIDTH - 32), y: Phaser.Math.Clamp(y, 48, HEIGHT - 34) };
    return this.isWalkable(clamped.x, clamped.y) ? clamped : { x: 366, y: 626 };
  }

  private isWalkable(x: number, y: number) {
    return !this.blockedZones.some((zone) => Phaser.Geom.Rectangle.Contains(zone, x, y));
  }

  private movePlayer(x: number, y: number, speed: number) {
    if (!this.player) return;
    const nextX = Phaser.Math.Clamp(this.player.x + x * speed, 28, WIDTH - 28);
    const nextY = Phaser.Math.Clamp(this.player.y + y * speed, 42, HEIGHT - 26);
    if (this.isWalkable(nextX, nextY)) {
      this.player.setPosition(nextX, nextY);
    } else if (this.isWalkable(nextX, this.player.y)) {
      this.player.x = nextX;
    } else if (this.isWalkable(this.player.x, nextY)) {
      this.player.y = nextY;
    }
    this.player.setDepth(this.player.y + 200);
    if (x !== 0) this.playerSprite?.setFlipX(x < 0);
  }

  private nearestLandmark() {
    if (!this.player) return undefined;
    return villageLandmarks.find((landmark) => Phaser.Math.Distance.Between(this.player!.x, this.player!.y, landmark.x, landmark.y) < landmark.discoveryRadius)?.name;
  }

  private broadcastPosition() {
    if (!this.player) return;
    const landmark = this.nearestLandmark();
    this.lastLandmark = landmark;
    this.lastBroadcastPosition = { x: this.player.x, y: this.player.y };
    this.game.events.emit(POSITION_EVENT, { x: this.player.x, y: this.player.y, landmark } satisfies VillagePosition);
  }

  update(time: number, delta: number) {
    if (!this.player || !this.target || !this.keys) return;
    if (this.currentModel.inputLocked) return;
    const horizontal = (this.cursors?.left.isDown || this.keys.A.isDown ? -1 : 0) + (this.cursors?.right.isDown || this.keys.D.isDown ? 1 : 0);
    const vertical = (this.cursors?.up.isDown || this.keys.W.isDown ? -1 : 0) + (this.cursors?.down.isDown || this.keys.S.isDown ? 1 : 0);
    const moving = horizontal !== 0 || vertical !== 0;
    if (moving) {
      const length = Math.hypot(horizontal, vertical) || 1;
      this.movePlayer(horizontal / length, vertical / length, delta * 0.2);
      if (this.playerSprite) this.playerSprite.y = -Math.abs(Math.sin(time * 0.017)) * 3;
    } else if (this.playerSprite) {
      this.playerSprite.y = Phaser.Math.Linear(this.playerSprite.y, 0, 0.18);
    }

    const ready = this.publishReadiness();
    if (ready && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.broadcastPosition();
      this.game.events.emit(OPEN_EVENT, this.currentModel.sceneId);
    }

    if (time - this.lastPositionBroadcast > 120) {
      this.lastPositionBroadcast = time;
      const landmark = this.nearestLandmark();
      if (landmark !== this.lastLandmark || this.lastBroadcastPosition?.x !== this.player.x || this.lastBroadcastPosition?.y !== this.player.y) this.broadcastPosition();
    }
  }
}

function ChoiceIcon({ choice }: { choice: OriginStoryChoice }) {
  const Icon = pathMeta[choice.path].icon;
  return <Icon size={18} />;
}

function VillageMoveButton({ label, onMove, onStop, children }: { label: string; onMove: () => void; onStop: () => void; children: ReactNode }) {
  const held = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => { clearInterval(held.current); held.current = undefined; onStop(); };
  useEffect(() => () => clearInterval(held.current), []);
  return <button aria-label={label} onPointerDown={(event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearInterval(held.current);
    onMove();
    held.current = setInterval(onMove, 100);
  }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
    onClick={(event) => { if (event.detail === 0) { onMove(); onStop(); } }}>{children}</button>;
}

export function VillageAdventure({ profile, onChoose, onAdvance, onExit, onMove, onStartRescue, onRescueReturn }: VillageAdventureProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onMoveRef = useRef(onMove);
  const lastSavedPosition = useRef(0);
  const latestPosition = useRef<VillagePosition>({ x: profile.world.village.playerX, y: profile.world.village.playerY });
  const pendingPositionSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scene = getOriginStoryScene(profile.originStory.currentSceneId);
  const rescue = getVillageRescue(profile);
  const returning = rescue?.phase === 'return' || rescue?.phase === 'complete';
  const interactionId = returning ? `${scene.id}:return` : scene.id;
  const interaction = useMemo(() => returning ? {
    ...getVillageInteraction(scene), x: villageRescueReturnPoint.x, y: villageRescueReturnPoint.y,
    objective: '공동회관 앞 카즈린에게 돌아가 구출 결과를 확인한다',
    landmark: '마을 공동회관 앞', prompt: '카즈린과 무사 귀환을 확인한다',
  } : getVillageInteraction(scene), [returning, scene]);
  const selectedChoiceId = profile.originStory.choices[scene.id];
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId);
  const [readiness, setReadiness] = useState<VillageReadiness>();
  const [dialogueSceneId, setDialogueSceneId] = useState<string | null>(null);
  const nearTarget = isVillageTargetReady(interactionId, readiness);
  const dialogueOpen = dialogueSceneId === interactionId;
  const [playerPosition, setPlayerPosition] = useState<VillagePosition>({
    x: profile.world.village.playerX,
    y: profile.world.village.playerY,
  });
  const progress = Math.min(100, (scene.sequence / 5) * 100);
  const memory = profile.world.npcMemories[scene.speakerId];

  const model = useMemo<VillageModel>(() => ({
    sceneId: interactionId,
    targetX: interaction.x,
    targetY: interaction.y,
    targetName: scene.speakerName,
    targetSprite: interaction.targetSprite,
    targetTexture: `target-${scene.id}`,
    landmark: interaction.landmark,
    playerX: profile.world.village.playerX,
    playerY: profile.world.village.playerY,
    ambience: interaction.ambience,
    inputLocked: dialogueOpen,
  }), [interactionId, interaction, profile.world.village.playerX, profile.world.village.playerY, scene.id, scene.speakerName, dialogueOpen]);
  const initialModelRef = useRef(model);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const flushPosition = useCallback(() => {
    clearTimeout(pendingPositionSave.current);
    pendingPositionSave.current = undefined;
    lastSavedPosition.current = Date.now();
    const position = latestPosition.current;
    onMoveRef.current?.(position.x, position.y, position.landmark);
  }, []);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    bootVillageModel = initialModelRef.current;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: hostRef.current,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#11140f',
      transparent: false,
      fps: { target: 60, forceSetTimeOut: true },
      scene: [FrontierVillageScene],
      render: { antialias: true, pixelArt: false, clearBeforeRender: true, roundPixels: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { keyboard: true, mouse: true, touch: true },
      callbacks: {
        preBoot: (bootingGame) => bootingGame.registry.set('village-model', initialModelRef.current),
      },
    });
    const stopRuntimeStabilizer = stabilizePhaserRuntime(game, 'FrontierVillageScene');
    const handlePosition = (position: VillagePosition) => {
      setPlayerPosition(position);
      latestPosition.current = position;
      const now = Date.now();
      if (now - lastSavedPosition.current > 700) {
        flushPosition();
      } else if (!pendingPositionSave.current) {
        pendingPositionSave.current = setTimeout(flushPosition, 700 - (now - lastSavedPosition.current));
      }
    };
    const handleOpen = (sceneId: string) => { flushPosition(); setDialogueSceneId(sceneId); };
    game.events.on(READY_EVENT, setReadiness);
    game.events.on(OPEN_EVENT, handleOpen);
    game.events.on(POSITION_EVENT, handlePosition);
    gameRef.current = game;
    return () => {
      game.events.off(READY_EVENT, setReadiness);
      game.events.off(OPEN_EVENT, handleOpen);
      game.events.off(POSITION_EVENT, handlePosition);
      stopRuntimeStabilizer();
      game.destroy(true);
      gameRef.current = null;
      bootVillageModel = null;
      clearTimeout(pendingPositionSave.current);
      pendingPositionSave.current = undefined;
    };
  }, [flushPosition]);

  useEffect(() => {
    gameRef.current?.registry.set('village-model', model);
    gameRef.current?.events.emit(MODEL_EVENT, model);
  }, [model]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialogueOpen) setDialogueSceneId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dialogueOpen]);

  const move = (x: number, y: number) => gameRef.current?.events.emit(MOVE_EVENT, { x, y });
  const saveCurrentPosition = () => { gameRef.current?.events.emit(SYNC_POSITION_EVENT); flushPosition(); };
  const mapStyle = {
    '--village-player-x': `${(playerPosition.x / WIDTH) * 100}%`,
    '--village-player-y': `${(playerPosition.y / HEIGHT) * 100}%`,
    '--village-target-x': `${(interaction.x / WIDTH) * 100}%`,
    '--village-target-y': `${(interaction.y / HEIGHT) * 100}%`,
  } as CSSProperties;

  return (
    <main className={`village-adventure ambience-${interaction.ambience}`} style={{ backgroundImage: `linear-gradient(180deg, rgba(4, 8, 5, .34), rgba(3, 5, 4, .76)), url(${villageMapAssets[interaction.ambience]})` }}>
      <div className="village-engine" ref={hostRef} />
      <div className="village-vignette" aria-hidden="true" />
      <div className="village-film-grain" aria-hidden="true" />

      <header className="village-hud-top">
        <button onClick={() => { saveCurrentPosition(); onExit(); }}><ArrowLeft size={16} /> 타이틀</button>
        <div><span>RAON'S ORIGIN · PLAYABLE PROLOGUE</span><strong>이름 없는 변방 마을</strong></div>
        <div className="village-clock"><span>A.S. 84 · 초여름</span><strong>{ambienceLabels[interaction.ambience]}</strong></div>
      </header>

      <aside className="village-objective-card">
        <span><Compass size={15} /> 현재 목표</span>
        <strong>{interaction.objective}</strong>
        <p><MapPin size={13} /> {interaction.landmark}</p>
        <i><b style={{ width: `${progress}%` }} /></i>
        <small>마을 서막 {scene.sequence} / 5</small>
        {returning && <p className="village-return-status">아이 안전 확보 · 카즈린이 공동회관 앞에서 기다립니다.</p>}
      </aside>

      <aside className="village-controls-card">
        <span><Footprints size={15} /> 직접 이동</span>
        <p><kbd>WASD</kbd><kbd>방향키</kbd> 이동</p>
        <p><kbd>E</kbd> 대화 · <kbd>ESC</kbd> 닫기</p>
      </aside>

      <aside className="village-minimap" style={mapStyle}>
        <div><span><LocateFixed size={13} /> 마을 지도</span><strong>{playerPosition.landmark ?? '중앙 길목'}</strong></div>
        <figure>
          <img src={villageMinimapAsset} alt="이름 없는 변방 마을 미니맵" />
          <i className="village-minimap-target" aria-label="목표 위치" />
          <i className="village-minimap-player" aria-label="현재 위치" />
        </figure>
      </aside>

      <div className="village-location-ribbon"><MapPin size={13} /><span>{playerPosition.landmark ?? '밀밭 사이 중앙 길목'}</span></div>

      <div className="village-mobile-controls" aria-label="모바일 이동 조작">
        <VillageMoveButton onMove={() => move(0, -1)} onStop={flushPosition} label="위로 이동"><ArrowUp /></VillageMoveButton>
        <VillageMoveButton onMove={() => move(-1, 0)} onStop={flushPosition} label="왼쪽으로 이동"><ArrowLeft /></VillageMoveButton>
        <VillageMoveButton onMove={() => move(0, 1)} onStop={flushPosition} label="아래로 이동"><ArrowDown /></VillageMoveButton>
        <VillageMoveButton onMove={() => move(1, 0)} onStop={flushPosition} label="오른쪽으로 이동"><ArrowRight /></VillageMoveButton>
      </div>

      {nearTarget && !dialogueOpen && (
        <button className="village-interact-prompt" onClick={() => { saveCurrentPosition(); setDialogueSceneId(interactionId); }}>
          <kbd>E</kbd><span><small>{scene.speakerRole}</small><strong>{interaction.prompt}</strong></span>
        </button>
      )}

      {dialogueOpen && (
        <section className="village-dialogue-layer" style={{ '--speaker-accent': scene.speakerId === 'kain' ? '#9b7358' : '#d4c5a0' } as CSSProperties}>
          <button className="village-dialogue-backdrop" aria-label="대화 닫기" onClick={() => setDialogueSceneId(null)} />
          <article className="village-dialogue-panel" role="dialog" aria-modal="true" aria-label={returning ? '수로에서 돌아온 뒤' : scene.title}>
            <div className="village-speaker-visual">
              <img src={scene.speakerArt} alt={`${scene.speakerName} 설정화`} />
              <div><span>{scene.speakerRole}</span><strong>{scene.speakerName}</strong><small>기억 친밀도 {memory?.affinity ?? 0}</small></div>
            </div>
            <div className="village-dialogue-copy">
              {returning && rescue ? <>
                <div className="village-scene-meta"><span>서장 · 수로에서 돌아온 뒤</span><strong>함께 돌아온 사람들</strong></div>
                <p className="village-narration">아이는 수로를 빠져나왔다. 라온은 마을 길을 되짚어 카즈린 앞에 섰다.</p>
                <blockquote>“{villageRescueApproaches[rescue.choiceId].response}”</blockquote>
                <div className="village-choice-result">
                  <ShieldCheck size={18} /><div><small>{rescue.phase === 'complete' ? '귀환 확인 완료' : '무사 귀환'}</small><strong>{rescue.phase === 'complete' ? selectedChoice?.result : '아이의 안전과 라온의 귀환을 카즈린과 확인한다.'}</strong></div>
                  <button onClick={() => {
                    flushPosition();
                    if (rescue.phase === 'return') onRescueReturn();
                    else { onAdvance(); setDialogueSceneId(null); }
                  }}>{rescue.phase === 'return' ? '무사 귀환 확인' : '일주일 뒤 · 선발 공고일'} <ArrowRight size={17} /></button>
                </div>
                {rescue.phase === 'complete' && <p className="village-narration">카즈린은 수로에서 라온이 택한 방법을 기억한다. 며칠이 지나, 마을에 선발 공고가 붙는다.</p>}
              </> : <>
              <div className="village-scene-meta"><span>{scene.chapter}</span><strong>{scene.title}</strong></div>
              <p className="village-scene-time">{scene.time}</p>
              <p className="village-narration">{scene.narration[0]}</p>
              <blockquote>“{scene.dialogue}”</blockquote>
              <div className="village-raon-thought"><Sparkles size={15} /><span>라온</span><p>“{scene.monologue}”</p></div>
              <h2>{scene.question}</h2>
              <div className="village-choice-list">
                {scene.choices.map((choice, index) => {
                  const chosen = selectedChoiceId === choice.id;
                  return (
                    <button key={choice.id} className={`${choice.path} ${chosen ? 'selected' : ''}`} onClick={() => !selectedChoice && onChoose(scene.id, choice.id)} disabled={Boolean(selectedChoice) && !chosen}>
                      <span>{index + 1}</span><ChoiceIcon choice={choice} /><div><small>{pathMeta[choice.path].label}</small><strong>{choice.title}</strong><em>“{choice.line}”</em></div>{chosen && <ShieldCheck size={18} />}
                    </button>
                  );
                })}
              </div>
              {selectedChoice && (
                <div className="village-choice-result">
                  <BookOpenText size={18} /><div><small>{rescue?.phase === 'ready' ? '라온이 정한 구출 방법' : '세계가 기억한 선택'}</small><strong>{rescue?.phase === 'ready' ? `${selectedChoice.title}. 이제 아이와 함께 수로를 빠져나가야 한다.` : selectedChoice.result}</strong></div>
                  <button onClick={() => { flushPosition(); if (rescue?.phase === 'ready') onStartRescue(); else onAdvance(); setDialogueSceneId(null); }}>{rescue?.phase === 'ready' ? '수로 구출 시작' : scene.nextSceneId ? '다음 목표' : '여정 계속'} <ArrowRight size={17} /></button>
                </div>
              )}
              </>}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
