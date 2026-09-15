import { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getEnemyMaximumHp, getSkillDamagePreview, type EnemyIntent, type ThreatForecast } from '../game/battleEngine';
import type { BattleState, HeroDefinition, MissionDefinition, MissionDifficulty } from '../types';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const MODEL_EVENT = 'raonjena:battle-model';
const HERO_EVENT = 'raonjena:hero-select';
const ENEMY_EVENT = 'raonjena:enemy-select';

interface DamagePreviewView {
  damage: number;
  focusLevel: number;
  willBreak: boolean;
}

interface HeroView {
  id: string;
  name: string;
  art: string;
  accent: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  incoming: number;
  acted: boolean;
  selected: boolean;
  focusOrder: number;
}

interface EnemyView {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  revealed: boolean;
  stunned: boolean;
  boss: boolean;
  focused: boolean;
  recommended: boolean;
  intent?: EnemyIntent;
  preview?: DamagePreviewView;
}

interface TacticalBattleModel {
  missionTitle: string;
  background: string;
  round: number;
  objective: {
    label: string;
    hp: number;
    maxHp: number;
    shield: number;
    incoming: number;
  };
  heroes: HeroView[];
  enemies: EnemyView[];
  focusTargetId?: string;
  focusCount: number;
  breakCount: number;
}

interface PhaserBattlefieldProps {
  battle: BattleState;
  mission: MissionDefinition;
  heroes: HeroDefinition[];
  difficulty: MissionDifficulty;
  selectedHeroId: string;
  selectedSkillId: string;
  enemyIntents: EnemyIntent[];
  threatForecast: ThreatForecast;
  objectiveMaximum: number;
  recommendationTargetId?: string;
  onHeroSelect: (heroId: string) => void;
  onEnemySelect: (enemyId: string) => void;
  onOpenCommands: () => void;
}

function toCoordinate(percent: number, total: number) {
  return (percent / 100) * total;
}

function colorFromHex(value: string, fallback: number) {
  const normalized = value.replace('#', '');
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildBattleModel({
  battle,
  mission,
  heroes,
  difficulty,
  selectedHeroId,
  selectedSkillId,
  enemyIntents,
  threatForecast,
  objectiveMaximum,
  recommendationTargetId,
}: Omit<PhaserBattlefieldProps, 'onHeroSelect' | 'onEnemySelect' | 'onOpenCommands'>): TacticalBattleModel {
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId);
  const selectedSkill = selectedHero?.skills.find((skill) => skill.id === selectedSkillId);

  return {
    missionTitle: mission.title,
    background: mission.background,
    round: battle.round,
    objective: {
      label: mission.objectiveLabel,
      hp: battle.carriageHp,
      maxHp: objectiveMaximum,
      shield: battle.carriageShield,
      incoming: Math.max(0, threatForecast.objectiveDamage - battle.carriageShield),
    },
    heroes: heroes.flatMap((hero) => {
      const state = battle.heroes.find((entry) => entry.id === hero.id);
      if (!state || state.hp <= 0) return [];
      return [{
        id: hero.id,
        name: hero.name,
        art: hero.art,
        accent: hero.accent,
        x: toCoordinate(hero.position.x, VIEW_WIDTH),
        y: toCoordinate(hero.position.y, VIEW_HEIGHT),
        hp: state.hp,
        maxHp: hero.maxHp,
        shield: state.shield,
        incoming: threatForecast.heroDamage[hero.id] ?? 0,
        acted: state.acted,
        selected: hero.id === selectedHeroId,
        focusOrder: battle.focusChain.indexOf(hero.id) + 1,
      }];
    }),
    enemies: mission.enemies.flatMap((enemy) => {
      const state = battle.enemies.find((entry) => entry.id === enemy.id);
      if (!state || state.hp <= 0) return [];
      const preview = selectedSkill?.target === 'enemy'
        ? getSkillDamagePreview(battle, mission, heroes, selectedHeroId, selectedSkill.id, enemy.id)
        : null;
      return [{
        id: enemy.id,
        name: enemy.name,
        x: toCoordinate(enemy.position.x, VIEW_WIDTH),
        y: toCoordinate(enemy.position.y, VIEW_HEIGHT),
        hp: state.hp,
        maxHp: getEnemyMaximumHp(enemy.maxHp, difficulty),
        revealed: state.revealed,
        stunned: state.stunned > 0,
        boss: Boolean(enemy.boss),
        focused: battle.focusTargetId === enemy.id,
        recommended: recommendationTargetId === enemy.id,
        intent: enemyIntents.find((intent) => intent.enemyId === enemy.id),
        preview: preview ? {
          damage: preview.damage,
          focusLevel: preview.focus.level,
          willBreak: preview.focus.breakTriggered,
        } : undefined,
      }];
    }),
    focusTargetId: battle.focusTargetId,
    focusCount: battle.focusChain.length,
    breakCount: battle.breakCount,
  };
}

