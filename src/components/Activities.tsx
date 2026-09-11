import { useMemo, useState, type CSSProperties } from 'react';
import {
  Anvil,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Coins,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Swords,
  UsersRound,
} from 'lucide-react';
import { heroDefinitions } from '../data/battle';
import { craftRecipes, dailyActivities, getEquipment } from '../data/systems';
import {
  canCraftRecipe,
  canAdvanceDay,
  canPerformDailyActivity,
  getBondKey,
} from '../game/progression';
import type { CampaignProfile, DailyActivityId, TrainingFocus } from '../types';

interface ActivitiesProps {
  profile: CampaignProfile;
  onAdvanceDay: () => void;
  onTrain: (heroId: string, focus: TrainingFocus) => void;
  onBond: (firstHeroId: string, secondHeroId: string) => void;
  onFieldActivity: (activityId: DailyActivityId) => void;
  onCraft: (equipmentId: string) => void;
  onClaimDailyOrders: () => void;
}

type ActivityTab = 'training' | 'bond' | 'field' | 'forge';

const trainingOptions: Array<{
  id: TrainingFocus;
  title: string;
  subtitle: string;
  reward: string;
  icon: typeof Swords;
}> = [
  { id: 'foundation', title: '기초 교범 반복', subtitle: '안전한 기 순환과 자세 교정', reward: 'XP 38 · 유대 2', icon: Swords },
  { id: 'survival', title: '대화기 생존 훈련', subtitle: '엄폐·구조·퇴로 판단', reward: 'XP 28 · 유대 4', icon: ShieldCheck },
  { id: 'command', title: '조장 지휘 모의전', subtitle: '명령이 사라진 순간의 선택', reward: 'XP 22 · 유대 7 · 명성 6', icon: UsersRound },
];

const activityTabs: Array<{ id: ActivityTab; label: string; icon: typeof Swords }> = [
  { id: 'training', label: '개인 훈련', icon: Swords },
  { id: 'bond', label: '유대 훈련', icon: HeartHandshake },
  { id: 'field', label: '현장 활동', icon: CalendarDays },
  { id: 'forge', label: '공방 제작', icon: Anvil },
];

