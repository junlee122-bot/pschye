import { useMemo, useState, type CSSProperties } from 'react';
import {
  BookOpenText,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Gamepad2,
  HeartHandshake,
  ImageIcon,
  Layers3,
  MapPin,
  Search,
  ShieldAlert,
  Sparkles,
  Swords,
  UsersRound,
} from 'lucide-react';
import {
  getEpisodeScenes,
  getGrandStoryEpisode,
  getSagaEpisodes,
  grandStoryCanonStatusLabels,
  grandStoryEpisodeCount,
  grandStorySagas,
  grandStorySceneCount,
  grandStoryScenes,
  type GrandStorySagaId,
  type GrandStorySceneMode,
} from '../data/grandStory';
import {
  getStoryBeatAsset,
  getStoryEpisodeAsset,
  getStoryEpisodeThumbnail,
  storySceneVariantLabels,
  type StorySceneAssetVariant,
} from '../data/sceneAssets';

const modeLabels: Record<GrandStorySceneMode, string> = {
  dialogue: '대화',
  exploration: '탐색',
  investigation: '조사',
  training: '수련',
  battle: '전투',
  stealth: '잠입',
  command: '선택',
  memory: '기억',
  bond: '관계',
  confrontation: '대립',
};

const pathLabels = {
  compassion: '연민',
  insight: '통찰',
  resolve: '결의',
} as const;

const modeOptions = Object.entries(modeLabels) as Array<[GrandStorySceneMode, string]>;
const visualVariants = Object.entries(storySceneVariantLabels) as Array<[StorySceneAssetVariant, string]>;

