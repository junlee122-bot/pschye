import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Database,
  FileCheck2,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  assetCategoryLabels,
  assetQualityLabels,
  formatAssetBytes,
  formatAssetProvenance,
  type AssetCatalogReport,
  type AssetQualityStatus,
} from '../data/assetCatalog';

const initialVisibleCount = 72;

function QualityIcon({ status }: { status: AssetQualityStatus }) {
  if (status === 'pass') return <Check size={14} />;
  if (status === 'fail') return <X size={14} />;
  return <AlertTriangle size={14} />;
}

export function AssetReviewLab() {
  const [catalog, setCatalog] = useState<AssetCatalogReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [quality, setQuality] = useState<'all' | AssetQualityStatus>('all');
  const [selectedId, setSelectedId] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/asset-catalog.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AssetCatalogReport>;
      })
      .then(setCatalog)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError('자산 원장을 불러오지 못했습니다. `pnpm assets:ledger`를 실행해 주세요.');
      });
    return () => controller.abort();
  }, []);

  const filteredEntries = useMemo(() => {
    if (!catalog) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return catalog.entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (quality !== 'all' && entry.quality.status !== quality) return false;
      if (!normalizedQuery) return true;
      return [
        entry.title,
        entry.collection,
        entry.variant,
        entry.runtimePath,
        entry.provenance,
      ].join(' ').toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [catalog, category, quality, query]);

  const selected = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedId],
  );

  const variants = useMemo(() => {
    if (!catalog || !selected) return [];
    return catalog.entries
      .filter((entry) => entry.category === selected.category && entry.collection === selected.collection)
      .slice(0, 30);
  }, [catalog, selected]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setVisibleCount(initialVisibleCount);
  };

  const updateCategory = (value: string) => {
    setCategory(value);
    setSelectedId('');
    setVisibleCount(initialVisibleCount);
  };

  const updateQuality = (value: 'all' | AssetQualityStatus) => {
    setQuality(value);
    setSelectedId('');
    setVisibleCount(initialVisibleCount);
  };

  if (loadError) {
    return (
      <div className="asset-review-empty panel">
        <AlertTriangle size={28} />
        <h3>자산 원장 연결 실패</h3>
        <p>{loadError}</p>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="asset-review-empty panel">
        <LoaderCircle className="asset-review-spinner" size={30} />
        <h3>2,103개 배포 자산 검사 중</h3>
        <p>해상도, 출처, 중복 해시와 바리에이션을 정리하고 있습니다.</p>
      </div>
    );
  }

  const categories = ['all', ...Object.keys(catalog.summary.categories)];

  return (
    <div className="asset-review-lab">
      <section className="asset-review-summary">
        <article>
          <PackageCheck size={19} />
          <span>실제 배포</span>
          <strong>{catalog.summary.shipped.toLocaleString()}</strong>
          <small>주소만 있는 파일과 분리</small>
        </article>
        <article>
          <ShieldCheck size={19} />
          <span>품질 통과</span>
          <strong>{catalog.summary.quality.pass.toLocaleString()}</strong>
          <small>해상도·용량·고유성 통과</small>
        </article>
        <article>
          <AlertTriangle size={19} />
          <span>검토 필요</span>
          <strong>{catalog.summary.quality.warn.toLocaleString()}</strong>
          <small>주로 생성 기록 보강 대상</small>
        </article>
        <article>
          <Database size={19} />
          <span>전체 용량</span>
          <strong>{formatAssetBytes(catalog.summary.totalBytes)}</strong>
          <small>SHA-256 기반 중복 추적</small>
        </article>
      </section>

      <section className="asset-review-toolbar panel">
        <label className="asset-review-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="인물, 장소, 장면, 파일 경로 검색"
          />
        </label>
        <label>
          <span>분류</span>
          <select value={category} onChange={(event) => updateCategory(event.target.value)}>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {assetCategoryLabels[entry] ?? entry} {entry === 'all' ? '' : `(${catalog.summary.categories[entry]})`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>품질</span>
          <select
            value={quality}
            onChange={(event) => updateQuality(event.target.value as 'all' | AssetQualityStatus)}
          >
            {(['all', 'pass', 'warn', 'fail'] as const).map((entry) => (
              <option key={entry} value={entry}>{assetQualityLabels[entry]}</option>
            ))}
          </select>
        </label>
        <strong>{filteredEntries.length.toLocaleString()}개</strong>
      </section>

      <div className="asset-review-workspace">
        <section className="asset-catalog-browser">
          <header>
            <div>
              <span>SHIPPED ASSET CATALOG</span>
              <h3>실제 게임 자산</h3>
            </div>
            <small>카드는 실제 런타임 파일만 표시합니다.</small>
          </header>

          <div className="asset-catalog-grid">
            {filteredEntries.slice(0, visibleCount).map((entry) => (
              <button
                className={`asset-catalog-card ${selected?.id === entry.id ? 'active' : ''}`}
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
              >
                <div className="asset-catalog-thumb">
                  <img src={entry.runtimePath} alt={`${entry.title} ${entry.variant}`} loading="lazy" />
                  <span className={`asset-quality-chip ${entry.quality.status}`}>
                    <QualityIcon status={entry.quality.status} />
                    {entry.quality.score}
                  </span>
                </div>
                <div>
                  <span>{assetCategoryLabels[entry.category] ?? entry.category}</span>
                  <strong>{entry.title}</strong>
                  <small>{entry.variant}</small>
                </div>
              </button>
            ))}
          </div>

          {visibleCount < filteredEntries.length && (
            <button
              className="asset-catalog-more"
              onClick={() => setVisibleCount((current) => current + initialVisibleCount)}
            >
              다음 {Math.min(initialVisibleCount, filteredEntries.length - visibleCount)}개 불러오기
            </button>
          )}
        </section>

        {selected && (
          <aside className="asset-inspector panel">
            <header>
              <div>
                <span>LIVE FILE INSPECTOR</span>
                <h3>{selected.title}</h3>
                <p>{selected.variant}</p>
              </div>
              <span className={`asset-quality-score ${selected.quality.status}`}>
                <QualityIcon status={selected.quality.status} />
                {selected.quality.score}
              </span>
            </header>

            <figure>
              <img src={selected.runtimePath} alt={`${selected.title} ${selected.variant} 원본`} />
              <figcaption>
                <span><PackageCheck size={14} /> 실제 배포 파일</span>
                <span><ImageIcon size={14} /> {selected.representation.toUpperCase()}</span>
              </figcaption>
            </figure>

            <section className="asset-inspector-meta">
              <div><span>해상도</span><strong>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : '판독 불가'}</strong></div>
              <div><span>용량</span><strong>{formatAssetBytes(selected.bytes)}</strong></div>
              <div><span>출처</span><strong>{formatAssetProvenance(selected.provenance)}</strong></div>
              <div><span>동일 해시</span><strong>{selected.duplicateCount}개 경로</strong></div>
            </section>

            <section className="asset-quality-gates">
              <header><FileCheck2 size={16} /><strong>품질 게이트</strong></header>
              {selected.quality.gates.map((gate) => (
                <div className={gate.status} key={gate.id}>
                  <QualityIcon status={gate.status} />
                  <span>{gate.label}</span>
                </div>
              ))}
            </section>

            <section className="asset-provenance-box">
              <span><Sparkles size={15} /> 자산 진실성</span>
              <p>{selected.sourceRecordId
                ? `원본 기록 ${selected.sourceRecordId}와 연결된 제공 자산입니다.`
                : '실제 파일은 확인됐지만 생성 프롬프트·모델·시드 기록은 아직 경로 규칙으로 추정합니다.'}</p>
              <code>{selected.runtimePath}</code>
              <small>SHA-256 {selected.sha256}</small>
            </section>

            {variants.length > 1 && (
              <section className="asset-variant-review">
                <header><Layers3 size={16} /><strong>동일 대상 바리에이션</strong><span>{variants.length}</span></header>
                <div>
                  {variants.map((entry) => (
                    <button
                      className={entry.id === selected.id ? 'active' : ''}
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      title={entry.variant}
                    >
                      <img src={entry.runtimePath} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
