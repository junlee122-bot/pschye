import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Phaser from 'phaser';
import { ArrowLeft, Crosshair, Gauge, HeartPulse, RotateCcw, Shield, Sparkles, Swords, Target, UsersRound } from 'lucide-react';
import { battleDifficultyOptions, type BattleDoctrine } from '../game/battleEngine';
import {
  ACTION_ORDER_COOLDOWN_SECONDS, ACTION_ROUND_SECONDS, addActionMorale, advanceActionRounds,
  applyActionCompanion, applyActionFinisher, buildActionBattleResult, createActionBattleModel,
  damageActionObjective, damageActionRaon, getActionAttack, getActionEnemyTarget,
  getActionIncomingDamage, getActionRuleDescription, hitActionEnemy, interruptActionAttack,
  recordActionRevelation, resolveActionOutcome, revealActionEnemy, type ActionBattleModel,
} from '../game/actionBattleRules';
import { raonChoiceMeta } from '../data/story';
import { stabilizePhaserRuntime } from '../game/phaserRuntime';
import type { BattleState, HeroDefinition, MissionDefinition, MissionDifficulty, RaonStoryChoiceId } from '../types';

const WIDTH = 1280;
const HEIGHT = 720;
const SNAPSHOT_EVENT = 'raonjena:action-snapshot';
const COMPLETE_EVENT = 'raonjena:action-complete';
const COMMAND_EVENT = 'raonjena:action-command';

type MoveDirection = 'up' | 'down' | 'left' | 'right';

interface ActionBattleSnapshot {
  hp: number;
  maxHp: number;
  posture: number;
  maxPosture: number;
  focus: number;
  combo: number;
  objectiveHp: number;
  objectiveMaxHp: number;
  objectiveShield: number;
  enemiesRemaining: number;
  totalEnemies: number;
  elapsed: number;
  parryReady: boolean;
  dodgeReady: boolean;
  heavyReady: boolean;
  finisherReady: boolean;
  cooldowns: Record<string, number>;
  status: 'active' | 'victory' | 'defeat';
  prompt: string;
  breaks: number;
  battle: BattleState;
}

let bootActionModel: ActionBattleModel | null = null;

interface EnemyActor {
  id: string;
  name: string;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  telegraph: Phaser.GameObjects.Arc;
  healthBar: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  posture: number;
  maxPosture: number;
  damage: number;
  speed: number;
  attackRange: number;
  ranged: boolean;
  nextAttackAt: number;
  telegraphUntil: number;
  stunnedUntil: number;
  alive: boolean;
}

interface RaonActionBattleProps {
  doctrine: BattleDoctrine;
  difficulty: MissionDifficulty;
  mission: MissionDefinition;
  heroes: HeroDefinition[];
  raonStance: RaonStoryChoiceId;
  warPressure: number;
  bondSupport: number;
  onComplete: (state: BattleState) => void;
  onExit: () => void;
  onSwitchMode: () => void;
}

function createInitialSnapshot(model: ActionBattleModel): ActionBattleSnapshot {
  return {
    hp: model.raon.maxHp,
    maxHp: model.raon.maxHp,
    posture: 100,
    maxPosture: 100,
    focus: model.initialState.morale,
    combo: 0,
    objectiveHp: model.initialState.carriageHp,
    objectiveMaxHp: model.initialState.carriageHp,
    objectiveShield: model.initialState.carriageShield,
    enemiesRemaining: model.initialState.enemies.length,
    totalEnemies: model.initialState.enemies.length,
    elapsed: 0,
    parryReady: true,
    dodgeReady: true,
    heavyReady: true,
    finisherReady: model.initialState.morale >= 100,
    cooldowns: {},
    status: 'active',
    prompt: 'WASD로 움직이고 J로 첫 검격을 연결하십시오.',
    breaks: 0,
    battle: model.initialState,
  };
}

