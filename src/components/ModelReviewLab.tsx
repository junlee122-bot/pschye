import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  CircleGauge,
  Cuboid,
  LoaderCircle,
  Pause,
  Play,
  RefreshCcw,
  Rotate3D,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react';
import { loadCharacterFidelityReport, loadRuntimeModelCatalog } from '../data/modelCatalog';
import type { CharacterFidelityReport, RuntimeModelCatalog, RuntimeModelRecord } from '../data/modelCatalog';

type StudioPreset = 'neutral' | 'dawn' | 'void';

interface ModelViewerElement extends HTMLElement {
  play: () => void;
  pause: () => void;
}

const studioPresets: Record<StudioPreset, {
  label: string;
  exposure: string;
  shadow: string;
  className: string;
}> = {
  neutral: { label: '중립 스튜디오', exposure: '1.05', shadow: '1.15', className: 'neutral' },
  dawn: { label: '황금빛', exposure: '1.18', shadow: '.92', className: 'dawn' },
  void: { label: '실루엣', exposure: '.72', shadow: '1.35', className: 'void' },
};

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function ModelCard({
  model,
  active,
  onSelect,
}: {
  model: RuntimeModelRecord;
  active: boolean;
  onSelect: () => void;
}) {
  const pipelineLabel = model.productionTier.includes('blender-production')
    ? 'Blender 프로덕션 후보'
    : model.productionTier.includes('blender-rigged')
      ? 'Blender 리깅 파일럿'
    : model.status === 'review'
      ? 'AI 메시 검수'
      : '절차형 프록시';
  return (
    <button
      className={`model-review-card ${active ? 'active' : ''}`}
      data-model-id={model.id}
      data-model-status={model.status}
      onClick={onSelect}
    >
      <img src={model.thumbnail} alt="" />
      <span>
        <strong>{model.characterName}</strong>
        <small>{pipelineLabel} · {model.stage}</small>
      </span>
      <i>{model.triangles.toLocaleString()} tris</i>
    </button>
  );
}

