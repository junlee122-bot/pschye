import { Activity, Archive, ArrowUp, Boxes, Check, Coins, Hammer, HeartPulse, LockKeyhole, Send, Shield, Sparkles, Swords } from 'lucide-react';
import type { CSSProperties } from 'react';
import { facilities } from '../data/campaign';
import { dispatchOperations, factionDefinitions, getEquipment } from '../data/systems';
import { canResolveDispatch } from '../game/progression';
import type { CampaignProfile, FacilityId } from '../types';

interface HeadquartersProps {
  profile: CampaignProfile;
  onUpgrade: (facilityId: FacilityId) => void;
  onDispatch: (dispatchId: string) => void;
  onPlaceFacility: (slot: number, facilityId: FacilityId) => void;
}

const facilityIcons = {
  training: Swords,
  archive: Archive,
  infirmary: HeartPulse,
  forge: Hammer,
  violet: Shield,
};

function standingLabel(value: number) {
  if (value >= 60) return '맹약';
  if (value >= 25) return '신뢰';
  if (value >= 0) return '중립';
  if (value >= -40) return '경계';
  return '적대';
}

export function Headquarters({ profile, onUpgrade, onDispatch, onPlaceFacility }: HeadquartersProps) {
  return (
    <section className="headquarters-page page-enter">
      <header className="page-heading headquarters-heading">
        <div>
          <span className="eyebrow">PSYCHE HEADQUARTERS · DAY {profile.day}</span>
          <h2>프시케 본부</h2>
          <p>전투에서 얻은 자원은 사람을 소모하는 대신, 다음 임무에서 살아 돌아올 기반이 된다.</p>
        </div>
        <div className="resource-ledger">
          <div><Boxes size={16} /><span>보급품</span><strong>{profile.supplies}</strong></div>
          <div><Sparkles size={16} /><span>정보</span><strong>{profile.intel}</strong></div>
          <div><Coins size={16} /><span>유물</span><strong>{profile.relics}</strong></div>
        </div>
      </header>

      <div className="hq-command-banner">
        <img src="/art/archive/archive-cover.webp" alt="프시케 제국의 기록 보관소" />
        <div>
          <span>COMMAND LEVEL</span>
          <strong>{String(profile.commandLevel).padStart(2, '0')}</strong>
          <p>명성 {profile.renown} · 완료 작전 {profile.completedMissions.length} · 복구 기록 {profile.unlockedRecords.length}</p>
        </div>
      </div>

      <section className="hq-layout-panel panel">
        <div className="panel-heading horizontal">
          <div><span className="eyebrow">MODULAR COMMAND FLOOR</span><h3>본부 동선 설계</h3></div>
          <Boxes size={20} />
        </div>
        <p className="panel-intro">전투시설만 키우는 대신, 라온이 자주 오가는 공간을 직접 배치합니다. 구역을 눌러 다음 시설로 전환할 수 있습니다.</p>
        <div className="hq-room-grid">
          {profile.world.headquartersLayout.map((room) => {
            const facility = facilities.find((entry) => entry.id === room.facilityId) ?? facilities[0];
            const Icon = facilityIcons[facility.id];
            const currentIndex = facilities.findIndex((entry) => entry.id === facility.id);
            const nextFacility = facilities[(currentIndex + 1) % facilities.length];
            return (
              <button
                key={room.slot}
                style={{ '--room-art': `url("${facility.art}")` } as CSSProperties}
                onClick={() => onPlaceFacility(room.slot, nextFacility.id)}
              >
                <span>구역 {String(room.slot + 1).padStart(2, '0')}</span>
                <Icon size={22} />
                <strong>{facility.name}</strong>
                <small>Lv.{profile.facilities[facility.id]} · 클릭하여 재배치</small>
              </button>
            );
          })}
        </div>
      </section>

      <div className="facility-grid">
        {facilities.map((facility) => {
          const Icon = facilityIcons[facility.id];
          const level = profile.facilities[facility.id];
          const cost = facility.baseCost * (level + 1);
          const maxed = level >= facility.maxLevel;
          return (
            <article className={`facility-card ${level === 0 ? 'dormant' : ''}`} key={facility.id}>
              <img src={facility.art} alt="" />
              <div className="facility-shade" />
              <div className="facility-copy">
                <div className="facility-title"><Icon size={19} /><span>Lv.{level}</span></div>
                <h3>{facility.name}</h3>
                <p>{facility.subtitle}</p>
                <small>{facility.description}</small>
                <ul>{facility.benefit.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
                <button disabled={maxed || profile.supplies < cost} onClick={() => onUpgrade(facility.id)}>
                  {maxed ? '최대 확장' : <><ArrowUp size={14} /> 확장 · {cost} 보급</>}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hq-strategy-grid">
        <section className="faction-panel panel">
          <div className="panel-heading"><span className="eyebrow">FACTION COUNCIL</span><h3>세력 평판</h3></div>
          <p className="panel-intro">제7기의 선택은 전투 결과뿐 아니라, 다음 시대에 누가 협상 테이블에 앉는지를 바꾼다.</p>
          <div className="faction-list">
            {factionDefinitions.map((faction) => {
              const value = profile.factions[faction.id];
              return (
                <article key={faction.id} style={{ '--faction': faction.accent } as CSSProperties}>
                  <div><span>{faction.subtitle}</span><strong>{faction.name}</strong></div>
                  <b>{standingLabel(value)} {value > 0 ? `+${value}` : value}</b>
                  <i><em style={{ width: `${(value + 100) / 2}%` }} /></i>
                  <p>{faction.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dispatch-panel panel">
          <div className="panel-heading horizontal"><div><span className="eyebrow">FIELD DISPATCH</span><h3>비전투 파견망</h3></div><Send size={20} /></div>
          <p className="panel-intro">작전 사이의 구조·조사·중재가 보급선과 장비, 세력 관계를 확장합니다.</p>
          <div className="dispatch-grid">
            {dispatchOperations.map((dispatch) => {
              const completed = profile.completedDispatches.includes(dispatch.id);
              const prerequisiteMet = !dispatch.requiredMission || profile.completedMissions.includes(dispatch.requiredMission);
              const available = canResolveDispatch(profile, dispatch);
              const rewardEquipment = dispatch.reward.equipmentId ? getEquipment(dispatch.reward.equipmentId) : undefined;
              return (
                <article key={dispatch.id} className={completed ? 'completed' : prerequisiteMet ? 'available' : 'locked'}>
                  <div className="dispatch-title">
                    <span>{completed ? <Check size={15} /> : prerequisiteMet ? <Send size={15} /> : <LockKeyhole size={15} />}</span>
                    <div><strong>{dispatch.title}</strong><small>{dispatch.subtitle}</small></div>
                  </div>
                  <p>{dispatch.description}</p>
                  <div className="dispatch-yield">
                    <span>보급 {dispatch.reward.supplies >= dispatch.cost ? '+' : ''}{dispatch.reward.supplies - dispatch.cost}</span>
                    <span>정보 +{dispatch.reward.intel}</span>
                    <span>{dispatch.days}일</span>
                    {rewardEquipment && <span>{rewardEquipment.name}</span>}
                  </div>
                  <button disabled={!available} onClick={() => onDispatch(dispatch.id)}>
                    {completed ? '파견 완료' : !prerequisiteMet ? '선행 작전 필요' : profile.supplies < dispatch.cost ? `보급 ${dispatch.cost} 필요` : `파견 · 보급 ${dispatch.cost}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className="activity-panel panel">
        <div className="panel-heading horizontal"><div><span className="eyebrow">COMMAND LOG</span><h3>본부 활동 기록</h3></div><Activity size={20} /></div>
        <ol>{profile.activityLog.map((entry, index) => <li key={`${entry}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{entry}</li>)}</ol>
      </section>
    </section>
  );
}
