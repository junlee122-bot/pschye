import { useState } from 'react';
import { BookOpenText, LockKeyhole, Search } from 'lucide-react';
import { getPlayerMemories, getPlayerTestimonies } from '../game/storyAccess';
import type { CampaignProfile } from '../types';

export function Chronicle({ profile }: { profile: CampaignProfile }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'memories' | 'testimonies'>('memories');
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  const memories = getPlayerMemories(profile).filter((entry) => [entry.title, entry.summary, entry.location, entry.choice ?? ''].join(' ').toLocaleLowerCase('ko-KR').includes(normalized));
  const testimony = getPlayerTestimonies(profile).filter((entry) => [entry.title, entry.speaker, entry.text].join(' ').toLocaleLowerCase('ko-KR').includes(normalized));
  return <section className="chronicle-page page-enter player-records">
    <header className="page-heading"><div><span className="eyebrow">RAON'S RECORD</span><h2>지나온 기억</h2><p>직접 겪은 장면과 돌아온 전장에서 확보한 증언을 다시 읽습니다.</p></div></header>
    <div className="record-toolbar panel">
      <div className="segmented-control" aria-label="기록 종류">
        <button className={view === 'memories' ? 'active' : ''} onClick={() => setView('memories')} aria-pressed={view === 'memories'}>여정 기록</button>
        <button className={view === 'testimonies' ? 'active' : ''} onClick={() => setView('testimonies')} aria-pressed={view === 'testimonies'}>확보한 증언</button>
      </div>
      <label className="search-field"><Search size={16} /><span className="sr-only">공개된 기록 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공개된 기록 안에서 검색" /></label>
    </div>
    {view === 'memories' ? <div className="player-memory-grid">
      {memories.map((entry) => <article className="panel player-memory-card" key={entry.id}>
        <img src={entry.image} alt="" loading="lazy" /><div><span className="eyebrow">{entry.period} · {entry.location}</span><h3>{entry.title}</h3><p>{entry.summary}</p>{entry.choice && <blockquote>{entry.choice}</blockquote>}</div>
      </article>)}
      {memories.length === 0 && <div className="empty-state"><BookOpenText size={28} /><h3>아직 남겨진 기록이 없습니다.</h3><p>{normalized ? '공개된 기록에서 검색어를 찾지 못했습니다.' : '여정에서 장면을 마치면 이곳에 기록됩니다.'}</p></div>}
    </div> : <div className="player-memory-grid">
      {testimony.map((entry) => <article className="panel player-testimony" key={entry.id}><span className="eyebrow">{entry.title}</span><h3>{entry.speaker}</h3><blockquote>{entry.text}</blockquote></article>)}
      {testimony.length === 0 && <div className="empty-state"><LockKeyhole size={28} /><h3>확보한 증언이 없습니다.</h3><p>{normalized ? '확보한 증언에서 검색어를 찾지 못했습니다.' : '전투에서 특정 기술로 현장 증언을 이끌어 낸 뒤 승리하면 기록됩니다. 완료한 작전에서도 다시 확보할 수 있습니다.'}</p></div>}
    </div>}
  </section>;
}