export function Activities({
  profile,
  onAdvanceDay,
  onTrain,
  onBond,
  onFieldActivity,
  onCraft,
  onClaimDailyOrders,
}: ActivitiesProps) {
  const [tab, setTab] = useState<ActivityTab>('training');
  const [selectedHeroId, setSelectedHeroId] = useState('raon');
  const [partnerHeroId, setPartnerHeroId] = useState('hadori');
  const selectedHero = heroDefinitions.find((hero) => hero.id === selectedHeroId) ?? heroDefinitions[0];
  const partnerHero = heroDefinitions.find((hero) => hero.id === partnerHeroId) ?? heroDefinitions[1];
  const bondKey = selectedHero && partnerHero ? getBondKey(selectedHero.id, partnerHero.id) : '';
  const pairBond = profile.bondLevels[bondKey] ?? 0;
  const completedActivities = useMemo(
    () => Object.values(profile.activityCounts).reduce((total, count) => total + count, 0),
    [profile.activityCounts],
  );
  const dailyOrders = [
    { id: 'training' as const, label: '개인 훈련 1회', value: profile.dailyCommandStats.training },
    { id: 'bond' as const, label: '유대 훈련 1회', value: profile.dailyCommandStats.bond },
    { id: 'field' as const, label: '현장 활동 1회', value: profile.dailyCommandStats.field },
  ];
  const completedOrders = dailyOrders.filter((order) => order.value > 0).length;
  const canClaimOrders = completedOrders === dailyOrders.length && !profile.dailyRewardClaimed;
  const canMoveToNextDay = canAdvanceDay(profile);

  if (!selectedHero || !partnerHero) return null;

  const selectPrimaryHero = (heroId: string) => {
    setSelectedHeroId(heroId);
    if (heroId === partnerHeroId) {
      setPartnerHeroId(heroDefinitions.find((hero) => hero.id !== heroId)?.id ?? 'hadori');
    }
  };

  return (
    <section className="activities-page page-enter">
      <header className="page-heading activities-heading">
        <div>
          <span className="eyebrow">DAILY COMMAND · DAY {profile.day}</span>
          <h2>일일 지휘</h2>
          <p>작전이 없는 날에도 사람을 키우고, 관계를 만들고, 전장을 준비할 수 있습니다.</p>
        </div>
        <div className="daily-command-ledger">
          <div className="action-orbs" aria-label={`남은 행동력 ${profile.commandActions}`}>
            {[0, 1, 2].map((index) => <i key={index} className={index < profile.commandActions ? 'filled' : ''} />)}
          </div>
          <div><span>남은 지휘 행동</span><strong>{profile.commandActions} / 3</strong></div>
          <button
            disabled={!canMoveToNextDay}
            onClick={onAdvanceDay}
            title={profile.commandActions === 3 ? '먼저 지휘 행동을 한 번 수행해야 합니다.' : canClaimOrders ? '완료한 일일 지휘 보상을 먼저 수령하십시오.' : '남은 행동을 포기하고 다음 날로 이동합니다.'}
          ><CalendarDays size={16} /> {canClaimOrders ? '보상 수령 필요' : '다음 날'} <ArrowRight size={15} /></button>
        </div>
      </header>

      <div className="activities-summary-grid">
        <article><Swords size={18} /><span>훈련 가능 인원</span><strong>{heroDefinitions.length}</strong></article>
        <article><HeartHandshake size={18} /><span>개방 유대 기록</span><strong>{profile.unlockedRecords.filter((id) => id.startsWith('bond-')).length}</strong></article>
        <article><BookOpenCheck size={18} /><span>누적 현장 활동</span><strong>{completedActivities}</strong></article>
        <article><Anvil size={18} /><span>공방 단계</span><strong>Lv.{profile.facilities.forge}</strong></article>
      </div>

      <section className={`daily-orders panel ${profile.dailyRewardClaimed ? 'claimed' : ''}`}>
        <div className="daily-orders-copy">
          <span className="eyebrow">DAILY ORDERS · BALANCED COMMAND</span>
          <h3>세 가지 방식으로 사람을 지휘하십시오</h3>
          <p>전투력·관계·현장을 모두 챙긴 날에만 생환 교범 보급이 지급됩니다.</p>
        </div>
        <div className="daily-order-list">
          {dailyOrders.map((order) => (
            <button key={order.id} className={order.value > 0 ? 'complete' : ''} onClick={() => setTab(order.id)}>
              {order.value > 0 ? <CheckCircle2 size={17} /> : <i />}
              <span>{order.label}</span><small>{order.value > 0 ? '완료' : '바로가기'}</small>
            </button>
          ))}
        </div>
        <div className="daily-order-reward">
          <span>{completedOrders} / 3</span>
          <small>보급 80 · 정보 30 · 유물 1 · 명성 12</small>
          <button disabled={!canClaimOrders} onClick={onClaimDailyOrders}>
            {profile.dailyRewardClaimed ? '오늘 보상 수령 완료' : canClaimOrders ? '지휘 보상 수령' : '목표 진행 중'}
          </button>
        </div>
      </section>

      <nav className="activity-tabs" aria-label="일일 활동 종류">
        {activityTabs.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17} /> {item.label}</button>;
        })}
      </nav>

      {tab === 'training' && (
        <div className="activity-workspace training-workspace">
          <aside className="activity-hero-picker panel">
            <div className="panel-heading"><span className="eyebrow">TRAINING ROSTER</span><h3>훈련 대상</h3></div>
            {heroDefinitions.map((hero) => {
              const progress = profile.heroProgress[hero.id];
              return (
                <button key={hero.id} className={hero.id === selectedHero.id ? 'selected' : ''} onClick={() => selectPrimaryHero(hero.id)} style={{ '--accent': hero.accent } as CSSProperties}>
                  <img src={hero.art} alt="" />
                  <div><strong>{hero.name}</strong><span>Lv.{progress?.level} · 유대 {progress?.bond}%</span></div>
                  {hero.id === selectedHero.id && <Check size={15} />}
                </button>
              );
            })}
          </aside>
          <section className="training-focus-panel panel" style={{ '--accent': selectedHero.accent } as CSSProperties}>
            <div className="training-hero-banner">
              <img src={selectedHero.art} alt={`${selectedHero.name} 설정화`} />
              <div><span>SELECTED CAPTAIN</span><h3>{selectedHero.name}</h3><p>{selectedHero.title}</p></div>
            </div>
            <div className="training-options">
              {trainingOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <article key={option.id}>
                    <Icon size={21} />
                    <div><strong>{option.title}</strong><p>{option.subtitle}</p><small>{option.reward} · 행동 1 · 보급 20</small></div>
                    <button disabled={profile.commandActions < 1 || profile.supplies < 20} onClick={() => onTrain(selectedHero.id, option.id)}>훈련 실행</button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'bond' && (
        <section className="bond-workspace panel">
          <div className="panel-heading horizontal"><div><span className="eyebrow">PAIR EXERCISE</span><h3>조장 연계 훈련</h3></div><HeartHandshake size={22} /></div>
          <p className="panel-intro">두 사람의 유대가 30과 60에 도달하면 신뢰·맹약 기록이 해금됩니다.</p>
          <div className="bond-duo">
            <div className="bond-portrait" style={{ '--accent': selectedHero.accent } as CSSProperties}>
              <img src={selectedHero.art} alt="" /><span>선봉</span><strong>{selectedHero.name}</strong>
            </div>
            <div className="bond-core">
              <HeartHandshake size={32} />
              <strong>{pairBond}</strong><span>PAIR BOND</span>
              <i><b style={{ width: `${pairBond}%` }} /></i>
              <small>{pairBond >= 60 ? '맹약 기록 개방' : pairBond >= 30 ? '신뢰 기록 개방' : '서로의 전투 리듬을 배우는 중'}</small>
            </div>
            <div className="bond-portrait" style={{ '--accent': partnerHero.accent } as CSSProperties}>
              <img src={partnerHero.art} alt="" /><span>연계</span><strong>{partnerHero.name}</strong>
            </div>
          </div>
          <div className="partner-grid">
            {heroDefinitions.filter((hero) => hero.id !== selectedHero.id).map((hero) => (
              <button key={hero.id} className={hero.id === partnerHero.id ? 'selected' : ''} onClick={() => setPartnerHeroId(hero.id)}>
                <img src={hero.art} alt="" /><span>{hero.name}</span>
              </button>
            ))}
          </div>
          <button className="activity-primary-button" disabled={profile.commandActions < 1 || profile.supplies < 15} onClick={() => onBond(selectedHero.id, partnerHero.id)}>
            연계 훈련 시작 · 행동 1 · 보급 15
          </button>
        </section>
      )}

      {tab === 'field' && (
        <section className="field-activity-grid">
          {dailyActivities.map((activity) => {
            const available = canPerformDailyActivity(profile, activity);
            const prerequisiteMet = !activity.requiredMission || profile.completedMissions.includes(activity.requiredMission);
            const count = profile.activityCounts[activity.id] ?? 0;
            return (
              <article key={activity.id} className={!prerequisiteMet ? 'locked' : ''}>
                <img src={activity.art} alt="" />
                <div className="field-activity-shade" />
                <div className="field-activity-copy">
                  <div><span>{count > 0 ? `${count}회 완료` : 'REPEATABLE'}</span>{!prerequisiteMet && <LockKeyhole size={15} />}</div>
                  <h3>{activity.title}</h3><strong>{activity.subtitle}</strong><p>{activity.description}</p>
                  <small>행동 {activity.actionCost} · 보급 {activity.suppliesCost} · 정보 {activity.intelCost}</small>
                  <div className="field-rewards"><span>보급 +{activity.reward.supplies}</span><span>정보 +{activity.reward.intel}</span><span>명성 +{activity.reward.renown}</span></div>
                  <button disabled={!available} onClick={() => onFieldActivity(activity.id)}>{!prerequisiteMet ? '선행 작전 필요' : available ? '활동 실행' : '자원 또는 행동 부족'}</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'forge' && (
        <section className="craft-workspace panel">
          <div className="panel-heading horizontal"><div><span className="eyebrow">LEGACY FORGE</span><h3>영웅 기록 복원 제작</h3></div><div className="forge-resources"><Coins size={15} /> {profile.supplies} <Sparkles size={15} /> {profile.relics}</div></div>
          <p className="panel-intro">설정집의 무구와 훈련 도구를 실제 장비로 복원합니다. 공방 확장 단계가 제작 범위를 결정합니다.</p>
          <div className="craft-grid">
            {craftRecipes.map((recipe) => {
              const equipment = getEquipment(recipe.equipmentId);
              if (!equipment) return null;
              const owned = profile.inventory.includes(equipment.id);
              const craftable = canCraftRecipe(profile, recipe);
              return (
                <article key={equipment.id} className={`${equipment.rarity} ${owned ? 'owned' : ''}`}>
                  <img src={equipment.art} alt="" />
                  <div><span>공방 Lv.{recipe.forgeLevel}</span><strong>{equipment.name}</strong><p>{equipment.description}</p><small>HP +{equipment.hp} · 방어 +{equipment.armor} · 위력 +{equipment.power}</small></div>
                  <button disabled={!craftable} onClick={() => onCraft(equipment.id)}>{owned ? '보유 중' : profile.facilities.forge < recipe.forgeLevel ? `공방 Lv.${recipe.forgeLevel} 필요` : `제작 · ${recipe.supplies} / 유물 ${recipe.relics}`}</button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
