import { useState } from 'react';
import { AlertTriangle, BookOpenText, Compass, Eye, MapPin, MapPinned, ShieldCheck } from 'lucide-react';
import { generations, regions, timeline } from '../data/lore';
import { LocationAtlas } from './LocationAtlas';
import { StoryAtlas } from './StoryAtlas';

type ChronicleView = 'story' | 'locations' | 'timeline' | 'generations' | 'world';

export function Chronicle() {
  const [view, setView] = useState<ChronicleView>('story');
  const [selectedRegionId, setSelectedRegionId] = useState(regions[0]?.id ?? 'capital');
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? regions[0];

  return (
    <section className="chronicle-page page-enter">
      <header className="page-heading">
        <div>
          <span className="eyebrow">IMPERIAL RECORD / REDACTED LAYER</span>
          <h2>두 개의 연대기</h2>
          <p>제국이 가르친 역사와 살아남은 사람들이 기억하는 역사를 겹쳐 읽으십시오.</p>
        </div>
        <div className="segmented-control" role="tablist" aria-label="연대기 보기">
          <button className={view === 'story' ? 'active' : ''} onClick={() => setView('story')}><BookOpenText size={14} /> 대서사</button>
          <button className={view === 'locations' ? 'active' : ''} onClick={() => setView('locations')}><MapPinned size={14} /> 장소 도감</button>
          <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>연표</button>
          <button className={view === 'generations' ? 'active' : ''} onClick={() => setView('generations')}>7개 기수</button>
          <button className={view === 'world' ? 'active' : ''} onClick={() => setView('world')}>세계 지도</button>
        </div>
      </header>

      {view === 'story' && <StoryAtlas />}
      {view === 'locations' && <LocationAtlas />}

      {view === 'timeline' && (
        <div className="timeline-list">
          {timeline.map((event, index) => (
            <article key={`${event.year}-${event.title}`} className={`timeline-event ${event.tone}`}>
              <div className="timeline-marker"><span>{index + 1}</span></div>
              <div className="timeline-year">{event.year}</div>
              <div className="timeline-copy">
                <h3>{event.title}</h3>
                <div className="record-columns">
                  <div>
                    <span><ShieldCheck size={14} /> 제국 정사</span>
                    <p>{event.publicRecord}</p>
                  </div>
                  <div className="true-record">
                    <span><Eye size={14} /> 생존자 기록</span>
                    <p>{event.trueRecord}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {view === 'generations' && (
        <div className="generation-grid">
          {generations.map((generation) => (
            <article className={`generation-card ${generation.status}`} key={generation.id}>
              <img src={generation.art} alt={`${generation.name} 인물 설정화`} />
              <div className="generation-card-shade" />
              <div className="generation-number">0{generation.id}</div>
              <div className="generation-card-copy">
                <span>{generation.period}</span>
                <h3>{generation.name}</h3>
                <strong>{generation.title}</strong>
                <p>{generation.thesis}</p>
                <div>{generation.values.map((value) => <i key={value}>{value}</i>)}</div>
              </div>
              <div className="generation-details">
                <p>{generation.description}</p>
                <span>{generation.keyFigures.join(' · ')}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {view === 'world' && selectedRegion && (
        <div className="world-view">
          <div className="world-map-panel">
            <img src={selectedRegion.art} alt="" />
            <div className="world-map-wash" />
            <div className="map-grid-lines" aria-hidden="true" />
            {regions.map((region, index) => (
              <button
                key={region.id}
                className={`map-node node-${index + 1} ${region.id === selectedRegion.id ? 'active' : ''}`}
                onClick={() => setSelectedRegionId(region.id)}
              >
                <MapPin size={18} />
                <span>{region.name}</span>
              </button>
            ))}
            <div className="map-compass"><Compass size={48} /></div>
          </div>
          <aside className="region-dossier panel">
            <span className="eyebrow">REGION DOSSIER</span>
            <h3>{selectedRegion.name}</h3>
            <strong>{selectedRegion.subtitle}</strong>
            <p>{selectedRegion.description}</p>
            <div className="region-danger">
              <span><AlertTriangle size={15} /> 위험도</span>
              <div>{Array.from({ length: 5 }, (_, index) => <i className={index < selectedRegion.danger ? 'filled' : ''} key={index} />)}</div>
            </div>
            <dl>
              <div><dt>좌표</dt><dd>{selectedRegion.coordinates}</dd></div>
              <div><dt>핵심 태그</dt><dd>{selectedRegion.tags.join(' · ')}</dd></div>
            </dl>
          </aside>
        </div>
      )}
    </section>
  );
}
