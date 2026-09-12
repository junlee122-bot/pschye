import { useState, type CSSProperties } from 'react';
import { Check, ChevronRight, CircleDot, LockKeyhole, Shield, Sparkles, Swords, UserRound } from 'lucide-react';
import { heroDefinitions } from '../data/battle';
import { canUnlockHeroGrowthNode, getHeroGrowthEffectLabel, getHeroGrowthNode, heroGrowthNodes } from '../data/heroGrowth';
import { getPlayerCharacters } from '../game/storyAccess';
import { equipmentDefinitions, getEquipment } from '../data/systems';
import { buildProgressedHeroes, getEquipmentSlotLabel } from '../game/progression';
import type { CampaignProfile } from '../types';

interface RosterProps {
  profile: CampaignProfile;
  onUnlockNode: (heroId: string, nodeId: string) => void;
  onEquip: (heroId: string, equipmentId: string) => void;
}

const rarityLabels = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설' };

export function Roster({ profile, onUnlockNode, onEquip }: RosterProps) {
  const [selectedHeroId, setSelectedHeroId] = useState('raon');
  const selectedHero = heroDefinitions.find((hero) => hero.id === selectedHeroId) ?? heroDefinitions[0];
  const progress = selectedHero ? profile.heroProgress[selectedHero.id] : undefined;
  const lore = getPlayerCharacters(profile).find((character) => character.id === selectedHero?.id);
  const progressedHero = buildProgressedHeroes(profile).find((hero) => hero.id === selectedHero?.id);
  const unlockedEquipment = equipmentDefinitions.filter((equipment) => profile.inventory.includes(equipment.id));
  if (!selectedHero || !progress) return null;
  const threshold = 100 + (progress.level - 1) * 35;

  return (
    <section className="roster-page page-enter">
      <header className="page-heading">
        <div><span className="eyebrow">PSYCHE GENERATION VII · PERSONNEL</span><h2>조장단 육성</h2><p>기술을 계승하되, 선대가 치른 희생까지 정답으로 받아들이지는 않는다.</p></div>
        <div className="roster-summary"><UserRound size={18} /><strong>06</strong><span>ACTIVE CAPTAINS</span></div>
      </header>

      <div className="roster-layout">
        <aside className="roster-list panel">
          {heroDefinitions.map((hero) => {
            const heroProgress = profile.heroProgress[hero.id];
            return (
              <button
                key={hero.id}
                className={selectedHero.id === hero.id ? 'selected' : ''}
                onClick={() => setSelectedHeroId(hero.id)}
                style={{ '--accent': hero.accent } as CSSProperties}
              >
                <img src={hero.art} alt="" />
                <div><span>Lv.{heroProgress?.level ?? 1} · {hero.title}</span><strong>{hero.name}</strong></div>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </aside>

        <article className="hero-development panel" style={{ '--accent': selectedHero.accent } as CSSProperties}>
          <div className="hero-development-art"><img src={selectedHero.art} alt={`${selectedHero.name} 설정화`} /><div /></div>
          <div className="hero-development-copy">
            <span className="eyebrow">CAPTAIN DOSSIER · LEVEL {progress.level}</span>
            <h3>{selectedHero.name}</h3>
            <p className="hero-epithet">{lore?.epithet}</p>
            <p>{lore?.officialSummary}</p>
            <div className="hero-rpg-stats">
              <div><Shield size={15} /><span>생명</span><strong>{progressedHero?.maxHp ?? selectedHero.maxHp}</strong></div>
              <div><Swords size={15} /><span>방어</span><strong>{progressedHero?.armor ?? selectedHero.armor}</strong></div>
              <div><Sparkles size={15} /><span>유대</span><strong>{progress.bond}%</strong></div>
            </div>
            <div className="xp-track"><div><span>경험치</span><strong>{progress.xp} / {threshold}</strong></div><i><b style={{ width: `${Math.min(100, (progress.xp / threshold) * 100)}%` }} /></i></div>
            <div className="equipment-row">
              {progress.equipment.map((equipmentId, index) => <div key={`${equipmentId}-${index}`}><CircleDot size={15} /><span>{index === 0 ? '주 무구' : '보조 장비'}</span><strong>{getEquipment(equipmentId)?.name ?? '미장착'}</strong></div>)}
            </div>
          </div>
        </article>

        <section className="skill-tree panel">
          <div className="panel-heading horizontal"><div><span className="eyebrow">CHE-NEUNG PATH</span><h3>체능 성장선</h3></div><span className="skill-points">기술점 {progress.skillPoints}</span></div>
          <div className="skill-nodes">
            {heroGrowthNodes.map((node) => {
              const unlocked = progress.unlockedNodes.includes(node.id);
              const available = canUnlockHeroGrowthNode(progress, node.id);
              const missingRequirements = node.requires.filter((id) => !progress.unlockedNodes.includes(id));
              return (
                <button key={node.id} className={unlocked ? 'unlocked' : available ? 'available' : 'locked'} disabled={!available} onClick={() => onUnlockNode(selectedHero.id, node.id)}>
                  <span>{unlocked ? <Check size={17} /> : available ? <Sparkles size={17} /> : <LockKeyhole size={16} />}</span>
                  <div>
                    <strong>{node.name}</strong>
                    <small>{node.description}</small>
                    <small>{getHeroGrowthEffectLabel(node)}</small>
                    <small>{unlocked ? '습득 완료' : `기술점 ${node.cost}${missingRequirements.length ? ` · 선행: ${missingRequirements.map((id) => getHeroGrowthNode(id)?.name).join(', ')}` : progress.skillPoints < node.cost ? ' · 기술점 부족' : ''}`}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="armory-panel panel">
          <div className="panel-heading horizontal">
            <div><span className="eyebrow">RECOVERED ARMORY</span><h3>회수 장비고</h3></div>
            <span className="skill-points">{unlockedEquipment.length} / {equipmentDefinitions.length}</span>
          </div>
          <div className="armory-grid">
            {unlockedEquipment.map((equipment) => {
              const equipped = progress.equipment.includes(equipment.id);
              return (
                <article className={`armory-card ${equipment.rarity} ${equipped ? 'equipped' : ''}`} key={equipment.id}>
                  <img src={equipment.art} alt="" />
                  <div className="armory-card-copy">
                    <div><span>{getEquipmentSlotLabel(equipment.slot)}</span><b>{rarityLabels[equipment.rarity]}</b></div>
                    <strong>{equipment.name}</strong>
                    <p>{equipment.description}</p>
                    <small>HP +{equipment.hp} · 방어 +{equipment.armor} · 위력 +{equipment.power}</small>
                    <button disabled={equipped} onClick={() => onEquip(selectedHero.id, equipment.id)}>
                      {equipped ? <><Check size={14} /> 장착 중</> : '장착'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
