import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Grid3X3,
  ImageIcon,
  Maximize2,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';

type TimelinePhase = 'origin' | 'entry' | 'campaign' | 'war' | 'aftermath' | 'legacy';

interface CharacterVariation {
  id: string;
  index: number;
  label: string;
  description: string;
  phase: TimelinePhase;
  spoilerLevel: number;
  image: string;
}

interface CharacterAssetRecord {
  id: string;
  name: string;
  romanized: string;
  generation: string;
  role: string;
  weapon: string;
  accent: string;
  tags: string[];
  thumbnail: string;
  contactSheet: string;
  sourceAtlas?: string;
  aiEnhanced?: boolean;
  variations: CharacterVariation[];
}

interface CharacterAssetManifest {
  characterCount: number;
  variationCount: number;
  totalAssetCount: number;
  aiEnhancedCharacterCount?: number;
  characters: CharacterAssetRecord[];
}

const phaseFilters: Array<{ id: 'all' | TimelinePhase; label: string; range: string }> = [
  { id: 'all', label: '전체 연대', range: '01–20' },
  { id: 'origin', label: '기원', range: '01–02' },
  { id: 'entry', label: '입단 초기', range: '03–06' },
  { id: 'campaign', label: '임무기', range: '07–12' },
  { id: 'war', label: '대전쟁', range: '13–16' },
  { id: 'aftermath', label: '전후', range: '17–18' },
  { id: 'legacy', label: '현재·유산', range: '19–20' },
];

const factionOrder = [
  '전체 인물',
  '프시케 제1기',
  '프시케 제2기',
  '프시케 제4기',
  '프시케 제5기',
  '프시케 제6기',
  '프시케 제7기',
  '대전쟁 세대',
  '체시 공화국',
  '제국 민간',
];

function getFactionGroup(character: CharacterAssetRecord) {
  const generationMatch = character.generation.match(/프시케 제[1-7]기/);
  if (generationMatch) return generationMatch[0];
  if (character.generation.includes('체시')) return '체시 공화국';
  if (character.generation.includes('민간')) return '제국 민간';
  return '대전쟁 세대';
}