class TacticalBattleScene extends Phaser.Scene {
  private model!: TacticalBattleModel;
  private background?: Phaser.GameObjects.Image;
  private dynamicLayer?: Phaser.GameObjects.Container;
  private rotatingRings: Phaser.GameObjects.Arc[] = [];
  private pulseObjects: Phaser.GameObjects.Arc[] = [];
  private previousHp = new Map<string, number>();

  constructor() {
    super({ key: 'TacticalBattleScene' });
  }

  preload() {
    const model = this.game.registry.get('battle-model') as TacticalBattleModel;
    this.load.image('battle-background', model.background);
    model.heroes.forEach((hero) => this.load.image(`hero-${hero.id}`, hero.art));
  }

  create() {
    this.cameras.main.setBackgroundColor('#08090b');
    this.background = this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 'battle-background');
    const source = this.textures.get('battle-background').getSourceImage() as HTMLImageElement;
    const scale = Math.max(VIEW_WIDTH / source.width, VIEW_HEIGHT / source.height);
    this.background.setScale(scale * 1.04).setAlpha(0.72);

    const atmosphere = this.add.graphics();
    atmosphere.fillStyle(0x050608, 0.38).fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    atmosphere.fillGradientStyle(0x08090b, 0x08090b, 0x020304, 0x020304, 0.12, 0.12, 0.86, 0.86);
    atmosphere.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const grid = this.add.graphics().setAlpha(0.13);
    grid.lineStyle(1, 0xd6bb7d, 0.34);
    for (let x = 0; x <= VIEW_WIDTH; x += 80) grid.lineBetween(x, 0, x, VIEW_HEIGHT);
    for (let y = 0; y <= VIEW_HEIGHT; y += 72) grid.lineBetween(0, y, VIEW_WIDTH, y);

