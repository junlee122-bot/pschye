import { useMemo, useState, type CSSProperties } from 'react';
import {
  Archive,
  BookOpenText,
  ChevronRight,
  Clock3,
  Compass,
  Crosshair,
  Eye,
  ImageIcon,
  Layers3,
  MapPinned,
  Route,
  Search,
  Sparkles,
  Swords,
  UsersRound,
} from 'lucide-react';
import { grandStorySagas, type GrandStorySagaId } from '../data/grandStory';
import {
  worldLocationCategories,
  worldLocationCategoryById,
  worldLocationCount,
  worldLocations,
  worldLocationVisualCount,
  type WorldLocation,
  type WorldLocationCategory,
} from '../data/locations';
import { storySceneVariantLabels, type StorySceneAssetVariant } from '../data/sceneAssets';

type CategoryFilter = 'all' | WorldLocationCategory;
type SagaFilter = 'all' | GrandStorySagaId;

const visualVariants = Object.entries(storySceneVariantLabels) as Array<[StorySceneAssetVariant, string]>;

function getLocationVisual(location: WorldLocation, episodeId: string) {
  return location.visuals.find((visual) => visual.episodeId === episodeId) ?? location.visuals[0];
}

export function LocationAtlas() {
  const firstLocation = worldLocations[0];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sagaId, setSagaId] = useState<SagaFilter>('all');
  const [selectedLocationId, setSelectedLocationId] = useState(firstLocation?.id ?? '');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(firstLocation?.primaryEpisodeId ?? '');
  const [visualVariant, setVisualVariant] = useState<StorySceneAssetVariant>('explore');

  const filteredLocations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');

    return worldLocations.filter((location) => {
      if (category !== 'all' && location.category !== category) return false;
      if (sagaId !== 'all' && !location.episodes.some((entry) => entry.sagaId === sagaId)) return false;
      if (normalizedQuery && !location.searchText.includes(normalizedQuery)) return false;
      return true;
    });
  }, [category, query, sagaId]);

  const selectedLocation = filteredLocations.find((location) => location.id === selectedLocationId)
    ?? worldLocations.find((location) => location.id === selectedLocationId)
    ?? filteredLocations[0]
    ?? firstLocation;
  const selectedEpisode = selectedLocation?.episodes.find((entry) => entry.id === selectedEpisodeId)
    ?? selectedLocation?.episodes[0];
  const selectedVisual = selectedLocation && selectedEpisode
    ? getLocationVisual(selectedLocation, selectedEpisode.id)
    : undefined;
  const selectedCategory = selectedLocation
    ? worldLocationCategoryById[selectedLocation.category]
    : worldLocationCategories[0];

  const categoryCounts = useMemo(() => Object.fromEntries(
    worldLocationCategories.map((entry) => [
      entry.id,
      worldLocations.filter((location) => location.category === entry.id).length,
    ]),
  ) as Record<WorldLocationCategory, number>, []);

  function chooseLocation(location: WorldLocation) {
    setSelectedLocationId(location.id);
    setSelectedEpisodeId(location.primaryEpisodeId);
    setVisualVariant('explore');
  }

  function chooseCategory(nextCategory: CategoryFilter) {
    setCategory(nextCategory);
    const nextLocation = worldLocations.find((location) => (
      nextCategory === 'all' || location.category === nextCategory
    ) && (
      sagaId === 'all' || location.episodes.some((entry) => entry.sagaId === sagaId)
    ));
    if (nextLocation) chooseLocation(nextLocation);
  }

  if (!selectedLocation || !selectedEpisode || !selectedVisual || !selectedCategory) return null;

  return (
    <div className="location-atlas">
      <section
        className="location-atlas-hero panel"
        style={{
          '--location-accent': selectedCategory.accent,
          '--location-cover': `url("${selectedCategory.cover}")`,
        } as CSSProperties}
      >
        <div className="location-atlas-hero-copy">
          <span className="eyebrow"><MapPinned size={14} /> WORLD LOCATION ARCHIVE</span>
          <h3>프시케 세계의 모든 장소를 직접 탐색하십시오</h3>
          <p>
            라온의 고향에서 체시 수도, 저주받은 땅과 빛의 분화구까지 모든 장소를
            탐험·대화·전투·전후의 네 시점과 여섯 장면으로 기록했습니다.
          </p>
        </div>
        <div className="location-atlas-metrics" aria-label="장소 아카이브 규모">
          <span><b>{worldLocationCount}</b> 고유 장소</span>
          <span><b>{worldLocationVisualCount}</b> 장소 비주얼</span>
          <span><b>{worldLocationCategories.length}</b> 권역 분류</span>
          <span><b>{grandStorySagas.length}</b> 시대 구간</span>
        </div>
      </section>

      <section className="location-atlas-toolbar panel" aria-label="장소 검색과 필터">
        <label className="location-search">
          <Search size={17} />
          <span className="sr-only">장소 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="장소, 인물, 사건, 시대 검색"
          />
        </label>
        <label className="location-saga-filter">
          <Archive size={15} />
          <span className="sr-only">시대 구간</span>
          <select value={sagaId} onChange={(event) => setSagaId(event.target.value as SagaFilter)}>
            <option value="all">모든 시대 구간</option>
            {grandStorySagas.map((saga) => <option value={saga.id} key={saga.id}>{saga.title}</option>)}
          </select>
        </label>
        <div className="location-atlas-coverage">
          <Sparkles size={15} />
          누락 없이 전체 스토리 장소를 연결했습니다.
        </div>
      </section>

      <nav className="location-category-rail" aria-label="장소 권역">
        <button
          className={category === 'all' ? 'active' : ''}
          onClick={() => chooseCategory('all')}
          style={{ '--category-accent': '#d4b879' } as CSSProperties}
        >
          <Compass size={18} />
          <span>전체 권역</span>
          <b>{worldLocationCount}</b>
        </button>
        {worldLocationCategories.map((entry) => (
          <button
            key={entry.id}
            className={category === entry.id ? 'active' : ''}
            onClick={() => chooseCategory(entry.id)}
            style={{ '--category-accent': entry.accent } as CSSProperties}
          >
            <MapPinned size={18} />
            <span>{entry.label}</span>
            <b>{categoryCounts[entry.id]}</b>
          </button>
        ))}
      </nav>

      <div className="location-atlas-layout">
        <aside className="location-index panel">
          <header>
            <div>
              <span>DISCOVERED LOCATIONS</span>
              <h3>{filteredLocations.length}개 장소</h3>
            </div>
            <small>{query.trim() ? '검색 결과' : '제작 초안 순서'}</small>
          </header>
          <div className="location-index-scroll">
            {filteredLocations.map((location, index) => (
              <button
                key={location.id}
                className={location.id === selectedLocation.id ? 'active' : ''}
                onClick={() => chooseLocation(location)}
                style={{ '--location-accent': location.accent } as CSSProperties}
              >
                <img src={location.visuals[0].thumbnail} alt="" loading="lazy" />
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <small>{location.categoryLabel} · {location.episodeCount}개 기록</small>
                  <strong>{location.name}</strong>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
            {filteredLocations.length === 0 && (
              <p className="location-index-empty">조건에 맞는 장소가 없습니다. 권역이나 검색어를 바꿔보십시오.</p>
            )}
          </div>
        </aside>

        <main className="location-dossier">
          <section
            className="location-visual panel"
            style={{ '--location-accent': selectedLocation.accent } as CSSProperties}
          >
            <img
              src={selectedVisual.variants[visualVariant]}
              alt={`${selectedLocation.name} ${storySceneVariantLabels[visualVariant]} 비주얼`}
            />
            <div className="location-visual-vignette" />
            <div className="location-visual-title">
              <span><ImageIcon size={14} /> LOCATION VISUAL SET · {selectedLocation.visualCount} ASSETS</span>
              <h3>{selectedLocation.name}</h3>
              <p>{selectedEpisode.time}</p>
            </div>
            <div className="location-visual-switcher" aria-label="장소 연출 변경">
              {visualVariants.map(([value, label]) => (
                <button
                  key={value}
                  className={visualVariant === value ? 'active' : ''}
                  onClick={() => setVisualVariant(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section
            className="location-dossier-header panel"
            style={{ '--location-accent': selectedLocation.accent } as CSSProperties}
          >
            <div className="location-dossier-title">
              <span>{selectedCategory.englishLabel}</span>
              <h3>{selectedLocation.name}</h3>
              <p>{selectedLocation.themes.join(' · ')}</p>
            </div>
            <dl className="location-dossier-meta">
              <div><dt><Clock3 size={14} /> 최초 기록</dt><dd>{selectedLocation.firstTime}</dd></div>
              <div><dt><BookOpenText size={14} /> 서사 구간</dt><dd>{selectedLocation.firstSagaTitle}</dd></div>
              <div><dt><UsersRound size={14} /> 주요 인물</dt><dd>{selectedLocation.cast.join(' · ')}</dd></div>
              <div><dt><Layers3 size={14} /> 제작 규모</dt><dd>{selectedLocation.sceneCount}개 장면 · {selectedLocation.visualCount}개 비주얼</dd></div>
            </dl>
            <div className="location-category-note">
              <MapPinned size={18} />
              <div><strong>{selectedCategory.label}</strong><p>{selectedCategory.description}</p></div>
            </div>
          </section>

          {selectedLocation.episodes.length > 1 && (
            <section className="location-episode-links panel">
              <header>
                <span className="eyebrow">SAME PLACE / DIFFERENT MEMORY</span>
                <h3>이 장소에 겹쳐진 기록</h3>
              </header>
              <div>
                {selectedLocation.episodes.map((episode) => (
                  <button
                    key={episode.id}
                    className={episode.id === selectedEpisode.id ? 'active' : ''}
                    onClick={() => { setSelectedEpisodeId(episode.id); setVisualVariant('explore'); }}
                  >
                    <span>{episode.chapter}</span>
                    <strong>{episode.title}</strong>
                    <small>{episode.time}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="location-beat-gallery panel">
            <header>
              <div>
                <span className="eyebrow"><Route size={14} /> SIX-SCENE EXPLORATION LOOP</span>
                <h3>{selectedEpisode.title}</h3>
              </div>
              <p>{selectedEpisode.theme}</p>
            </header>
            <div className="location-beat-grid">
              {selectedEpisode.scenes.map((scene, index) => (
                <article key={scene.id}>
                  <div className="location-beat-art">
                    <img src={selectedVisual.beats[index]} alt="" loading="lazy" />
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div>
                    <span>{scene.mode.toUpperCase()}</span>
                    <strong>{scene.title}</strong>
                    <p>{scene.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="location-gameplay-readout panel">
            <div>
              <span><Eye size={16} /> 탐험</span>
              <strong>랜드마크와 동선을 읽고 숨은 기록을 찾습니다.</strong>
            </div>
            <div>
              <span><UsersRound size={16} /> 관계</span>
              <strong>{selectedEpisode.cast.join(' · ')}의 대화와 반응이 장소 기억에 남습니다.</strong>
            </div>
            <div>
              <span><Swords size={16} /> 전투</span>
              <strong>엄폐·고저차·퇴로가 전투 선택과 생환 조건을 바꿉니다.</strong>
            </div>
            <div>
              <span><Crosshair size={16} /> 후속 변화</span>
              <strong>같은 장소도 사건 전후의 상태와 시대에 따라 다시 구성됩니다.</strong>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