export function StoryAtlas() {
  const firstSaga = grandStorySagas[0];
  const firstEpisode = firstSaga ? getSagaEpisodes(firstSaga.id)[0] : undefined;
  const [selectedSagaId, setSelectedSagaId] = useState<GrandStorySagaId>(firstSaga?.id ?? 'petal-before-bloom');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(firstEpisode?.id ?? 'village-bell');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'all' | GrandStorySceneMode>('all');
  const [visualVariant, setVisualVariant] = useState<StorySceneAssetVariant>('explore');

  const selectedSaga = grandStorySagas.find((saga) => saga.id === selectedSagaId) ?? firstSaga;
  const sagaEpisodes = selectedSaga ? getSagaEpisodes(selectedSaga.id) : [];
  const selectedEpisode = getGrandStoryEpisode(selectedEpisodeId) ?? sagaEpisodes[0];
  const selectedScenes = selectedEpisode ? getEpisodeScenes(selectedEpisode.id) : [];

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');

    if (!normalizedQuery && mode === 'all') return [];

    return grandStoryScenes
      .filter((scene) => {
        if (mode !== 'all' && scene.mode !== mode) return false;
        if (!normalizedQuery) return true;

        const searchable = [
          scene.title,
          scene.episodeTitle,
          scene.chapter,
          scene.summary,
          scene.location,
          scene.viewpoint,
          ...scene.cast,
        ].join(' ').toLocaleLowerCase('ko-KR');

        return searchable.includes(normalizedQuery);
      })
      .slice(0, 48);
  }, [mode, query]);

  const hasSearch = query.trim().length > 0 || mode !== 'all';

  function chooseSaga(sagaId: GrandStorySagaId) {
    const nextEpisode = getSagaEpisodes(sagaId)[0];
    setSelectedSagaId(sagaId);
    setVisualVariant('explore');
    if (nextEpisode) setSelectedEpisodeId(nextEpisode.id);
  }

  function chooseScene(sceneId: string) {
    const scene = grandStoryScenes.find((entry) => entry.id === sceneId);
    if (!scene) return;
    setSelectedSagaId(scene.sagaId);
    setSelectedEpisodeId(scene.episodeId);
    setQuery('');
    setMode('all');
  }

  return (
    <div className="story-atlas">
      <section className="story-atlas-hero panel">
        <div>
          <span className="eyebrow"><BookOpenText size={14} /> RAON POV / GRAND STORY ATLAS</span>
          <h3>516개 장면 제작 원장</h3>
          <p>전체 서사의 각색 초안입니다. 플레이 완료 장면 수나 정사 확정 범위를 뜻하지 않습니다.</p>
        </div>
        <div className="story-atlas-metrics" aria-label="대서사 규모">
          <span><b>{grandStorySagas.length}</b> 사가</span>
          <span><b>{grandStoryEpisodeCount}</b> 에피소드</span>
          <span><b>{grandStorySceneCount}</b> 장면</span>
          <span><b>1</b> 라온 시점</span>
        </div>
      </section>

      <section className="story-atlas-toolbar panel" aria-label="장면 검색과 필터">
        <label className="story-search">
          <Search size={17} />
          <span className="sr-only">장면 검색</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="인물, 장소, 사건, 장면 제목 검색"
          />
        </label>
        <label className="story-mode-filter">
          <Filter size={15} />
          <span className="sr-only">장면 유형</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as 'all' | GrandStorySceneMode)}>
            <option value="all">모든 플레이 유형</option>
            {modeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <div className="story-atlas-legend">
          <span><Gamepad2 size={14} /> 현재: 라온 직접 선택</span>
          <span><Eye size={14} /> 과거: 라온의 기억 관찰</span>
        </div>
      </section>

      {hasSearch ? (
        <section className="story-search-results panel" aria-live="polite">
          <header>
            <div>
              <span className="eyebrow">SEARCHED SCENES</span>
              <h3>{searchResults.length}개 장면 발견</h3>
            </div>
            <button onClick={() => { setQuery(''); setMode('all'); }}>검색 닫기</button>
          </header>
          {searchResults.length > 0 ? (
            <div className="story-search-grid">
              {searchResults.map((scene) => (
                <button className="story-search-card" key={scene.id} onClick={() => chooseScene(scene.id)}>
                  <img src={getStoryEpisodeThumbnail(scene.episodeId)} alt="" loading="lazy" />
                  <span>SCENE {String(scene.globalOrder).padStart(3, '0')} · {modeLabels[scene.mode]}</span>
                  <strong>{scene.title}</strong>
                  <p>{scene.summary}</p>
                  <i>{scene.episodeTitle} <ChevronRight size={13} /></i>
                </button>
              ))}
            </div>
          ) : <p className="story-empty">조건에 맞는 장면이 없습니다. 다른 인물명이나 플레이 유형을 선택해 보세요.</p>}
        </section>
      ) : (
        <>
          <nav className="story-saga-rail" aria-label="사가 공개 순서">
            {grandStorySagas.map((saga) => (
              <button
                key={saga.id}
                className={saga.id === selectedSaga?.id ? 'active' : ''}
                style={{ '--saga-color': saga.color } as CSSProperties}
                onClick={() => chooseSaga(saga.id)}
              >
                <span>{String(saga.publicOrder).padStart(2, '0')}</span>
                <div><strong>{saga.title}</strong><small>{saga.subtitle}</small></div>
                {saga.controller === 'raon-present' ? <Gamepad2 size={17} /> : <Eye size={17} />}
              </button>
            ))}
          </nav>

          {selectedSaga && selectedEpisode && (
            <div className="story-atlas-layout">
              <aside className="story-episode-index panel">
                <header style={{ '--saga-color': selectedSaga.color } as CSSProperties}>
                  <span>{selectedSaga.period}</span>
                  <h3>{selectedSaga.title}</h3>
                  <p>{selectedSaga.promise}</p>
                </header>
                <div className="story-episode-scroll">
                  {sagaEpisodes.map((entry) => (
                    <button
                      key={entry.id}
                      className={entry.id === selectedEpisode.id ? 'active' : ''}
                      onClick={() => { setSelectedEpisodeId(entry.id); setVisualVariant('explore'); }}
                    >
                      <span>{String(entry.order).padStart(2, '0')}</span>
                      <div><small>{entry.chapter}</small><strong>{entry.title}</strong></div>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </aside>

              <main className="story-episode-dossier">
                <section className="story-episode-visual panel">
                  <img
                    src={getStoryEpisodeAsset(selectedEpisode.id, visualVariant)}
                    alt={`${selectedEpisode.title} ${storySceneVariantLabels[visualVariant]} 장면`}
                  />
                  <div className="story-visual-overlay">
                    <span><ImageIcon size={14} /> EPISODE VISUAL ARCHIVE</span>
                    <strong>{selectedEpisode.location}</strong>
                    <small>{selectedEpisode.time}</small>
                  </div>
                  <div className="story-visual-switcher" aria-label="장면 연출 변경">
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
                <section className="story-episode-header panel" style={{ '--saga-color': selectedSaga.color } as CSSProperties}>
                  <div className="story-episode-title">
                    <span className="canon-status">{grandStoryCanonStatusLabels[selectedEpisode.canonStatus]}</span>
                    <span>{selectedEpisode.chapter} · EPISODE {String(selectedEpisode.order).padStart(2, '0')}</span>
                    <h3>{selectedEpisode.title}</h3>
                    <p>{selectedEpisode.theme}</p>
                    <p className="canon-notice">{selectedEpisode.canonNotice}</p>
                  </div>
                  <div className="story-episode-meta">
                    <span><Clock3 size={14} /> {selectedEpisode.time}</span>
                    <span><MapPin size={14} /> {selectedEpisode.location}</span>
                    <span><UsersRound size={14} /> {selectedEpisode.cast.join(' · ')}</span>
                    <span><Eye size={14} /> {selectedEpisode.viewpoint}</span>
                  </div>
                  <div className="story-hidden-question">
                    <ShieldAlert size={18} />
                    <div><span>이 사가가 숨긴 질문</span><p>{selectedSaga.hiddenQuestion}</p></div>
                  </div>
                </section>

                <section className="story-scene-list" aria-label={`${selectedEpisode.title} 여섯 장면`}>
                  {selectedScenes.map((scene) => (
                    <article className={`story-scene-card mode-${scene.mode}`} key={scene.id}>
                      <div className="story-scene-number">
                        <span>{String(scene.globalOrder).padStart(3, '0')}</span>
                        <small>{scene.localOrder}/6</small>
                      </div>
                      <div className="story-scene-art">
                        <img
                          src={getStoryBeatAsset(scene.episodeId, scene.localOrder)}
                          alt={`${scene.title} 장면 배경`}
                          loading="lazy"
                        />
                        <span>{modeLabels[scene.mode]}</span>
                      </div>
                      <div className="story-scene-copy">
                        <header>
                          <span>{modeLabels[scene.mode]}</span>
                          <strong>{scene.title}</strong>
                        </header>
                        <p>{scene.summary}</p>
                        <dl>
                          <div><dt><Swords size={13} /> 플레이 목표</dt><dd>{scene.playerGoal}</dd></div>
                          <div><dt><Layers3 size={13} /> 연결</dt><dd>{scene.continuity}</dd></div>
                        </dl>
                        {scene.choices && scene.choicePrompt && (
                          <div className="story-choice-block">
                            <span><Sparkles size={14} /> 라온의 선택</span>
                            <strong>{scene.choicePrompt}</strong>
                            <div>
                              {scene.choices.map((choice) => (
                                <p className={choice.path} key={choice.path}>
                                  <HeartHandshake size={14} />
                                  <b>{pathLabels[choice.path]}</b>
                                  <span>{choice.line}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </section>
              </main>
            </div>
          )}
        </>
      )}
    </div>
  );
}