export function CharacterTimelineGallery() {
  const [manifest, setManifest] = useState<CharacterAssetManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState('raon');
  const [selectedVariationId, setSelectedVariationId] = useState('candidate');
  const [faction, setFaction] = useState('전체 인물');
  const [phase, setPhase] = useState<'all' | TimelinePhase>('all');
  const [query, setQuery] = useState('');
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [preview, setPreview] = useState<{ image: string; title: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/art/characters/manifest.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Character asset manifest unavailable');
        return response.json() as Promise<CharacterAssetManifest>;
      })
      .then((data) => setManifest(data))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  const filteredCharacters = useMemo(() => {
    if (!manifest) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return manifest.characters.filter((character) => {
      const factionMatches = faction === '전체 인물' || getFactionGroup(character) === faction;
      const queryMatches = !normalizedQuery || [
        character.name,
        character.romanized,
        character.generation,
        character.role,
        character.weapon,
        ...character.tags,
      ].join(' ').toLocaleLowerCase().includes(normalizedQuery);
      return factionMatches && queryMatches;
    });
  }, [faction, manifest, query]);

  const selectedCharacter = useMemo(() => {
    if (!manifest) return null;
    return manifest.characters.find((character) => character.id === selectedId) ?? manifest.characters[0] ?? null;
  }, [manifest, selectedId]);

  const visibleVariations = useMemo(() => {
    if (!selectedCharacter) return [];
    return selectedCharacter.variations.filter((variation) => phase === 'all' || variation.phase === phase);
  }, [phase, selectedCharacter]);

  const selectedVariation = useMemo(() => {
    if (!selectedCharacter) return null;
    const requestedVariation = selectedCharacter.variations.find((variation) => variation.id === selectedVariationId);
    if (requestedVariation && (phase === 'all' || requestedVariation.phase === phase)) return requestedVariation;
    return visibleVariations[0] ?? selectedCharacter.variations[0];
  }, [phase, selectedCharacter, selectedVariationId, visibleVariations]);

  const selectCharacter = (character: CharacterAssetRecord) => {
    setSelectedId(character.id);
    setSelectedVariationId(character.id === 'raon' ? 'candidate' : 'origin');
    setPhase('all');
  };

  const stepVariation = (direction: -1 | 1) => {
    if (!selectedCharacter || !selectedVariation) return;
    const currentIndex = selectedCharacter.variations.findIndex((variation) => variation.id === selectedVariation.id);
    const nextIndex = (currentIndex + direction + selectedCharacter.variations.length) % selectedCharacter.variations.length;
    setSelectedVariationId(selectedCharacter.variations[nextIndex].id);
  };

  if (loadError) {
    return (
      <div className="character-asset-error panel">
        <BookOpen size={30} />
        <h3>인물 원장을 불러오지 못했습니다.</h3>
        <p>에셋 매니페스트를 확인한 뒤 다시 시도해 주세요.</p>
      </div>
    );
  }

  if (!manifest || !selectedCharacter || !selectedVariation) {
    return (
      <div className="character-asset-loading panel" aria-live="polite">
        <Sparkles size={24} /> 48인의 시간축 에셋을 불러오는 중…
      </div>
    );
  }

  const selectedIsLocked = selectedVariation.spoilerLevel >= 3 && !showSpoilers;

  return (
    <div className="character-asset-experience">
      <div className="character-asset-summary panel">
        <div>
          <span className="eyebrow">CHARACTER TIMELINE ATLAS</span>
          <h3>48인 · 960종 시대별 그래픽 에셋</h3>
          <p>라미에게 선택되기 전부터 입단, 임무, 대전쟁, 전후와 유산까지 한 인물의 변화를 연속해서 확인합니다.</p>
        </div>
        <dl>
          <div><dt>인물</dt><dd>{manifest.characterCount}</dd></div>
          <div><dt>인물별</dt><dd>{manifest.variationCount}</dd></div>
          <div><dt>총 에셋</dt><dd>{manifest.totalAssetCount}</dd></div>
          <div><dt>신규 원화</dt><dd>{manifest.aiEnhancedCharacterCount ?? 0}</dd></div>
        </dl>
      </div>

      <div className="character-asset-toolbar panel">
        <label className="character-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·소속·무기·역할 검색" />
        </label>
        <div className="character-faction-filters" aria-label="세대 필터">
          {factionOrder.map((item) => (
            <button key={item} className={faction === item ? 'active' : ''} onClick={() => setFaction(item)}>{item}</button>
          ))}
        </div>
        <button className={`spoiler-toggle ${showSpoilers ? 'revealed' : ''}`} onClick={() => setShowSpoilers((value) => !value)}>
          {showSpoilers ? <Eye size={16} /> : <EyeOff size={16} />}
          {showSpoilers ? '스포일러 표시 중' : '후반부 잠금'}
        </button>
      </div>

      <div className="character-asset-layout">
        <aside className="character-roster panel">
          <div className="character-roster-heading">
            <div><Grid3X3 size={17} /><strong>인물 선택</strong></div>
            <span>{filteredCharacters.length} / {manifest.characterCount}</span>
          </div>
          <div className="character-roster-grid">
            {filteredCharacters.map((character) => (
              <button
                key={character.id}
                className={selectedCharacter.id === character.id ? 'active' : ''}
                onClick={() => selectCharacter(character)}
                style={{ '--character-accent': character.accent } as CSSProperties}
              >
                <img src={character.thumbnail} alt="" loading="lazy" />
                <span>{character.name}<small>{character.romanized}</small></span>
                {character.aiEnhanced && <Sparkles className="character-ai-mark" size={12} aria-label="신규 제작 원화" />}
              </button>
            ))}
          </div>
        </aside>

        <main className="character-timeline-stage panel" style={{ '--character-accent': selectedCharacter.accent } as CSSProperties}>
          <header className="character-profile-heading">
            <div>
              <span>{selectedCharacter.generation}</span>
              <h3>{selectedCharacter.name} <small>/ {selectedCharacter.romanized}</small></h3>
              <p>{selectedCharacter.role}</p>
            </div>
            <div className="character-profile-actions">
              <button onClick={() => setPreview({ image: selectedCharacter.contactSheet, title: `${selectedCharacter.name} 20종 전체 시트` })}>
                <ImageIcon size={16} /> 전체 시트
              </button>
              <button onClick={() => setPreview({ image: selectedVariation.image, title: `${selectedCharacter.name} · ${selectedVariation.label}` })}>
                <Maximize2 size={16} /> 원본 보기
              </button>
            </div>
          </header>

          <div className={`character-focus-card ${selectedIsLocked ? 'spoiler-locked' : ''}`}>
            <img src={selectedVariation.image} alt={`${selectedCharacter.name} ${selectedVariation.label}`} />
            {selectedIsLocked && (
              <button onClick={() => setShowSpoilers(true)}>
                <EyeOff size={24} />
                <strong>후반부 기록 잠금</strong>
                <span>대전쟁과 유산 설정을 공개합니다.</span>
              </button>
            )}
            <button className="variation-step previous" onClick={() => stepVariation(-1)} aria-label="이전 변형"><ChevronLeft /></button>
            <button className="variation-step next" onClick={() => stepVariation(1)} aria-label="다음 변형"><ChevronRight /></button>
          </div>

          <div className="character-focus-meta">
            <div className="variation-index"><strong>{String(selectedVariation.index).padStart(2, '0')}</strong><span>/ 20</span></div>
            <div>
              <span>{phaseFilters.find((item) => item.id === selectedVariation.phase)?.label}</span>
              <h4>{selectedVariation.label}</h4>
              <p>{selectedVariation.description}</p>
            </div>
            <dl>
              <div><dt><Swords size={14} /> 전투 방식</dt><dd>{selectedCharacter.weapon}</dd></div>
              <div><dt><ShieldCheck size={14} /> 기록 등급</dt><dd>S{selectedVariation.spoilerLevel}</dd></div>
            </dl>
          </div>

          <div className="character-tags">
            {selectedCharacter.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>

          <div className="timeline-phase-tabs" aria-label="시대 단계">
            {phaseFilters.map((item) => (
              <button key={item.id} className={phase === item.id ? 'active' : ''} onClick={() => setPhase(item.id)}>
                <span>{item.label}</span><small>{item.range}</small>
              </button>
            ))}
          </div>

          <div className="variation-strip">
            {visibleVariations.map((variation) => {
              const locked = variation.spoilerLevel >= 3 && !showSpoilers;
              return (
                <button
                  key={variation.id}
                  className={`${selectedVariation.id === variation.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => setSelectedVariationId(variation.id)}
                  title={`${variation.index}. ${variation.label}`}
                >
                  <img src={variation.image} alt="" loading="lazy" />
                  <span><strong>{String(variation.index).padStart(2, '0')}</strong>{variation.label}</span>
                  {locked && <EyeOff size={14} />}
                </button>
              );
            })}
          </div>
        </main>
      </div>

      {preview && (
        <div className="character-preview" role="dialog" aria-modal="true" aria-label={preview.title} onClick={() => setPreview(null)}>
          <button className="character-preview-close" onClick={() => setPreview(null)} aria-label="닫기"><X /></button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={preview.image} alt={preview.title} />
            <figcaption>{preview.title}</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
