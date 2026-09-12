import type { HeroProgress } from '../types';

export type HeroGrowthNodeId = 'foundation' | 'fieldcraft' | 'bond-technique' | 'personal-style';

export interface HeroGrowthBonuses {
  hp: number;
  armor: number;
  power: number;
  morale: number;
}

export interface HeroGrowthNode {
  id: HeroGrowthNodeId;
  name: string;
  description: string;
  cost: number;
  requires: readonly HeroGrowthNodeId[];
  bonuses: Readonly<HeroGrowthBonuses>;
}

export const heroGrowthNodes: readonly HeroGrowthNode[] = [
  {
    id: 'foundation',
    name: '기초 교범',
    description: '체능을 안전하게 순환시키는 기본 자세.',
    cost: 0,
    requires: [],
    bonuses: { hp: 0, armor: 0, power: 0, morale: 0 },
  },
  {
    id: 'fieldcraft',
    name: '실전 응용',
    description: '기술을 다듬고 전장에서 버틸 힘을 기른다.',
    cost: 1,
    requires: ['foundation'],
    bonuses: { hp: 10, armor: 0, power: 4, morale: 0 },
  },
  {
    id: 'bond-technique',
    name: '연계 체능',
    description: '기술을 사용할 때 동료의 사기를 끌어올린다.',
    cost: 1,
    requires: ['fieldcraft'],
    bonuses: { hp: 0, armor: 0, power: 0, morale: 4 },
  },
  {
    id: 'personal-style',
    name: '개인류의 씨앗',
    description: '자신의 체능을 정립해 위력과 방어를 함께 높인다.',
    cost: 1,
    requires: ['bond-technique'],
    bonuses: { hp: 0, armor: 2, power: 6, morale: 0 },
  },
];

export function getHeroGrowthNode(nodeId: string) {
  return heroGrowthNodes.find((node) => node.id === nodeId);
}

export function canUnlockHeroGrowthNode(
  progress: Pick<HeroProgress, 'skillPoints' | 'unlockedNodes'>,
  nodeId: string,
) {
  const node = getHeroGrowthNode(nodeId);
  return Boolean(node
    && !progress.unlockedNodes.includes(node.id)
    && Number.isFinite(progress.skillPoints)
    && progress.skillPoints >= node.cost
    && node.requires.every((requiredId) => progress.unlockedNodes.includes(requiredId)));
}

export function getHeroGrowthBonuses(unlockedNodes: readonly string[]): HeroGrowthBonuses {
  const total: HeroGrowthBonuses = { hp: 0, armor: 0, power: 0, morale: 0 };
  // Iterate definitions so duplicate/unknown saved IDs cannot multiply a bonus.
  // Existing unlocks retain their effects even if an old save lacks a prerequisite.
  for (const node of heroGrowthNodes) {
    if (!unlockedNodes.includes(node.id)) continue;
    total.hp += node.bonuses.hp;
    total.armor += node.bonuses.armor;
    total.power += node.bonuses.power;
    total.morale += node.bonuses.morale;
  }
  return total;
}

export function getHeroGrowthEffectLabel(node: HeroGrowthNode) {
  const { hp, armor, power, morale } = node.bonuses;
  const effects = [
    hp ? `최대 생명 +${hp}` : '',
    armor ? `방어 +${armor}` : '',
    power ? `모든 기술 위력 +${power}` : '',
    morale ? `기술 사용 시 사기 획득 +${morale}` : '',
  ].filter(Boolean);
  return effects.length ? effects.join(' · ') : '기본 능력치 유지';
}