export function ModelReviewLab() {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [catalog, setCatalog] = useState<RuntimeModelCatalog | null>(null);
  const [fidelity, setFidelity] = useState<CharacterFidelityReport | null>(null);
  const [viewerReady, setViewerReady] = useState(() => Boolean(customElements.get('model-viewer')));
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [preset, setPreset] = useState<StudioPreset>('neutral');
  const [viewerRevision, setViewerRevision] = useState(0);
  const [animationName, setAnimationName] = useState('');
  const [animationPlaying, setAnimationPlaying] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      loadRuntimeModelCatalog(controller.signal),
      loadCharacterFidelityReport(controller.signal),
    ])
      .then(([nextCatalog, nextFidelity]) => {
        setCatalog(nextCatalog);
        setFidelity(nextFidelity);
        setSelectedId((current) => current || nextCatalog.models[0]?.id || '');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : '3D 모델 카탈로그 오류');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (viewerReady) return undefined;
    let active = true;
    import('@google/model-viewer')
      .then(() => customElements.whenDefined('model-viewer'))
      .then(() => {
        if (active) setViewerReady(true);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '3D 뷰어 초기화 오류');
      });
    return () => {
      active = false;
    };
  }, [viewerReady]);

  const selected = useMemo(
    () => catalog?.models.find((model) => model.id === selectedId) ?? catalog?.models[0],
    [catalog, selectedId],
  );
  const selectedFidelity = useMemo(
    () => fidelity?.results.find((result) => result.characterId === selected?.characterId),
    [fidelity, selected?.characterId],
  );
  const reviewCount = useMemo(
    () => catalog?.models.filter((model) => model.status === 'review').length ?? 0,
    [catalog],
  );
  const studio = studioPresets[preset];
  const animationNames = useMemo(
    () => selected?.blenderPilot?.animationNames ?? [],
    [selected?.blenderPilot?.animationNames],
  );

  useEffect(() => {
    const nextAnimation = animationNames.includes('idle') ? 'idle' : animationNames[0] ?? '';
    setAnimationName(nextAnimation);
    setAnimationPlaying(Boolean(nextAnimation));
  }, [animationNames, selected?.id]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !animationName) return;
    if (animationPlaying) viewer.play();
    else viewer.pause();
  }, [animationName, animationPlaying, viewerRevision]);

  if (error) {
    return (
      <div className="model-review-empty panel">
        <TriangleAlert />
        <h3>3D 검수실을 열 수 없습니다</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!catalog || !selected || !viewerReady) {
    return (
      <div className="model-review-empty panel">
        <LoaderCircle className="model-review-spinner" />
        <h3>GLB 모델을 준비하는 중</h3>
        <p>{viewerReady ? '캐릭터 마켓과 품질 지표를 불러오고 있습니다.' : '내장 3D 뷰어를 초기화하고 있습니다.'}</p>
      </div>
    );
  }

  return (
    <div className="model-review-lab">
      <section className="model-review-overview panel">
        <div>
          <span className="eyebrow">HYBRID 3D PRODUCTION LAB</span>
          <h3>캐릭터 3D 교차 검수실</h3>
          <p>원화와 GLB를 나란히 비교하고 애니메이션·표정·PBR·LOD·Unity 호환성까지 단계별로 확인합니다.</p>
        </div>
        <div className="model-review-kpis">
          <span><Cuboid size={17} /><strong>{catalog.models.length}</strong><small>런타임 GLB</small></span>
          <span><ScanSearch size={17} /><strong>{reviewCount}</strong><small>AI 검수 메시</small></span>
          <span><CircleGauge size={17} /><strong>{selected.triangles.toLocaleString()}</strong><small>삼각형</small></span>
          <span><Box size={17} /><strong>{selected.meshes}</strong><small>메시 파츠</small></span>
        </div>
      </section>

      <section className="model-review-toolbar panel">
        <button className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate((value) => !value)}>
          <Rotate3D size={17} />자동 회전
        </button>
        {(Object.keys(studioPresets) as StudioPreset[]).map((presetId) => (
          <button
            key={presetId}
            className={preset === presetId ? 'active' : ''}
            onClick={() => setPreset(presetId)}
          >
            {studioPresets[presetId].label}
          </button>
        ))}
        <button onClick={() => setViewerRevision((value) => value + 1)}>
          <RefreshCcw size={16} />카메라 초기화
        </button>
        {animationNames.length > 0 && (
          <div className="model-animation-controls">
            <label htmlFor="model-animation-select">동작</label>
            <select
              id="model-animation-select"
              value={animationName}
              onChange={(event) => {
                setAnimationName(event.target.value);
                setAnimationPlaying(true);
              }}
            >
              {animationNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button
              className={animationPlaying ? 'active' : ''}
              onClick={() => setAnimationPlaying((value) => !value)}
              aria-label={animationPlaying ? '애니메이션 일시정지' : '애니메이션 재생'}
            >
              {animationPlaying ? <Pause size={16} /> : <Play size={16} />}
              {animationPlaying ? '일시정지' : '재생'}
            </button>
          </div>
        )}
      </section>

      <div className="model-review-workspace">
        <aside className="model-review-picker panel" aria-label="3D 모델 선택">
          {catalog.models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              active={model.id === selected.id}
              onSelect={() => setSelectedId(model.id)}
            />
          ))}
        </aside>

        <section className="model-review-stage panel">
          <div className={`model-viewer-shell ${studio.className}`}>
            <model-viewer
              ref={viewerRef}
              key={`${selected.id}-${viewerRevision}`}
              src={selected.runtimePath}
              poster={selected.thumbnail}
              alt={`${selected.characterName} 3D 캐릭터 프로토타입`}
              loading="eager"
              camera-controls
              auto-rotate={autoRotate}
              animation-name={animationName || undefined}
              autoplay={animationPlaying && Boolean(animationName)}
              interaction-prompt="auto"
              shadow-intensity={studio.shadow}
              shadow-softness=".8"
              exposure={studio.exposure}
              camera-orbit="30deg 75deg 3.7m"
              camera-target="0m 0.95m 0m"
              field-of-view="28deg"
            />
            <div className="model-stage-badge"><ScanSearch size={15} />LIVE GLB</div>
            <div className="model-stage-help">드래그 회전 · 휠 확대 · 우클릭 이동</div>
          </div>

          <div className="model-source-sheet">
            <img src={selected.sourceSheet} alt={`${selected.characterName} 원화 설정 시트`} />
            <span>REFERENCE SHEET</span>
          </div>
        </section>
      </div>

      <section className="model-review-inspector">
        <article className="panel">
          <header>
            <div>
              <span className="eyebrow">SELECTED MODEL</span>
              <h3>{selected.characterName}</h3>
            </div>
            <span className="model-status-badge">{selected.status}</span>
          </header>
          <dl>
            <div><dt>제작 단계</dt><dd>{selected.productionTier}</dd></div>
            <div><dt>메시 / 재질</dt><dd>{selected.meshes} / {selected.materials}</dd></div>
            <div><dt>노드</dt><dd>{selected.nodes}</dd></div>
            <div><dt>원화 변형</dt><dd>{selected.variationCount}단계</dd></div>
            <div><dt>파일</dt><dd>{formatBytes(selected.bytes)}</dd></div>
            <div><dt>휴머노이드 스킨</dt><dd>{selectedFidelity?.metrics?.skins ?? 0}</dd></div>
            <div><dt>애니메이션</dt><dd>{selectedFidelity?.metrics?.animations ?? 0} clips</dd></div>
            <div><dt>LOD</dt><dd>{selectedFidelity?.metrics?.lodLevels ?? 1}단계</dd></div>
            {selected.productionAsset && <div><dt>표정 셰이프</dt><dd>{selected.productionAsset.shapeKeys}</dd></div>}
            {selected.productionAsset && <div><dt>헤어 카드</dt><dd>{selected.productionAsset.hairCards}</dd></div>}
            {selected.productionAsset && <div><dt>PBR 해상도</dt><dd>{selected.productionAsset.textureResolution}px</dd></div>}
            {selected.productionAsset && <div><dt>Unity 정적 호환</dt><dd>{selected.productionAsset.unityCompatibility}</dd></div>}
          </dl>
        </article>

        <article className="panel model-production-ladder">
          <header><span className="eyebrow">PRODUCTION LADDER</span><h3>최종 품질 상승 경로</h3></header>
          <ol>
            <li className="done">
              <b>01</b>
              <span>
                <strong>{selected.status === 'review' ? 'AI 단일 시점 메시' : '절차형 프록시'}</strong>
                <small>{selected.status === 'review' ? '체적·실루엣·원화 대응 검수' : '실루엣·색·장비 배치 검증'}</small>
              </span>
            </li>
            <li className={selected.productionAsset ? 'done' : ''}><b>02</b><span><strong>변형 후보 메시</strong><small>자동 쿼드 리메시·UV·4본 이하 웨이트</small></span></li>
            <li className={selected.productionAsset ? 'done' : ''}><b>03</b><span><strong>PBR·헤어·표정</strong><small>2K PBR·32 헤어 카드·20 페이셜 셰이프</small></span></li>
            <li className={selected.productionAsset ? 'done' : ''}><b>04</b><span><strong>전투·표정 동작·LOD</strong><small>16 클립·LOD0/1/2 정적 검증</small></span></li>
            <li><b>05</b><span><strong>수동 리토폴로지</strong><small>얼굴·어깨·팔꿈치·손·골반·무릎 에지 루프</small></span></li>
            <li><b>06</b><span><strong>Unity 실제 변형 검수</strong><small>Avatar·게임 카메라·극단 포즈·표정·헤어</small></span></li>
          </ol>
        </article>
      </section>

      {selectedFidelity && (
        <section className="model-fidelity-panel panel">
          <header>
            <div>
              <span className="eyebrow">FIDELITY GATES</span>
              <h3>게임 캐릭터 승격 조건</h3>
            </div>
            <strong>{selectedFidelity.score}/100</strong>
          </header>
          <p>
            현재 GLB는 <b>{selectedFidelity.tier}</b> 단계입니다. 폴리곤 수만 늘리지 않고,
            아래 항목을 제작해야 실제 인물처럼 움직입니다.
          </p>
          <div className="model-fidelity-blockers">
            {selectedFidelity.blockers.slice(0, 8).map((blocker) => (
              <span key={blocker}>{blocker}</span>
            ))}
          </div>
        </section>
      )}

      <p className="model-review-disclaimer">
        라온은 자동 쿼드 리메시 기반 프로덕션 후보로 PBR·헤어 카드·표정·리그·12개 동작·LOD를 포함합니다.
        최종 승인에는 수동 관절/얼굴 리토폴로지와 Unity Editor 실제 변형 검수가 남아 있습니다.
      </p>
    </div>
  );
}