    this.dynamicLayer = this.add.container(0, 0);
    this.game.events.on(MODEL_EVENT, this.syncModel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(MODEL_EVENT, this.syncModel, this);
    });
    this.syncModel(this.game.registry.get('battle-model') as TacticalBattleModel, true);
  }

  update(time: number) {
    if (this.background) this.background.x = VIEW_WIDTH / 2 + Math.sin(time / 9000) * 8;
    this.rotatingRings.forEach((ring, index) => {
      ring.rotation += 0.0035 + index * 0.0007;
    });
    this.pulseObjects.forEach((object, index) => {
      object.setAlpha(0.58 + Math.sin(time / 310 + index) * 0.24);
    });
  }

  private syncModel(model: TacticalBattleModel, initial = false) {
    const damageEvents: Array<{ x: number; y: number; amount: number }> = [];
    [...model.heroes, ...model.enemies].forEach((unit) => {
      const previous = this.previousHp.get(unit.id);
      if (previous !== undefined && previous > unit.hp) {
        damageEvents.push({ x: unit.x, y: unit.y, amount: previous - unit.hp });
      }
      this.previousHp.set(unit.id, unit.hp);
    });
    const previousObjective = this.previousHp.get('objective');
    if (previousObjective !== undefined && previousObjective > model.objective.hp) {
      damageEvents.push({ x: 180, y: 245, amount: previousObjective - model.objective.hp });
    }
    this.previousHp.set('objective', model.objective.hp);

    this.model = model;
    this.dynamicLayer?.removeAll(true);
    this.rotatingRings = [];
    this.pulseObjects = [];
    this.drawFocusLinks();
    this.drawObjective();
    model.heroes.forEach((hero, index) => this.drawHero(hero, index));
    model.enemies.forEach((enemy, index) => this.drawEnemy(enemy, index));
    this.drawBattleStatus();

    if (!initial && damageEvents.length > 0) {
      this.cameras.main.shake(150, 0.0045);
      damageEvents.forEach((event, index) => this.floatDamage(event.x, event.y, event.amount, index));
    }
  }

  private drawFocusLinks() {
    if (!this.dynamicLayer || !this.model.focusTargetId) return;
    const target = this.model.enemies.find((enemy) => enemy.id === this.model.focusTargetId);
    if (!target) return;
    const graphics = this.add.graphics();
    this.model.heroes
      .filter((hero) => hero.focusOrder > 0)
      .sort((left, right) => left.focusOrder - right.focusOrder)
      .forEach((hero, index) => {
        graphics.lineStyle(2 + index, 0xd3b56f, 0.34 + index * 0.16);
        graphics.beginPath();
        graphics.moveTo(hero.x, hero.y);
        graphics.lineTo(target.x, target.y);
        graphics.strokePath();
      });
    this.dynamicLayer.add(graphics);
  }

  private drawObjective() {
    if (!this.dynamicLayer) return;
    const objective = this.model.objective;
    const container = this.add.container(175, 238);
    const plate = this.add.rectangle(0, 0, 245, 84, 0x090b0d, 0.9).setStrokeStyle(1, 0xc5a761, 0.78);
    const emblem = this.add.polygon(-112, 0, [-14, 0, 0, -14, 14, 0, 0, 14], 0x17191c, 1).setStrokeStyle(2, 0xe1c375, 1);
    const shield = this.add.text(-112, -8, '◆', { fontSize: '17px', color: '#e1c375' }).setOrigin(0.5, 0);
    const label = this.add.text(-88, -28, objective.label, { fontFamily: 'Noto Serif KR', fontSize: '15px', color: '#efe8d8' });
    const hpText = this.add.text(105, -28, `${objective.hp}${objective.shield > 0 ? ` +${objective.shield}` : ''}`, { fontFamily: 'Cinzel', fontSize: '13px', color: '#d8be7a' }).setOrigin(1, 0);
    const barBack = this.add.rectangle(-88, 12, 190, 7, 0x2a2b2e, 1).setOrigin(0, 0.5);
    const bar = this.add.rectangle(-88, 12, 190 * Math.max(0, objective.hp / objective.maxHp), 7, 0xb99a52, 1).setOrigin(0, 0.5);
    const incoming = objective.incoming > 0
      ? this.add.text(-88, 26, `▼ 적 행동 예고  -${objective.incoming}`, { fontSize: '11px', color: '#e27a72' })
      : this.add.text(-88, 26, '방어선 안정', { fontSize: '11px', color: '#8fac9a' });
    container.add([plate, emblem, shield, label, hpText, barBack, bar, incoming]);
    this.dynamicLayer.add(container);
  }

  private drawHero(hero: HeroView, index: number) {
    if (!this.dynamicLayer) return;
    const accent = colorFromHex(hero.accent, 0xd4b365);
    const container = this.add.container(hero.x, hero.y + 8).setAlpha(0);
    const selection = this.add.circle(0, 0, 48, accent, hero.selected ? 0.14 : 0.03).setStrokeStyle(hero.selected ? 3 : 1, accent, hero.selected ? 1 : 0.45);
    const portraitBack = this.add.rectangle(0, -7, 58, 68, 0x101216, 0.96).setStrokeStyle(2, hero.acted ? 0x4f5155 : accent, 0.9);
    const portrait = this.add.image(0, -7, `hero-${hero.id}`);
    const texture = this.textures.get(`hero-${hero.id}`).getSourceImage() as HTMLImageElement;
    portrait.setCrop(texture.width * 0.12, texture.height * 0.06, texture.width * 0.42, texture.height * 0.45).setDisplaySize(54, 64);
    if (hero.acted) portrait.setTint(0x5f6165).setAlpha(0.55);
    const namePlate = this.add.rectangle(0, 37, 74, 22, 0x090a0c, 0.92).setStrokeStyle(1, accent, 0.45);
    const name = this.add.text(0, 36, hero.name, { fontFamily: 'Noto Serif KR', fontSize: '13px', color: '#f1ebdf' }).setOrigin(0.5);
    const hpBack = this.add.rectangle(-34, 54, 68, 5, 0x2a2b2f, 1).setOrigin(0, 0.5);
    const hp = this.add.rectangle(-34, 54, 68 * Math.max(0, hero.hp / hero.maxHp), 5, accent, 1).setOrigin(0, 0.5);
    container.add([selection, portraitBack, portrait, namePlate, name, hpBack, hp]);

    if (hero.focusOrder > 0) {
      const order = this.add.circle(31, -36, 12, 0x15120b, 1).setStrokeStyle(1, 0xe2c16e, 1);
      const orderText = this.add.text(31, -36, String(hero.focusOrder), { fontFamily: 'Cinzel', fontSize: '12px', color: '#f5d77f' }).setOrigin(0.5);
      container.add([order, orderText]);
    }
    if (hero.shield > 0) {
      container.add(this.add.text(0, 62, `방벽 ${hero.shield}`, { fontSize: '10px', color: '#91bad1', backgroundColor: '#0c151b' }).setOrigin(0.5, 0));
    } else if (hero.incoming > 0) {
      container.add(this.add.text(0, 62, `피해 예고 -${hero.incoming}`, { fontSize: '10px', color: '#e68179', backgroundColor: '#1c0d0e' }).setOrigin(0.5, 0));
    }

    // Phaser tests local input coordinates after adding the shape's display origin.
    selection.setInteractive(new Phaser.Geom.Circle(selection.displayOriginX, selection.displayOriginY, 52), Phaser.Geom.Circle.Contains)
      .on('pointerup', () => this.game.events.emit(HERO_EVENT, hero.id))
      .on('pointerover', () => this.tweens.add({ targets: container, scale: 1.08, duration: 100 }))
      .on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 100 }));
    if (hero.selected) this.pulseObjects.push(selection);
    this.dynamicLayer.add(container);
    this.tweens.add({ targets: container, y: hero.y, alpha: hero.acted ? 0.5 : 1, duration: 240, delay: index * 35, ease: 'Cubic.Out' });
  }

  private drawEnemy(enemy: EnemyView, index: number) {
    if (!this.dynamicLayer) return;
    const container = this.add.container(enemy.x, enemy.y + 8).setAlpha(0);
    const dangerColor = enemy.stunned ? 0xe1c16b : enemy.preview?.willBreak ? 0xf0c75e : 0xb95552;
    const ring = this.add.circle(0, 0, enemy.boss ? 45 : 36, 0x2b0d0e, enemy.revealed ? 0.68 : 0.38).setStrokeStyle(enemy.focused ? 3 : 2, dangerColor, enemy.focused ? 1 : 0.76);
    const outer = this.add.arc(0, 0, enemy.boss ? 57 : 46, 12, 78, false, 0x000000, 0).setStrokeStyle(enemy.recommended ? 3 : 1, enemy.recommended ? 0xf0cf78 : dangerColor, enemy.recommended ? 1 : 0.56);
    const glyph = this.add.text(0, 0, enemy.revealed ? (enemy.stunned ? '✕' : '⌖') : '?', {
      fontFamily: 'Cinzel',
      fontSize: enemy.boss ? '30px' : '24px',
      color: enemy.stunned ? '#f1d98d' : '#f1aaa2',
    }).setOrigin(0.5);
    const name = this.add.text(0, enemy.boss ? 52 : 44, enemy.revealed ? enemy.name : '미확인 사선', {
      fontFamily: 'Noto Serif KR', fontSize: enemy.boss ? '14px' : '12px', color: '#f0e7db', backgroundColor: '#0b0a0cdd', padding: { x: 6, y: 3 },
    }).setOrigin(0.5);
    const hpBack = this.add.rectangle(-39, enemy.boss ? 77 : 68, 78, 5, 0x2a2021, 1).setOrigin(0, 0.5);
    const hp = this.add.rectangle(-39, enemy.boss ? 77 : 68, 78 * Math.max(0, enemy.hp / enemy.maxHp), 5, dangerColor, 1).setOrigin(0, 0.5);
    container.add([ring, outer, glyph, name, hpBack, hp]);

    if (enemy.intent) {
      const intentLabel = enemy.intent.type === 'blocked' ? 'BREAK · 행동 봉쇄' : `→ ${enemy.intent.targetLabel} ${enemy.intent.type === 'objective' ? enemy.intent.rawDamage : enemy.intent.damage}`;
      const intent = this.add.text(0, enemy.boss ? -71 : -58, intentLabel, {
        fontSize: '11px', color: enemy.intent.type === 'blocked' ? '#f0d27f' : '#f29a91', backgroundColor: '#1c0d0fee', padding: { x: 5, y: 3 },
      }).setOrigin(0.5);
      container.add(intent);
    }
    if (enemy.preview) {
      const preview = this.add.text(0, enemy.boss ? 88 : 79, enemy.preview.willBreak ? `-${enemy.preview.damage}  BREAK` : `-${enemy.preview.damage}  연계 ${enemy.preview.focusLevel}`, {
        fontFamily: 'Cinzel', fontSize: '11px', color: enemy.preview.willBreak ? '#17130b' : '#f0c6bd', backgroundColor: enemy.preview.willBreak ? '#e6c66f' : '#301416', padding: { x: 5, y: 3 },
      }).setOrigin(0.5);
      container.add(preview);
    }

    ring.setInteractive(new Phaser.Geom.Circle(ring.displayOriginX, ring.displayOriginY, enemy.boss ? 54 : 46), Phaser.Geom.Circle.Contains)
      .on('pointerup', () => {
        this.playCommandTrail(this.model.heroes.find((hero) => hero.selected), enemy);
        this.game.events.emit(ENEMY_EVENT, enemy.id);
      })
      .on('pointerover', () => this.tweens.add({ targets: container, scale: 1.08, duration: 100 }))
      .on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 100 }));
    this.rotatingRings.push(outer);
    if (enemy.recommended || enemy.preview?.willBreak) this.pulseObjects.push(ring);
    this.dynamicLayer.add(container);
    this.tweens.add({ targets: container, y: enemy.y, alpha: enemy.revealed ? 1 : 0.62, duration: 240, delay: index * 42, ease: 'Cubic.Out' });
  }

  private drawBattleStatus() {
    if (!this.dynamicLayer) return;
    const plate = this.add.container(VIEW_WIDTH - 204, VIEW_HEIGHT - 54);
    const background = this.add.rectangle(0, 0, 360, 54, 0x08090b, 0.88).setStrokeStyle(1, 0x9f8b61, 0.42);
    const text = this.add.text(-160, -11, `ROUND ${String(this.model.round).padStart(2, '0')}   ·   연계 ${this.model.focusCount}/3   ·   BREAK ${this.model.breakCount}`, {
      fontFamily: 'Cinzel', fontSize: '14px', color: '#d6c18d',
    });
    const hint = this.add.text(-160, 10, '클릭: 조장 선택 / 적 표적   ·   숫자키: 조장 전환', { fontSize: '10px', color: '#817b71' });
    plate.add([background, text, hint]);
    this.dynamicLayer.add(plate);
  }

  private playCommandTrail(hero: HeroView | undefined, enemy: EnemyView) {
    if (!hero) return;
    const trail = this.add.graphics().setDepth(30);
    trail.lineStyle(5, 0xf0d17d, 0.82).lineBetween(hero.x, hero.y, enemy.x, enemy.y);
    this.tweens.add({ targets: trail, alpha: 0, duration: 260, onComplete: () => trail.destroy() });
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      this.cameras.main.zoomTo(1, 160, Phaser.Math.Easing.Cubic.In, true);
    });
    this.cameras.main.zoomTo(1.018, 90, Phaser.Math.Easing.Cubic.Out, true);
  }

  private floatDamage(x: number, y: number, amount: number, index: number) {
    const text = this.add.text(x, y - 42, `-${amount}`, {
      fontFamily: 'Cinzel', fontSize: '25px', fontStyle: 'bold', color: '#ffe0a1', stroke: '#351515', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: text, y: y - 100 - index * 4, alpha: 0, duration: 720, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }
}

export function PhaserBattlefield(props: PhaserBattlefieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const heroSelectRef = useRef(props.onHeroSelect);
  const enemySelectRef = useRef(props.onEnemySelect);
  const [engineReady, setEngineReady] = useState(false);
  const model = useMemo(() => buildBattleModel(props), [props]);
  const initialModelRef = useRef(model);

  useEffect(() => {
    heroSelectRef.current = props.onHeroSelect;
    enemySelectRef.current = props.onEnemySelect;
  }, [props.onEnemySelect, props.onHeroSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      backgroundColor: '#08090b',
      render: { antialias: true, pixelArt: false, roundPixels: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
      },
      input: { activePointers: 2 },
      scene: TacticalBattleScene,
      banner: false,
    });
    game.registry.set('battle-model', initialModelRef.current);
    const onHero = (heroId: string) => heroSelectRef.current(heroId);
    const onEnemy = (enemyId: string) => enemySelectRef.current(enemyId);
    game.events.on(HERO_EVENT, onHero);
    game.events.on(ENEMY_EVENT, onEnemy);
    game.events.once(Phaser.Core.Events.READY, () => setEngineReady(true));
    gameRef.current = game;
    return () => {
      game.events.off(HERO_EVENT, onHero);
      game.events.off(ENEMY_EVENT, onEnemy);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.registry.set('battle-model', model);
    game.events.emit(MODEL_EVENT, model);
  }, [model]);

  return (
    <div className="phaser-battlefield-shell">
      <div ref={hostRef} className="phaser-battlefield-canvas" aria-hidden="true" />
      <div className="engine-status-badge"><span className={engineReady ? 'online' : ''} /> PHASER TACTICAL ENGINE</div>
      <div className="battlefield-a11y" aria-label={`${props.mission.title} 전장 조작`}>
        {model.heroes.map((hero) => <button key={hero.id} onClick={() => props.onHeroSelect(hero.id)}>{hero.name} 선택</button>)}
        {model.enemies.map((enemy) => <button key={enemy.id} onClick={() => props.onEnemySelect(enemy.id)}>{enemy.revealed ? enemy.name : '숨은 적'} 표적</button>)}
      </div>
      <button className="mobile-command-toggle engine-command-toggle" onClick={props.onOpenCommands}>
        <span><small>전술 명령</small><strong>기술·행동 선택</strong></span>
        <b>›</b>
      </button>
    </div>
  );
}
