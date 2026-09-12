import { useEffect, useState, type CSSProperties } from 'react';
import { Eye, LockKeyhole, Quote, Shield, Swords, X } from 'lucide-react';
import type { CharacterRecord } from '../types';

interface CharacterDetailProps {
  character: CharacterRecord;
  truthUnlocked: boolean;
  onClose: () => void;
}

export function CharacterDetail({ character, truthUnlocked, onClose }: CharacterDetailProps) {
  const [layer, setLayer] = useState<'official' | 'truth'>('official');
  const canReadTruth = truthUnlocked && Boolean(character.hiddenTruth);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label={`${character.name} 상세 기록`}>
      <article className="character-detail" style={{ '--accent': character.accent } as CSSProperties}>
        <button className="detail-close" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        <div className="detail-art">
          <img src={character.art} alt={`${character.name} 캐릭터 설정화`} />
          <div className="detail-art-shade" />
          <div className="detail-identity">
            <span>{character.generation}</span>
            <h2>{character.name}</h2>
            <strong>{character.romanized}</strong>
            <p>{character.epithet}</p>
          </div>
        </div>
        <div className="detail-copy">
          <div className="record-switch">
            <button className={layer === 'official' ? 'active' : ''} onClick={() => setLayer('official')}>
              <Shield size={15} /> 인물 기록
            </button>
            <button className={layer === 'truth' ? 'active' : ''} onClick={() => setLayer('truth')}>
              {canReadTruth ? <Eye size={15} /> : <LockKeyhole size={15} />} 확보한 증언
            </button>
          </div>

          <div className="character-stat-grid">
            <div><span>소속</span><strong>{character.affiliation}</strong></div>
            <div><span>역할</span><strong>{character.role}</strong></div>
            <div><span>무기</span><strong>{character.weapon}</strong></div>
            <div><span>체능 / 능력</span><strong>{character.style}</strong></div>
          </div>

          <section className={`record-body ${layer}`}>
            <span className="eyebrow">{layer === 'official' ? 'IMPERIAL ARCHIVE' : 'SURVIVOR TESTIMONY'}</span>
            {layer === 'official' || canReadTruth ? (
              <p>{layer === 'official' ? character.officialSummary : character.hiddenTruth}</p>
            ) : (
              <div className="redacted-record">
                <LockKeyhole size={21} />
                <p>아직 이 인물과 관련된 현장 증언을 확보하지 못했습니다. 전투에서 증언을 이끌어 내고 승리하면 기록됩니다.</p>
              </div>
            )}
          </section>

          {character.quote && <blockquote><Quote size={17} /> {character.quote}</blockquote>}

          {character.readerJourney.length > 0 && <section className="reader-journey">
            <span className="eyebrow">함께한 기록</span>
            <div>
              {character.readerJourney.map((stage, index) => (
                <span key={stage}><i>{String(index + 1).padStart(2, '0')}</i>{stage}</span>
              ))}
            </div>
          </section>}

          <div className="keyword-row">
            <Swords size={15} />
            {character.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
          </div>
        </div>
      </article>
    </div>
  );
}
