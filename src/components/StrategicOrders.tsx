import { ArrowRight, Check, Flag, Gift, Sparkles } from 'lucide-react';
import { strategicOrders } from '../data/systems';
import { canClaimStrategicOrder, getStrategicOrderProgress } from '../game/progression';
import type { CampaignProfile, NavigationSection, StrategicOrderId } from '../types';

interface StrategicOrdersProps {
  profile: CampaignProfile;
  onNavigate: (section: NavigationSection) => void;
  onClaim: (orderId: StrategicOrderId) => void;
}

export function StrategicOrders({ profile, onNavigate, onClaim }: StrategicOrdersProps) {
  const claimed = profile.claimedStrategicOrders.length;

  return (
    <section className="strategic-orders panel" aria-labelledby="strategic-orders-title">
      <header>
        <div>
          <span className="eyebrow"><Flag size={13} /> STRATEGIC ORDERS</span>
          <h3 id="strategic-orders-title">제7기 전역 명령</h3>
          <p>다음 행동이 막막할 때는 이 명령부터 수행하십시오. 모든 목표는 실제 성장 시스템으로 이어집니다.</p>
        </div>
        <div className="strategic-orders-total"><strong>{claimed}</strong><span>/ {strategicOrders.length} COMPLETE</span></div>
      </header>

      <div className="strategic-order-grid">
        {strategicOrders.map((order) => {
          const progress = getStrategicOrderProgress(profile, order);
          const isClaimed = profile.claimedStrategicOrders.includes(order.id);
          const claimable = canClaimStrategicOrder(profile, order);
          const percentage = Math.round((progress / order.goal) * 100);
          return (
            <article key={order.id} className={isClaimed ? 'claimed' : claimable ? 'claimable' : ''}>
              <div className="strategic-order-title">
                <span>{isClaimed ? <Check size={15} /> : claimable ? <Gift size={15} /> : <Sparkles size={15} />}</span>
                <div><strong>{order.title}</strong><small>{order.subtitle}</small></div>
              </div>
              <p>{order.description}</p>
              <div className="strategic-order-progress">
                <div><span>{progress} / {order.goal}</span><strong>{percentage}%</strong></div>
                <i><b style={{ width: `${percentage}%` }} /></i>
              </div>
              <div className="strategic-order-footer">
                <small>보급 {order.reward.supplies} · 정보 {order.reward.intel} · 유물 {order.reward.relics} · 명성 {order.reward.renown}</small>
                <button
                  disabled={isClaimed}
                  onClick={() => claimable ? onClaim(order.id) : onNavigate(order.targetSection)}
                >
                  {isClaimed ? '완료' : claimable ? '보상 수령' : '바로가기'} {!isClaimed && <ArrowRight size={13} />}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
