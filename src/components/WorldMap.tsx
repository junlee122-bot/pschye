import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Crosshair, Flag, LockKeyhole, MapPinned, ShieldAlert } from 'lucide-react';
import { missions } from '../data/campaign';
import { regions } from '../data/lore';
import { getMissionStatus } from '../game/progression';
import { getKnownMissions } from '../game/storyAccess';
import type { CampaignProfile } from '../types';

interface WorldMapProps {
  profile: CampaignProfile;
  onOpenMission: (missionId: string) => void;
}

const nodePositions: Record<string, { left: string; top: string }> = {
  'grey-bridge-escort': { left: '53%', top: '40%' },
  'citizen-cartridge': { left: '73%', top: '24%' },
  'empty-generation-village': { left: '23%', top: '27%' },
  'wingless-convoy': { left: '32%', top: '63%' },
  'sky-gunfire': { left: '78%', top: '62%' },
  'violet-infiltration': { left: '69%', top: '31%' },
  'cursed-border': { left: '41%', top: '69%' },
  'stopped-petal': { left: '51%', top: '46%' },
};

export function WorldMap({ profile, onOpenMission }: WorldMapProps) {
  const knownMissions = getKnownMissions(profile);
  const knownMissionIds = new Set(knownMissions.map((mission) => mission.id));
  const firstAvailable = knownMissions.find((mission) => getMissionStatus(profile, mission) === 'available') ?? knownMissions[0];
  const [selectedMissionId, setSelectedMissionId] = useState(firstAvailable?.id);
  const selectedMission = knownMissions.find((mission) => mission.id === selectedMissionId) ?? firstAvailable;
  const visibleMissionId = selectedMission?.id;
  useEffect(() => {
    if (selectedMissionId !== visibleMissionId) setSelectedMissionId(visibleMissionId);
  }, [selectedMissionId, visibleMissionId]);
  const selectedRegion = regions.find((region) => region.id === selectedMission?.regionId);
  const status = selectedMission ? getMissionStatus(profile, selectedMission) : 'locked';
  const fronts = useMemo(() => ({
    empire: missions.filter((mission) => ['capital', 'grey-bridge'].includes(mission.regionId)).length,
    cursed: missions.filter((mission) => mission.regionId === 'cursed-land').length,
    cheshi: missions.filter((mission) => mission.regionId === 'cheshi-ruins').length,
  }), []);

  if (!selectedMission) return null;

  return (
    <section className="world-page page-enter">
      <header className="page-heading world-heading">
        <div>
          <span className="eyebrow">STRATEGIC THEATER · A.S. 84</span>
          <h2>전선 지도</h2>
          <p>제국은 하나의 국가지만, 전쟁은 서로 다른 기억 위에서 동시에 진행된다.</p>
        </div>
        <div className="world-front-summary">
          <span><i className="gold" /> 제국권 {fronts.empire}</span>
          <span><i className="violet" /> 저주지 {fronts.cursed}</span>
          <span><i className="red" /> 체시권 {fronts.cheshi}</span>
        </div>
      </header>

      <div className="strategic-layout">
        <div className="strategic-map">
          <img src="/art/generated/campaign-world-map.webp" alt="라온제나 제국과 주변 전선의 전략 지도" />
          <div className="map-darkener" />
          {missions.map((mission) => {
            const known = knownMissionIds.has(mission.id);
            const missionStatus = known ? getMissionStatus(profile, mission) : 'locked';
            const position = nodePositions[mission.id];
            return (
              <button
                key={mission.id}
                className={`operation-node ${missionStatus} ${selectedMission.id === mission.id ? 'selected' : ''}`}
                style={position}
                onClick={() => { if (known) setSelectedMissionId(mission.id); }}
                disabled={!known}
                aria-label={`${mission.operation} · ${known ? mission.title : '미공개 작전'} ${missionStatus}`}
              >
                {missionStatus === 'complete' ? <Check size={15} /> : missionStatus === 'locked' ? <LockKeyhole size={14} /> : <Crosshair size={15} />}
                <span>{mission.operation.replace('OPERATION ', '')}</span>
              </button>
            );
          })}
          <div className="map-legend">
            <MapPinned size={16} /> 이동 가능한 전선만 밝게 표시됩니다.
          </div>
        </div>

        <aside className="strategic-dossier panel">
          <div className="dossier-status">
            <span className={`mission-status ${status}`}>{status === 'complete' ? '완료' : status === 'available' ? '출격 가능' : status === 'preview' ? '개발 중' : '봉인'}</span>
            <span>DANGER {String(selectedMission.threat).padStart(2, '0')}</span>
          </div>
          <span className="eyebrow">{selectedMission.operation} · ACT {selectedMission.act}</span>
          <h3>{selectedMission.title}</h3>
          <p className="dossier-subtitle">{selectedMission.subtitle}</p>
          <p>{selectedMission.summary}</p>
          <div className="region-brief">
            <Flag size={17} />
            <div><span>작전 지역</span><strong>{selectedRegion?.name ?? selectedMission.regionId}</strong></div>
          </div>
          <div className="threat-meter">
            <div><span>권장 레벨</span><strong>Lv.{selectedMission.recommendedLevel}</strong></div>
            <div><span>위협도</span><strong>{selectedMission.threat} / 15</strong></div>
          </div>
          <ul className="dossier-objectives">
            {selectedMission.objectives.map((objective) => <li key={objective}><ShieldAlert size={14} /> {objective}</li>)}
          </ul>
          <button
            className="launch-button"
            disabled={status === 'locked' || status === 'preview'}
            onClick={() => onOpenMission(selectedMission.id)}
          >
            {status === 'complete' ? '작전 기록 재현' : status === 'available' ? '작전실에서 준비' : '기록 해금 필요'} <ArrowRight size={18} />
          </button>
        </aside>
      </div>
    </section>
  );
}
