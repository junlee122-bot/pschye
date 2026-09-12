import { useState } from 'react';
import { Images, Search } from 'lucide-react';
import { getPlayerCharacters, getPlayerMemories } from '../game/storyAccess';
import type { ArchiveAsset, CampaignProfile } from '../types';
import { ImageLightbox } from './ImageLightbox';

export function PlayerArchive({ profile }: { profile: CampaignProfile }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const assets: ArchiveAsset[] = [
    ...getPlayerCharacters(profile).map((character): ArchiveAsset => ({
      id: `portrait-${character.id}`, title: character.name, subtitle: character.epithet,
      image: character.art, category: 'character', orientation: 'portrait', source: 'provided', tags: [],
    })),
    ...getPlayerMemories(profile).map((memory): ArchiveAsset => ({
      id: memory.id, title: memory.title, subtitle: memory.location,
      image: memory.image, category: 'mission', orientation: 'landscape', source: 'generated', tags: [],
    })),
  ];
  const selected = assets.find((asset) => asset.id === selectedId);
  const filtered = assets.filter((asset) => `${asset.title} ${asset.subtitle}`.toLocaleLowerCase('ko-KR').includes(query.trim().toLocaleLowerCase('ko-KR')));
  return <section className="archive-page page-enter player-records">
    <header className="page-heading"><div><span className="eyebrow">JOURNEY ALBUM</span><h2>여정 화첩</h2><p>만난 사람과 지나온 장소의 모습을 모았습니다.</p></div></header>
    <label className="search-field panel"><Search size={16} /><span className="sr-only">화첩 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공개된 인물과 장소 검색" /></label>
    <div className="player-album-grid">{filtered.map((asset) => <button className="panel player-album-card" key={asset.id} onClick={() => setSelectedId(asset.id)}><img src={asset.image} alt="" loading="lazy" /><strong>{asset.title}</strong><span>{asset.subtitle}</span></button>)}</div>
    {!filtered.length && <div className="empty-state"><Images size={28} /><h3>공개된 그림을 찾지 못했습니다.</h3></div>}
    {selected && <ImageLightbox asset={selected} onClose={() => setSelectedId(null)} />}
  </section>;
}