class RaonActionScene extends Phaser.Scene {
  private model!: ActionBattleModel;
  private combat!: BattleState;
  private player!: Phaser.GameObjects.Container;
  private playerCore!: Phaser.GameObjects.Arc;
  private objective!: Phaser.GameObjects.Container;
  private objectiveCore!: Phaser.GameObjects.Arc;
  private enemies: EnemyActor[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private get hp() { return this.combat.heroes.find((hero) => hero.id === 'raon')?.hp ?? 0; }
  private get maxHp() { return this.model.raon.maxHp; }
  private posture = 100;
  private maxPosture = 100;
  private get focus() { return this.combat.morale; }
  private set focus(value: number) { this.combat = { ...this.combat, morale: value }; }
  private combo = 0;
  private comboExpires = 0;
  private get objectiveHp() { return this.combat.carriageHp; }
  private get objectiveMaxHp() { return this.model.initialState.carriageHp; }
  private startedAt = 0;
  private lastSnapshotAt = 0;
  private lightReadyAt = 0;
  private heavyReadyAt = 0;
  private parryUntil = 0;
  private parryReadyAt = 0;
  private dodgeUntil = 0;
  private dodgeReadyAt = 0;
  private invulnerableUntil = 0;
  private orderReadyAt: Record<string, number> = {};
  private status: ActionBattleSnapshot['status'] = 'active';
  private prompt = '적의 붉은 예고에 Q로 맞받아치십시오.';
  private facing = new Phaser.Math.Vector2(1, 0);
  private breaks = 0;
  private externalMovement: Record<MoveDirection, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  constructor() {
    super({ key: 'RaonActionScene' });
  }

  create() {
    const registryModel = this.game.registry.get('action-model') as ActionBattleModel | undefined;
    const initialModel = registryModel ?? bootActionModel;
    if (!initialModel) throw new Error('Action scene created without a combat model.');
    this.model = initialModel;
    this.combat = this.model.initialState;
    this.startedAt = this.time.now;

    const shade = this.add.graphics();
    shade.fillGradientStyle(0x20252c, 0x20252c, 0x07090d, 0x07090d, 1, 1, 1, 1).fillRect(0, 0, WIDTH, HEIGHT);

    const arena = this.add.graphics();
    arena.lineStyle(2, 0xc9a968, 0.15).strokeRoundedRect(42, 74, WIDTH - 84, HEIGHT - 118, 54);
    arena.lineStyle(1, 0xc9a968, 0.08);
    for (let x = 100; x < WIDTH; x += 100) arena.lineBetween(x, 90, x, HEIGHT - 55);
    for (let y = 130; y < HEIGHT; y += 90) arena.lineBetween(50, y, WIDTH - 50, y);

    this.objective = this.createObjective();
    this.player = this.createPlayer();
    this.createEnemies();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,J,K,Q,F,SHIFT,ONE,TWO,THREE,FOUR,FIVE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.status !== 'active') return;
      if (pointer.rightButtonDown()) this.heavyAttack(this.time.now);
      else this.lightAttack(this.time.now);
    });
    this.game.events.on(COMMAND_EVENT, this.handleExternalCommand, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(COMMAND_EVENT, this.handleExternalCommand, this);
    });
    this.emitSnapshot(true);
  }

  private createPlayer() {
    const container = this.add.container(330, 365).setDepth(30);
    const shadow = this.add.ellipse(0, 22, 54, 18, 0x000000, 0.45);
    const focusRing = this.add.circle(0, 0, 27, 0xc58e4d, 0.08).setStrokeStyle(2, 0xf3d28d, 0.52);
    const cape = this.add.triangle(-6, 9, -18, 28, 2, -24, 24, 26, 0x1f2938, 1).setStrokeStyle(2, 0xc68f4d, 0.7);
    this.playerCore = this.add.circle(0, -2, 17, 0x8b5b37, 1).setStrokeStyle(3, 0xffdf9f, 1);
    const blade = this.add.rectangle(27, -3, 5, 55, 0xe5e0d5, 1).setRotation(0.82);
    const name = this.add.text(0, -39, '라온', { fontFamily: 'Noto Sans KR', fontSize: '15px', color: '#ffe6aa', backgroundColor: '#11131bdd', padding: { x: 8, y: 3 } }).setOrigin(0.5);
    container.add([shadow, focusRing, cape, blade, this.playerCore, name]);
    this.tweens.add({ targets: focusRing, scale: { from: 0.9, to: 1.15 }, alpha: { from: 0.28, to: 0.7 }, yoyo: true, repeat: -1, duration: 1100 });
    return container;
  }

  private createObjective() {
    const container = this.add.container(128, 360).setDepth(12);
    const ring = this.add.circle(0, 0, 62, 0x6e8d9c, 0.08).setStrokeStyle(3, 0x9fc4d1, 0.42);
    this.objectiveCore = this.add.circle(0, 0, 32, 0x8fb8c5, 0.5).setStrokeStyle(3, 0xd9eef2, 0.72);
    const rune = this.add.text(0, 0, 'VII', { fontFamily: 'Cinzel', fontSize: '20px', color: '#edf8f7' }).setOrigin(0.5);
    const label = this.add.text(0, 83, this.model.mission.objectiveLabel, { fontFamily: 'Noto Sans KR', fontSize: '13px', color: '#cfe2e5', backgroundColor: '#10161add', padding: { x: 8, y: 4 } }).setOrigin(0.5);
    container.add([ring, this.objectiveCore, rune, label]);
    this.tweens.add({ targets: ring, angle: 360, repeat: -1, duration: 8000 });
    return container;
  }

  private createEnemies() {
    this.enemies = this.model.mission.enemies.map((definition, index) => {
      const x = 790 + (index % 2) * 210 + Math.floor(index / 2) * 50;
      const y = 185 + index * 105;
      const ranged = /sniper|rifle|gunner|observer|battery|purger|감시|저격|소총|포대|관측/.test(`${definition.id} ${definition.name}`.toLowerCase());
      const boss = Boolean(definition.boss);
      const elite = Boolean(definition.elite);
      const maxHp = this.combat.enemies.find((enemy) => enemy.id === definition.id)!.hp;
      const readHp = () => this.combat.enemies.find((enemy) => enemy.id === definition.id)?.hp ?? 0;
      const container = this.add.container(x, Math.min(610, y)).setDepth(20);
      const shadow = this.add.ellipse(0, 20, boss ? 70 : 52, 17, 0x000000, 0.46);
      const telegraph = this.add.circle(0, 0, boss ? 43 : 34, 0xa93d38, 0.03).setStrokeStyle(3, 0xf06b5e, 0.05);
      const body = this.add.circle(0, 0, boss ? 25 : 19, definition.hidden ? 0x4e5560 : elite ? 0x7a3e3a : 0x5c4742, 1).setStrokeStyle(3, boss ? 0xffb274 : 0xd88a73, 0.8);
      const weapon = this.add.rectangle(ranged ? -25 : 24, 3, ranged ? 42 : 7, ranged ? 6 : 43, 0xc6b394, 1).setRotation(ranged ? -0.1 : 0.72);
      const label = this.add.text(0, -39, definition.name, { fontFamily: 'Noto Sans KR', fontSize: boss ? '15px' : '12px', color: '#f5d4c7', backgroundColor: '#170c0ddd', padding: { x: 6, y: 3 } }).setOrigin(0.5);
      const barBack = this.add.rectangle(0, 35, boss ? 92 : 68, 7, 0x180d0d, 0.92);
      const healthBar = this.add.rectangle(-(boss ? 46 : 34), 35, boss ? 92 : 68, 5, boss ? 0xe99a55 : 0xb95950, 1).setOrigin(0, 0.5);
      container.add([shadow, telegraph, weapon, body, label, barBack, healthBar]);
      return {
        id: definition.id,
        name: definition.name,
        container,
        body,
        telegraph,
        healthBar,
        get hp() { return readHp(); },
        maxHp,
        posture: elite ? 72 : 48,
        maxPosture: elite ? 72 : 48,
        damage: getActionIncomingDamage(this.model, definition.id),
        speed: ranged ? 36 : boss ? 52 : 64,
        attackRange: ranged ? 455 : boss ? 125 : 94,
        ranged,
        nextAttackAt: this.time.now + 2800 + index * 380,
        telegraphUntil: 0,
        stunnedUntil: 0,
        alive: true,
      } satisfies EnemyActor;
    });
  }

  private handleExternalCommand(command: string) {
    if (this.status !== 'active') return;
    const now = this.time.now;
    const movement = command.match(/^move-(up|down|left|right)-(start|stop)$/);
    if (movement) {
      const direction = movement[1] as MoveDirection;
      this.externalMovement[direction] = movement[2] === 'start';
      return;
    }
    if (command === 'light') this.lightAttack(now);
    if (command === 'heavy') this.heavyAttack(now);
    if (command === 'parry') this.startParry(now);
    if (command === 'dodge') this.startDodge(now);
    if (command === 'finisher') this.teamFinisher(now);
    if (command.startsWith('companion:')) this.companionOrder(command.slice('companion:'.length), now);
  }

  private livingEnemies() {
    return this.enemies.filter((enemy) => enemy.alive);
  }

  private nearestEnemy(range = Number.POSITIVE_INFINITY) {
    return this.livingEnemies()
      .filter((enemy) => this.combat.enemies.find((unit) => unit.id === enemy.id)?.revealed)
      .map((enemy) => ({ enemy, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.container.x, enemy.container.y) }))
      .filter((entry) => entry.distance <= range)
      .sort((left, right) => left.distance - right.distance)[0]?.enemy;
  }

  private damageEnemy(enemy: EnemyActor, damage: number, postureDamage: number, now: number) {
    if (this.status !== 'active' || !enemy.alive) return;
    const next = hitActionEnemy(this.combat, this.model, enemy.id, damage);
    if (next === this.combat) return;
    this.combat = next;
    this.damageEnemyPosture(enemy, postureDamage, now);
  }

  private damageEnemyPosture(enemy: EnemyActor, postureDamage: number, now: number) {
    enemy.posture = Math.max(0, enemy.posture - postureDamage);
    const width = enemy.body.radius > 22 ? 92 : 68;
    enemy.healthBar.width = width * (enemy.hp / enemy.maxHp);
    this.tweens.add({ targets: enemy.container, x: enemy.container.x + this.facing.x * 18, y: enemy.container.y + this.facing.y * 18, yoyo: true, duration: 90 });
    this.cameras.main.shake(80, 0.0035);
    if (enemy.posture <= 0 && enemy.hp > 0) {
      enemy.posture = enemy.maxPosture;
      this.stunEnemy(enemy, now);
      this.focus = Math.min(100, this.focus + 22);
      this.breaks += 1;
      this.prompt = `${enemy.name} 브레이크! 강공격이나 동료 명령을 연결하십시오.`;
      enemy.body.setStrokeStyle(4, 0xffdd8a, 1);
    }
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.focus = Math.min(100, this.focus + 16);
      this.tweens.add({ targets: enemy.container, alpha: 0, scale: 1.45, duration: 310, onComplete: () => enemy.container.setVisible(false) });
    }
  }

  private stunEnemy(enemy: EnemyActor, now: number, duration = 1700) {
    Object.assign(enemy, interruptActionAttack(enemy, now, duration));
    this.tweens.killTweensOf(enemy.telegraph);
    enemy.telegraph.setScale(1).setAlpha(0.15).setStrokeStyle(3, 0xffd77a, 0.35);
  }

  private lightAttack(now: number) {
    if (this.status !== 'active' || now < this.lightReadyAt) return;
    this.lightReadyAt = now + 310;
    const enemy = this.nearestEnemy(142);
    if (!enemy) {
      this.prompt = '확인된 적에게 접근하십시오. 은폐 적은 첫 사격이나 동료 정찰 후 공격할 수 있습니다.';
      return;
    }
    this.combo = now <= this.comboExpires ? Math.min(12, this.combo + 1) : 1;
    this.comboExpires = now + 1450;
    const attack = getActionAttack(this.model, 'light', this.combo);
    this.damageEnemy(enemy, attack.power, attack.posture, now);
    this.combat = addActionMorale(this.combat, attack.morale);
    this.drawSlash(0xf6dfaa, 0.75);
    this.prompt = this.combo >= 4 ? `${this.combo} 연격 · K로 흐름을 마무리하십시오.` : '다음 검격을 1.4초 안에 연결하면 연격이 강해집니다.';
    this.finishIfNeeded();
  }

  private heavyAttack(now: number) {
    if (this.status !== 'active' || now < this.heavyReadyAt) return;
    this.heavyReadyAt = now + 1850;
    const enemy = this.nearestEnemy(185);
    if (!enemy) {
      this.prompt = '강공격 사거리 안에 확인된 적이 없습니다. 은폐 해제 후 접근하십시오.';
      return;
    }
    this.combo = now <= this.comboExpires ? this.combo + 1 : 1;
    this.comboExpires = now + 1550;
    const attack = getActionAttack(this.model, 'heavy', this.combo);
    this.damageEnemy(enemy, attack.power, attack.posture, now);
    this.combat = addActionMorale(this.combat, attack.morale);
    const revealed = this.combat.revelationTriggered;
    this.combat = recordActionRevelation(this.combat, this.model, 'raon', this.model.heavySkill.id, enemy.id);
    if (!revealed && this.combat.revelationTriggered) this.prompt = this.model.mission.revelation!.line;
    this.drawSlash(0xffb65f, 1.2);
    this.cameras.main.shake(130, 0.007);
    this.finishIfNeeded();
  }

  private drawSlash(color: number, scale: number) {
    const slash = this.add.arc(this.player.x + this.facing.x * 38, this.player.y + this.facing.y * 38, 62 * scale, -70, 72, false, color, 0.14)
      .setStrokeStyle(7, color, 0.86).setRotation(Math.atan2(this.facing.y, this.facing.x)).setDepth(40);
    this.tweens.add({ targets: slash, alpha: 0, scale: 1.4, duration: 190, onComplete: () => slash.destroy() });
  }

  private startParry(now: number) {
    if (this.status !== 'active' || now < this.parryReadyAt) return;
    this.parryUntil = now + 430;
    this.parryReadyAt = now + 1100;
    this.playerCore.setFillStyle(0xe0c078, 1).setStrokeStyle(5, 0xffefbf, 1);
    this.time.delayedCall(440, () => this.playerCore.setFillStyle(0x8b5b37, 1).setStrokeStyle(3, 0xffdf9f, 1));
    this.prompt = '패링 준비 · 적의 공격 판정과 겹치면 자세를 무너뜨립니다.';
  }

  private startDodge(now: number) {
    if (this.status !== 'active' || now < this.dodgeReadyAt) return;
    this.dodgeUntil = now + 260;
    this.invulnerableUntil = now + 340;
    this.dodgeReadyAt = now + 920;
    this.player.setAlpha(0.42);
    this.time.delayedCall(340, () => this.player?.setAlpha(1));
    this.prompt = '회피 무적 0.34초 · 다음 공격의 측면을 잡으십시오.';
  }

  private companionOrder(heroId: string, now: number) {
    if (this.status !== 'active' || now < (this.orderReadyAt[heroId] ?? 0)) return;
    const order = this.model.companions.find((entry) => entry.hero.id === heroId);
    if (!order) return;
    const revelation = this.model.mission.revelation;
    const witness = revelation?.heroId === heroId
      ? this.livingEnemies().find((enemy) => enemy.id === revelation.enemyId && this.combat.enemies.find((unit) => unit.id === enemy.id)?.revealed)
      : undefined;
    const target = order.skill.kind === 'reveal'
      ? this.livingEnemies().find((enemy) => !this.combat.enemies.find((unit) => unit.id === enemy.id)?.revealed) ?? this.nearestEnemy()
      : witness ?? this.nearestEnemy();
    const before = this.combat;
    this.combat = applyActionCompanion(before, this.model, heroId, target?.id);
    if (this.combat === before) {
      this.prompt = `${order.hero.name} 명령 불가 · 생존 상태와 확인된 표적을 확인하십시오.`;
      return;
    }
    this.orderReadyAt[heroId] = now + ACTION_ORDER_COOLDOWN_SECONDS * 1000;
    if (order.skill.kind === 'guard') {
      this.objectiveCore.setFillStyle(0xb9dde5, 0.9);
      this.time.delayedCall(350, () => this.objectiveCore.setFillStyle(0x8fb8c5, 0.5));
      this.prompt = `${order.hero.name} · ${order.skill.name} — 목표 방벽 +${order.skill.power}, 사기 +${order.skill.morale}.`;
    } else {
      this.enemies.forEach((enemy) => {
        const previous = before.enemies.find((unit) => unit.id === enemy.id);
        if (previous && enemy.hp < previous.hp) this.damageEnemyPosture(enemy, order.skill.kind === 'reveal' ? 12 : 20, now);
        const current = this.combat.enemies.find((unit) => unit.id === enemy.id);
        if (current && current.hp > 0 && current.stunned > (previous?.stunned ?? 0)) this.stunEnemy(enemy, now);
      });
      this.prompt = `${order.hero.name} · ${order.skill.name} — ${order.skill.kind === 'reveal' ? '은폐 해제 · 노출 +2' : order.skill.id === 'duel-mark' ? '명중 · 노출 +1' : '명중'} · 사기 +${order.skill.morale}.`;
    }
    if (!before.revelationTriggered && this.combat.revelationTriggered) this.prompt = revelation!.line;
    this.finishIfNeeded();
  }

  private teamFinisher(now: number) {
    if (this.status !== 'active') return;
    const before = this.combat;
    this.combat = applyActionFinisher(before, this.model);
    if (this.combat === before) return;
    this.combo = 0;
    this.enemies.forEach((enemy) => {
      const previous = before.enemies.find((unit) => unit.id === enemy.id);
      if (previous && enemy.hp < previous.hp) this.damageEnemyPosture(enemy, 50, now);
    });
    const flash = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xf6dfa7, 0.42).setDepth(80);
    this.tweens.add({ targets: flash, alpha: 0, duration: 440, onComplete: () => flash.destroy() });
    this.cameras.main.shake(320, 0.012);
    this.prompt = `16꽃잎 연계 · 편성된 생존 동료와 검로를 연결했습니다.${this.model.mission.battlefieldRule.id === 'fractured-truce' ? ' 중립 구역 8 피해.' : ''}`;
    this.finishIfNeeded();
  }

  private resolveEnemyAttack(enemy: EnemyActor, now: number) {
    const targetObjective = getActionEnemyTarget(this.model, this.combat, enemy.id) === 'objective';
    const target = targetObjective ? this.objective : this.player;
    const distance = Phaser.Math.Distance.Between(enemy.container.x, enemy.container.y, target.x, target.y);
    enemy.telegraphUntil = 0;
    enemy.nextAttackAt = now + (enemy.ranged ? 2300 : 1550);
    this.combat = revealActionEnemy(this.combat, enemy.id);
    if (distance > enemy.attackRange + 35) return;

    if (!targetObjective && now <= this.parryUntil) {
      this.stunEnemy(enemy, now, 1250);
      const attack = getActionAttack(this.model, 'parry');
      this.damageEnemy(enemy, attack.power, attack.posture, now);
      this.combat = addActionMorale(this.combat, attack.morale);
      this.prompt = `정확한 패링 · ${enemy.name}의 자세가 크게 무너졌습니다.`;
      return;
    }

    if (!targetObjective && now <= this.invulnerableUntil) {
      enemy.telegraphUntil = 0;
      enemy.nextAttackAt = now + 1100;
      this.focus = Math.min(100, this.focus + 8);
      this.prompt = '완전 회피 · 공격이 빗나간 틈에 반격하십시오.';
      return;
    }

    if (targetObjective) {
      this.combat = damageActionObjective(this.combat, enemy.damage);
      this.objectiveCore.setFillStyle(0xd5675c, 0.9);
      this.time.delayedCall(240, () => this.objectiveCore.setFillStyle(0x8fb8c5, 0.5));
      this.prompt = `${enemy.name}이(가) ${this.model.mission.objectiveLabel}을 공격했습니다. 방벽 명령과 적 제압으로 보호하십시오.`;
    } else {
      const previousHp = this.hp;
      this.combat = damageActionRaon(this.combat, this.model, enemy.damage);
      this.posture = Math.max(0, this.posture - Math.round((previousHp - this.hp) * 1.3));
      this.playerCore.setFillStyle(0xc94e43, 1);
      this.time.delayedCall(180, () => this.playerCore.setFillStyle(0x8b5b37, 1));
      if (this.posture <= 0) {
        this.posture = this.maxPosture * 0.45;
        this.invulnerableUntil = now + 620;
        this.prompt = '라온의 자세가 붕괴했습니다. 거리를 벌려 자세가 회복될 시간을 확보하십시오.';
      }
    }
    enemy.telegraphUntil = 0;
    enemy.nextAttackAt = now + (enemy.ranged ? 2300 : 1550);
    this.cameras.main.shake(120, 0.006);
  }

  private updateEnemies(now: number, delta: number) {
    this.livingEnemies().forEach((enemy) => {
      if (this.status !== 'active') return;
      const unit = this.combat.enemies.find((entry) => entry.id === enemy.id);
      enemy.container.setAlpha(unit?.revealed ? 1 : 0.3);
      if (now < enemy.stunnedUntil) {
        enemy.telegraph.setStrokeStyle(4, 0xffd77a, 0.8).setAlpha(0.65);
        return;
      }
      if (enemy.stunnedUntil > 0) {
        enemy.stunnedUntil = 0;
        enemy.telegraph.setScale(1).setAlpha(0.05);
      }
      if (unit && unit.stunned > 0) this.combat = {
        ...this.combat, enemies: this.combat.enemies.map((entry) => entry.id === enemy.id ? { ...entry, stunned: 0 } : entry),
      };
      enemy.body.setStrokeStyle(3, enemy.maxPosture > 50 ? 0xe7a17e : 0xd88a73, 0.8);
      const target = getActionEnemyTarget(this.model, this.combat, enemy.id) === 'objective' ? this.objective : this.player;
      const dx = target.x - enemy.container.x;
      const dy = target.y - enemy.container.y;
      const distance = Math.hypot(dx, dy) || 1;

      if (!enemy.telegraphUntil && distance > enemy.attackRange * 0.82) {
        const speed = enemy.speed * (delta / 1000);
        enemy.container.x += (dx / distance) * speed;
        enemy.container.y += (dy / distance) * speed;
      }

      if (!enemy.telegraphUntil && now >= enemy.nextAttackAt && distance <= enemy.attackRange) {
        enemy.telegraphUntil = now + (enemy.ranged ? 880 : 620);
        enemy.telegraph.setStrokeStyle(4, 0xff5c50, 1).setAlpha(1);
        this.tweens.add({ targets: enemy.telegraph, scale: { from: 0.75, to: 1.35 }, alpha: { from: 1, to: 0.2 }, duration: enemy.ranged ? 880 : 620 });
      }
      if (enemy.telegraphUntil && now >= enemy.telegraphUntil) {
        this.resolveEnemyAttack(enemy, now);
        this.finishIfNeeded();
      }
    });
  }

  private emitSnapshot(force = false) {
    const now = this.time.now;
    if (!force && now - this.lastSnapshotAt < 90) return;
    this.lastSnapshotAt = now;
    const remaining = this.livingEnemies().length;
    this.game.events.emit(SNAPSHOT_EVENT, {
      hp: this.hp,
      maxHp: this.maxHp,
      posture: this.posture,
      maxPosture: this.maxPosture,
      focus: this.focus,
      combo: this.combo,
      objectiveHp: this.objectiveHp,
      objectiveMaxHp: this.objectiveMaxHp,
      objectiveShield: this.combat.carriageShield,
      enemiesRemaining: remaining,
      totalEnemies: this.enemies.length,
      elapsed: Math.max(0, (now - this.startedAt) / 1000),
      parryReady: now >= this.parryReadyAt,
      dodgeReady: now >= this.dodgeReadyAt,
      heavyReady: now >= this.heavyReadyAt,
      finisherReady: this.focus >= 100 && !this.combat.finisherUsed && this.status === 'active',
      cooldowns: Object.fromEntries(this.model.companions.map(({ hero }) => [hero.id, Math.max(0, ((this.orderReadyAt[hero.id] ?? 0) - now) / 1000)])),
      status: this.status,
      prompt: this.prompt,
      breaks: this.breaks,
      battle: buildActionBattleResult(this.combat, this.breaks),
    } satisfies ActionBattleSnapshot);
  }

  private finishIfNeeded() {
    if (this.status !== 'active') return true;
    this.combat = resolveActionOutcome(this.combat);
    if (this.combat.outcome === 'active') return false;
    this.status = this.combat.outcome;
    this.prompt = this.status === 'victory' ? '작전 완료 · 라온과 출격조가 전장을 확보했습니다.'
      : this.hp <= 0 ? '라온이 쓰러졌습니다.' : this.objectiveHp <= 0 ? `${this.model.mission.objectiveLabel}을 지키지 못했습니다.` : '작전 제한 시간이 끝났습니다.';
    this.emitSnapshot(true);
    this.game.events.emit(COMPLETE_EVENT);
    return true;
  }

  update(time: number, delta: number) {
    if (this.status !== 'active') return;
    const previousRound = this.combat.round;
    this.combat = advanceActionRounds(this.combat, this.model, Math.max(0, (time - this.startedAt) / 1000));
    if (this.finishIfNeeded()) return;
    if (this.combat.round !== previousRound) this.prompt = `${this.combat.round}라운드 · ${getActionRuleDescription(this.model.mission)}`;
    const horizontal = (this.cursors.left.isDown || this.keys.A.isDown || this.externalMovement.left ? -1 : 0)
      + (this.cursors.right.isDown || this.keys.D.isDown || this.externalMovement.right ? 1 : 0);
    const vertical = (this.cursors.up.isDown || this.keys.W.isDown || this.externalMovement.up ? -1 : 0)
      + (this.cursors.down.isDown || this.keys.S.isDown || this.externalMovement.down ? 1 : 0);
    const vector = new Phaser.Math.Vector2(horizontal, vertical);
    if (vector.lengthSq() > 0) {
      vector.normalize();
      this.facing.copy(vector);
      const speed = time <= this.dodgeUntil ? 530 : 245;
      this.player.x = Phaser.Math.Clamp(this.player.x + vector.x * speed * (delta / 1000), 72, WIDTH - 72);
      this.player.y = Phaser.Math.Clamp(this.player.y + vector.y * speed * (delta / 1000), 104, HEIGHT - 72);
      this.player.setScale(vector.x < 0 ? -1 : 1, 1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) this.lightAttack(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) this.heavyAttack(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.startParry(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) this.startDodge(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.teamFinisher(time);
    this.model.companions.forEach(({ hero }, index) => {
      const key = this.keys[['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][index]];
      if (key && Phaser.Input.Keyboard.JustDown(key)) this.companionOrder(hero.id, time);
    });
    if (this.finishIfNeeded()) return;

    if (time > this.comboExpires) this.combo = 0;
    this.posture = Math.min(this.maxPosture, this.posture + delta * 0.008);
    this.updateEnemies(time, delta);

    if (this.finishIfNeeded()) return;
    this.emitSnapshot();
  }
}

function formatCooldown(value: number) {
  return value <= 0 ? 'READY' : `${value.toFixed(1)}s`;
}

export function RaonActionBattle({ doctrine, difficulty, mission, heroes, raonStance, warPressure, bondSupport, onComplete, onExit, onSwitchMode }: RaonActionBattleProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const completedRef = useRef(false);
  const [battleAttempt, setBattleAttempt] = useState(0);
  // Deployment values stay fixed during the attempt, including after rewards update the roster.
  const [model] = useState(() => createActionBattleModel({ doctrine, difficulty, mission, heroes, raonStance, warPressure, bondSupport }));
  const [snapshot, setSnapshot] = useState<ActionBattleSnapshot>(() => createInitialSnapshot(model));
  const [confirmExit, setConfirmExit] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return window.localStorage.getItem('raonjena-action-guide-v1') !== 'seen';
    } catch {
      return true;
    }
  });
  const raon = model.raon;
  const onCompleteRef = useRef(onComplete);
  const initialModelRef = useRef(model);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (guideOpen || !hostRef.current || gameRef.current) return;
    bootActionModel = initialModelRef.current;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: hostRef.current,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#07090d',
      transparent: false,
      fps: { target: 60, forceSetTimeOut: true },
      scene: [RaonActionScene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false, clearBeforeRender: true },
      input: { keyboard: true, mouse: true, touch: true },
      callbacks: { preBoot: (bootingGame) => bootingGame.registry.set('action-model', initialModelRef.current) },
    });
    const stopRuntimeStabilizer = stabilizePhaserRuntime(game, 'RaonActionScene');
    const update = (next: ActionBattleSnapshot) => setSnapshot(next);
    const complete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      const current = game.registry.get('last-action-snapshot') as ActionBattleSnapshot | undefined;
      if (current?.status === 'victory' && current.battle.outcome === 'victory') onCompleteRef.current(current.battle);
    };
    const receiveSnapshot = (next: ActionBattleSnapshot) => {
      game.registry.set('last-action-snapshot', next);
      update(next);
    };
    game.events.on(SNAPSHOT_EVENT, receiveSnapshot);
    game.events.on(COMPLETE_EVENT, complete);
    gameRef.current = game;
    return () => {
      game.events.off(COMPLETE_EVENT, complete);
      game.events.off(SNAPSHOT_EVENT, receiveSnapshot);
      stopRuntimeStabilizer();
      game.destroy(true);
      gameRef.current = null;
      bootActionModel = null;
    };
  }, [battleAttempt, guideOpen]);

  const command = (value: string) => gameRef.current?.events.emit(COMMAND_EVENT, value);
  const startMove = (direction: MoveDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    command(`move-${direction}-start`);
  };
  const stopMove = (direction: MoveDirection, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    command(`move-${direction}-stop`);
  };
  const beginActionBattle = () => {
    try {
      window.localStorage.setItem('raonjena-action-guide-v1', 'seen');
    } catch {
      // The tutorial can still close when browser storage is unavailable.
    }
    setGuideOpen(false);
  };
  const retry = () => {
    completedRef.current = false;
    setSnapshot(createInitialSnapshot(model));
    setBattleAttempt((current) => current + 1);
  };
  const requestExit = () => {
    if (confirmExit) onExit();
    else {
      setConfirmExit(true);
      window.setTimeout(() => setConfirmExit(false), 2800);
    }
  };

  return (
    <main className="action-battle-page" style={{ backgroundImage: `linear-gradient(180deg, rgba(5, 7, 11, .5), rgba(2, 3, 5, .92)), url(${mission.background})` }}>
      <div className="action-engine" ref={hostRef} />
      <div className="action-vignette" aria-hidden="true" />

      <header className="action-header">
        <button onClick={requestExit}><ArrowLeft size={16} /> {confirmExit ? '다시 누르면 포기' : '작전 포기'}</button>
        <div title={getActionRuleDescription(mission)}><span>{mission.operation} · {battleDifficultyOptions.find((option) => option.id === model.difficulty)?.label}</span><strong>{mission.title}</strong><small>{mission.battlefieldRule.name} · {snapshot.battle.round}/{mission.roundLimit}라운드 · 남은 {Math.max(0, mission.roundLimit * ACTION_ROUND_SECONDS - snapshot.elapsed).toFixed(0)}초</small></div>
        <button onClick={onSwitchMode}><Crosshair size={16} /> 전술 모드</button>
      </header>

      <section className="action-raon-hud">
        <img src={raon?.art} alt="라온" />
        <div className="action-vitals">
          <div><span><HeartPulse size={13} /> 생명</span><strong>{Math.ceil(snapshot.hp)} / {snapshot.maxHp}</strong></div>
          <i className="health"><b style={{ width: `${(snapshot.hp / snapshot.maxHp) * 100}%` }} /></i>
          <div><span><Shield size={13} /> 방어 {raon.armor} · 자세</span><strong>{Math.ceil(snapshot.posture)}</strong></div>
          <i className="posture"><b style={{ width: `${(snapshot.posture / snapshot.maxPosture) * 100}%` }} /></i>
        </div>
        <div className="action-combo"><span>CHAIN</span><strong>{String(snapshot.combo).padStart(2, '0')}</strong></div>
      </section>

      <section className="action-objective-hud">
        <div><span>보호 목표</span><strong>{mission.objectiveLabel}</strong></div>
        <i><b style={{ width: `${Math.max(0, snapshot.objectiveHp / snapshot.objectiveMaxHp) * 100}%` }} /></i>
        <small>{Math.ceil(snapshot.objectiveHp)} / {snapshot.objectiveMaxHp} · 방벽 {snapshot.objectiveShield}</small>
      </section>

      <section className="action-enemy-hud">
        <span>HOSTILES</span><strong>{snapshot.enemiesRemaining}</strong><small>/ {snapshot.totalEnemies}</small>
      </section>

      <section className="action-focus-hud">
        <div><Sparkles size={15} /><span>출격조 사기</span><strong>{Math.round(snapshot.focus)}%</strong></div>
        <i><b style={{ width: `${snapshot.focus}%` }} /></i>
        <button className={snapshot.finisherReady ? 'ready' : ''} disabled={!snapshot.finisherReady || guideOpen} onClick={() => command('finisher')}><kbd>F</kbd> {snapshot.battle.finisherUsed ? '연계 사용 완료' : '16꽃잎 연계'}</button>
      </section>

      <section className="action-guide-strip" aria-live="polite">
        <Gauge size={16} /><p>{snapshot.prompt}</p><span>{snapshot.elapsed.toFixed(1)}s</span>
      </section>

      <section className="action-movement-pad" aria-label="라온 이동 패드">
        <span>MOVE</span>
        {(['up', 'left', 'down', 'right'] as MoveDirection[]).map((direction) => (
          <button
            key={direction}
            className={direction}
            aria-label={`${direction === 'up' ? '위' : direction === 'down' ? '아래' : direction === 'left' ? '왼쪽' : '오른쪽'}으로 이동`}
            onPointerDown={(event) => startMove(direction, event)}
            onPointerUp={(event) => stopMove(direction, event)}
            onPointerCancel={(event) => stopMove(direction, event)}
            onLostPointerCapture={() => command(`move-${direction}-stop`)}
          >
            {direction === 'up' ? '▲' : direction === 'down' ? '▼' : direction === 'left' ? '◀' : '▶'}
          </button>
        ))}
      </section>

      <section className="action-command-bar">
        <button disabled={guideOpen || snapshot.status !== 'active'} onClick={() => command('light')} title={`기초 위력 ${model.lightSkill.power} · 적 방어 차감 · 연격당 +2 · 사기 +${getActionAttack(model, 'light').morale}`}><kbd>J</kbd><span><strong>유동 베기</strong><small>위력 {model.lightSkill.power} · 연격 강화</small></span></button>
        <button disabled={guideOpen || snapshot.status !== 'active' || !snapshot.heavyReady} onClick={() => command('heavy')} title={`기초 위력 ${model.heavySkill.power} · 적 방어 차감 · 연격당 +3 · 사기 +${getActionAttack(model, 'heavy').morale}`}><kbd>K</kbd><span><strong>꽃잎 끊기</strong><small>{snapshot.heavyReady ? `위력 ${model.heavySkill.power} · 자세 파괴` : '재정비 중'}</small></span></button>
        <button disabled={guideOpen || snapshot.status !== 'active' || !snapshot.parryReady} onClick={() => command('parry')}><kbd>Q</kbd><span><strong>흐름 읽기</strong><small>{snapshot.parryReady ? '예고 패링' : '호흡 회복'}</small></span></button>
        <button disabled={guideOpen || snapshot.status !== 'active' || !snapshot.dodgeReady} onClick={() => command('dodge')}><kbd>⇧</kbd><span><strong>간격 이탈</strong><small>{snapshot.dodgeReady ? '무적 회피' : '발걸음 회복'}</small></span></button>
      </section>

      <section className="action-companion-orders">
        <span><UsersRound size={14} /> 편성 동료 명령 · 재사용 {ACTION_ORDER_COOLDOWN_SECONDS}초</span>
        {model.companions.map(({ hero, skill, slot }) => {
          const alive = (snapshot.battle.heroes.find((unit) => unit.id === hero.id)?.hp ?? 0) > 0;
          const cooldown = snapshot.cooldowns[hero.id] ?? 0;
          return <button key={hero.id} disabled={guideOpen || snapshot.status !== 'active' || !alive || cooldown > 0} onClick={() => command(`companion:${hero.id}`)} title={`${skill.kind === 'guard' ? `목표 방벽 +${skill.power}` : `위력 ${skill.power}`} · 사기 +${skill.morale} · 재사용 ${ACTION_ORDER_COOLDOWN_SECONDS}초`}><kbd>{slot}</kbd><strong>{hero.name} · {skill.name}</strong><small>{alive ? formatCooldown(cooldown) : '전투 불능'}</small></button>;
        })}
      </section>

      {snapshot.status !== 'active' && (
        <div className="action-outcome">
          <article className={snapshot.status}>
            {snapshot.status === 'victory' ? <Sparkles size={34} /> : <Swords size={34} />}
            <span>{snapshot.status === 'victory' ? 'OPERATION COMPLETE' : 'OPERATION FAILED'}</span>
            <h2>{snapshot.status === 'victory' ? mission.victoryText : mission.defeatText}</h2>
            <p>브레이크 {snapshot.breaks}회 · 전투 {snapshot.elapsed.toFixed(1)}초 · 목표 내구 {Math.ceil(snapshot.objectiveHp)}</p>
            <div>
              {snapshot.status === 'defeat' && <button onClick={retry}><RotateCcw size={16} /> 다시 도전</button>}
              <button onClick={onExit}><ArrowLeft size={16} /> 작전 지도로</button>
            </div>
          </article>
        </div>
      )}

      {guideOpen && (
        <div className="action-onboarding" role="dialog" aria-modal="true" aria-labelledby="action-guide-title">
          <article>
            <span>RAON DIRECT CONTROL</span>
            <h2 id="action-guide-title">라온의 검을 직접 움직입니다</h2>
            <p>전투는 안내를 닫은 뒤 시작됩니다. 성장·장비를 반영한 생명 {raon.maxHp}, 방어 {raon.armor}로 출격합니다.</p>
            <p>{getActionRuleDescription(mission)}</p>
            <p>{raonChoiceMeta[model.raonStance].label}: {raonChoiceMeta[model.raonStance].battleEffect} · {model.doctrine === 'shelter' ? '보호 교리' : '대응 사격 교리'} · 전쟁 압박 {model.warPressure}% · 현장 신뢰 {model.bondSupport}. 시작 사기 {model.initialState.morale}, 목표 방벽 {model.initialState.carriageShield}.</p>
            <div className="action-onboarding-steps">
              <section><kbd>WASD</kbd><strong>이동</strong><small>모바일에서는 왼쪽 이동 패드</small></section>
              <section><kbd>J · K</kbd><strong>검격</strong><small>연타로 집중, 강공격으로 자세 파괴</small></section>
              <section><kbd>Q · ⇧</kbd><strong>대응</strong><small>붉은 예고를 패링하거나 무적 회피</small></section>
              <section><kbd>1 ~ {model.companions.length}</kbd><strong>편성 동료 명령</strong><small>방벽·표식·정찰 등 동료의 실제 기술</small></section>
            </div>
            <div className="action-onboarding-actions">
              <button onClick={onSwitchMode}><Target size={17} /> 전술 모드로 시작</button>
              <button className="primary" onClick={beginActionBattle}><Swords size={17} /> 액션 전투 시작</button>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
