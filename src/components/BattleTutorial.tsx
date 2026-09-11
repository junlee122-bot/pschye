import { AlertTriangle, ArrowRight, Eye, Link2, Shield, Swords, X } from 'lucide-react';
import type { MissionDefinition } from '../types';

interface BattleTutorialProps {
  mission: MissionDefinition;
  onClose: () => void;
}

const tutorialSteps = [
  {
    icon: Eye,
    index: '01',
    title: '먼저 적의 의도를 읽습니다',
    description: '붉은 의도 표식은 다음 적 행동의 목표와 피해를 미리 보여줍니다. 위험한 공격부터 끊으십시오.',
  },
  {
    icon: Link2,
    index: '02',
    title: '서로 다른 조장으로 한 적을 잇습니다',
    description: '같은 적을 다른 조장 세 명이 연속 공격하면 집중 연계 3이 되고, 적의 다음 행동을 봉쇄하는 브레이크가 발생합니다.',
  },
  {
    icon: Shield,
    index: '03',
    title: '공격과 보호 중 하나를 선택합니다',
    description: '브레이크를 노리면 큰 위협을 지울 수 있고, 방벽을 세우면 보호 목표의 예상 피해를 흡수할 수 있습니다.',
  },
  {
    icon: Swords,
    index: '04',
    title: '세 명령 뒤 적 행동을 실행합니다',
    description: '매 라운드 지휘점 3을 모두 사용하면 적 행동 버튼이 열립니다. 적 행동 뒤 모든 조장이 다시 준비됩니다.',
  },
];

export function BattleTutorial({ mission, onClose }: BattleTutorialProps) {
  return (
    <div className="battle-tutorial-backdrop" role="presentation">
      <section className="battle-tutorial" role="dialog" aria-modal="true" aria-labelledby="battle-tutorial-title">
        <button className="battle-tutorial-close" onClick={onClose} aria-label="전투 안내 닫기"><X size={18} /></button>
        <header>
          <span>PSYCHE FIELD MANUAL</span>
          <h2 id="battle-tutorial-title">전투는 세 번의 명령으로 만드는 퍼즐입니다</h2>
          <p>적보다 강한 기술을 찾는 게임이 아닙니다. 다음 공격을 읽고, 누구를 연결하고, 무엇을 지킬지 결정하는 게임입니다.</p>
        </header>
        <div className="battle-tutorial-steps">
          {tutorialSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.index}>
                <div><span>{step.index}</span><Icon size={20} /></div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            );
          })}
        </div>
        <div className="battle-tutorial-mission">
          <AlertTriangle size={18} />
          <div>
            <strong>이번 작전의 핵심 — {mission.battlefieldRule.name}</strong>
            <span>{mission.battlefieldRule.description}</span>
          </div>
        </div>
        <button className="battle-tutorial-start" onClick={onClose}>전장 확인하기 <ArrowRight size={17} /></button>
      </section>
    </div>
  );
}
