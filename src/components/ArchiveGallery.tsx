import { useMemo, useState } from 'react';
import { Cuboid, Images, Maximize2, PackageSearch, Search, Sparkles, UsersRound } from 'lucide-react';
import { archiveAssets } from '../data/lore';
import type { ArchiveAsset } from '../types';
import { AssetReviewLab } from './AssetReviewLab';
import { CharacterTimelineGallery } from './CharacterTimelineGallery';
import { ImageLightbox } from './ImageLightbox';
import { ModelReviewLab } from './ModelReviewLab';

type ArchiveMode = 'timeline' | 'originals' | 'review' | 'models';

export function ArchiveGallery() {
  const [mode, setMode] = useState<ArchiveMode>(() => {
    const requestedMode = new URLSearchParams(window.location.search).get('archive') as ArchiveMode | null;
    return requestedMode && ['timeline', 'originals', 'review', 'models'].includes(requestedMode)
      ? requestedMode
      : 'timeline';
  });
  const [selected, setSelected] = useState<ArchiveAsset | null>(null);
  const [category, setCategory] = useState<'all' | ArchiveAsset['category']>('all');
  const [query, setQuery] = useState('');
  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return archiveAssets.filter((asset) => {
      const categoryMatches = category === 'all' || asset.category === category;
      const textMatches = !normalizedQuery || [asset.title, asset.subtitle, ...asset.tags]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
      return categoryMatches && textMatches;
    });
  }, [category, query]);

  const filters: Array<{ id: 'all' | ArchiveAsset['category']; label: string }> = [
    { id: 'all', label: '전체 기록' },
    { id: 'character', label: '인물 설정화' },
    { id: 'generation', label: '기수 기록' },
    { id: 'history', label: '과거와 현재' },
    { id: 'mission', label: '작전 미술' },
  ];

  const selectMode = (nextMode: ArchiveMode) => {
    setMode(nextMode);
    const url = new URL(window.location.href);
    url.searchParams.set('archive', nextMode);
    window.history.replaceState(null, '', url);
  };

  return (
    <section className="archive-page page-enter">
      <header className="page-heading archive-page-heading">
        <div>
          <span className="eyebrow">PSYCHE CHARACTER ARCHIVE</span>
          <h2>인물 도감 · 시간축 아카이브</h2>
          <p>라온의 시선으로 만나는 인물들의 입단 전, 성장기, 대전쟁과 전후 모습을 하나의 기록 보관소로 통합했습니다.</p>
        </div>
        <div className="archive-mode-switch" aria-label="도감 보기 방식">
          <button className={mode === 'timeline' ? 'active' : ''} onClick={() => selectMode('timeline')}><UsersRound size={17} />48인 타임라인</button>
          <button className={mode === 'originals' ? 'active' : ''} onClick={() => selectMode('originals')}><Images size={17} />설정화 원본</button>
          <button className={mode === 'review' ? 'active' : ''} onClick={() => selectMode('review')}><PackageSearch size={17} />자산 검수실</button>
          <button className={mode === 'models' ? 'active' : ''} onClick={() => selectMode('models')}><Cuboid size={17} />3D 모델 검수실</button>
        </div>
      </header>

      {mode === 'timeline' && <CharacterTimelineGallery />}
      {mode === 'review' && <AssetReviewLab />}
      {mode === 'models' && <ModelReviewLab />}
      {mode === 'originals' && (
        <>
          <div className="archive-controls panel">
            <div className="archive-filters">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  className={category === filter.id ? 'active' : ''}
                  onClick={() => setCategory(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="인물·기수·작전 검색" /></label>
            <strong>{filteredAssets.length} / {archiveAssets.length}</strong>
          </div>

          <div className="archive-legend">
            <span><i className="provided" /> 제공 설정화</span>
            <span><i className="generated" /> 신규 제작 에셋</span>
          </div>

          <div className="archive-masonry">
            {filteredAssets.map((asset) => (
              <button
                className={`archive-tile ${asset.orientation} ${asset.source}`}
                key={asset.id}
                onClick={() => setSelected(asset)}
              >
                <img src={asset.image} alt="" loading="lazy" />
                <div className="archive-tile-shade" />
                <div className="archive-tile-copy">
                  <span>{asset.source === 'generated' && <Sparkles size={13} />}{asset.source === 'generated' ? 'NEW ART' : 'ARCHIVE'}</span>
                  <h3>{asset.title}</h3>
                  <p>{asset.subtitle}</p>
                </div>
                <Maximize2 className="tile-expand" size={18} />
              </button>
            ))}
          </div>
        </>
      )}

      {selected && <ImageLightbox asset={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
