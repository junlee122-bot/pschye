import { Brain, Heart, History, Search, ShieldAlert, Swords } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getBondKey, getWarPressure } from '../game/progression';
import type { CampaignProfile, HeroDefinition, MissionDefinition } from '../types';

interface RaonMindPanelProps {
  profile: CampaignProfile;
  mission: MissionDefinition;
  companion: HeroDefinition;
}

const voiceDefinitions = [
  {
    id: 'resolve',
    title: '검의 본능',
    subtitle: '먼저 움직여 길을 만든다',
    icon: Swords,
    accent: '#d77652',
  },
  {
    id: 'compassion',
    title: '타인의 숨',
    subtitle: '사선 안의 사람부터 센다',
    icon: Heart,
    accent: '#d998ae',
  },
  {
    id: 'insight',
    title: '틈새 읽기',
    subtitle: '보이는 적 뒤의 이유를 찾는다',
    icon: Search,
    accent: '#66b7bf',
  },
  {
    id: 'legacy',
    title: '멈춘 꽃잎',
    subtitle: '해찬의 검이 남긴 질문을 듣는다',
    icon: History,
    accent: '#a994d8',
  },
] as const;

function voiceLine(id: typeof voiceDefinitions[number]['id'], mission: MissionDefinition) {
  if (id === 'resolve') return `“${mission.objectiveLabel}까지 가는 길은 기다린다고 열리지 않아.”`;
  if (id === 'compassion') return `“작전 목표 뒤에 숨은 사람들의 귀환까지 세어.”`;
  if (id === 'insight') return `“${mission.intel[0] ?? '적은 보이는 자리에서만 움직이지 않는다.'}”`;
  return '“완성된 검을 흉내 내지 마. 왜 그 검이 멈췄는지 봐.”';
}

export function RaonMindPanel({ profile, mission, companion }: RaonMindPanelProps) {
  const pressure = getWarPressure(profile);
  const memory = profile.relationshipMemories[mission.id];
  const pairBond = profile.bondLevels[getBondKey('raon', companion.id)] ?? 0;

  return (
    <section className="raon-mind-panel panel" aria-label="라온의 내면과 전선 상태">
      <header className="raon-mind-heading">
        <div>
          <span className="eyebrow"><Brain size={14} /> RAON'S INNER COUNCIL</span>
          <h3>검을 뽑기 전, 네 목소리가 먼저 말한다</h3>
          <p>수치는 정답이 아니라 라온이 어떤 판단을 더 자연스럽게 꺼낼 수 있는지를 보여줍니다.</p>
        </div>
        <div className={`war-clock war-${pressure.tier}`}>
          <ShieldAlert size={18} />
          <span><small>전쟁 압박</small><strong>{pressure.label} · {pressure.value}%</strong></span>
          <i><b style={{ width: `${pressure.value}%` }} /></i>
          <p>{pressure.effect}</p>
        </div>
      </header>

      <div className="inner-voice-grid">
        {voiceDefinitions.map((voice) => {
          const Icon = voice.icon;
          const level = voice.id === 'legacy'
            ? profile.completedMissions.length
            : profile.raonPath[voice.id];
          return (
            <article key={voice.id} className={`inner-voice-card voice-${voice.id}`} style={{ '--voice-accent': voice.accent } as CSSProperties}>
              <div><Icon size={19} /><span><strong>{voice.title}</strong><small>{voice.subtitle}</small></span><b>LV {level}</b></div>
              <p>{voiceLine(voice.id, mission)}</p>
            </article>
          );
        })}
      </div>

      <footer className="mind-memory-row">
        <div className="companion-trust">
          <img src={companion.art} alt="" />
          <span><small>{companion.name}과의 현장 신뢰</small><strong>{pairBond} / 100</strong></span>
          <i><b style={{ width: `${pairBond}%` }} /></i>
        </div>
        <div className={`story-memory-card ${memory ? `memory-${memory.outcome}` : ''}`}>
          <History size={17} />
          <span>
            <small>{memory ? '동료가 기억하는 장면' : '아직 쓰이지 않은 기억'}</small>
            <strong>{memory?.text ?? `${companion.name}은 아직 이 작전에서 라온의 답을 기다리고 있다.`}</strong>
            {memory && <p>{memory.reaction}</p>}
          </span>
        </div>
      </footer>
    </section>
  );
}
