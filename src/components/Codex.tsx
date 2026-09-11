import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronRight, Search, ShieldQuestion } from 'lucide-react';
import { characters } from '../data/lore';
import type { CharacterEra, CharacterRecord } from '../types';
import { CharacterDetail } from './CharacterDetail';

interface CodexProps {
  battleCompleted: boolean;
}

const eraOptions: Array<{ id: '전체' | CharacterEra; label: string }> = [
  { id: '전체', label: '전체 기록' },
  { id: '7기', label: '프시케 7기' },
  { id: '대전쟁', label: '대전쟁' },
  { id: '전후', label: '전후 인물' },
  { id: '5기', label: '봉합의 5기' },
];

export function Codex({ battleCompleted }: CodexProps) {
  const [era, setEra] = useState<'전체' | CharacterEra>('전체');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CharacterRecord | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return characters.filter((character) => {
      const matchesEra = era === '전체' || character.era === era;
      const matchesQuery =
        normalized.length === 0 ||
        [character.name, character.romanized, character.epithet, ...character.keywords]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalized);
      return matchesEra && matchesQuery;
    });
  }, [era, query]);

  return (
    <section className="codex-page page-enter">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ARCHIVUM PERSONARUM</span>
          <h2>프시케 인물 도감</h2>
          <p>첫인상, 제국의 기록, 생존자의 증언이 같은 사람을 서로 다르게 말한다.</p>
        </div>
        <div className="codex-counter">
          <strong>{String(filtered.length).padStart(2, '0')}</strong>
          <span>RECORDS FOUND</span>
        </div>
      </header>

      <div className="codex-toolbar">
        <div className="era-filters">
          {eraOptions.map((option) => (
            <button key={option.id} className={era === option.id ? 'active' : ''} onClick={() => setEra(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·체능·키워드 검색" />
        </label>
      </div>

      <div className="character-grid">
        {filtered.map((character, index) => (
          <button
            className="character-card"
            key={character.id}
            onClick={() => setSelected(character)}
            style={{ '--accent': character.accent } as CSSProperties}
          >
            <img src={character.art} alt="" loading="lazy" />
            <div className="character-card-shade" />
            <div className="character-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="character-card-copy">
              <span>{character.generation}</span>
              <h3>{character.name}</h3>
              <strong>{character.romanized}</strong>
              <p>{character.epithet}</p>
              <div>{character.keywords.slice(0, 3).map((keyword) => <i key={keyword}>{keyword}</i>)}</div>
            </div>
            <span className="open-record">기록 열기 <ChevronRight size={15} /></span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state"><ShieldQuestion size={34} /><h3>기록을 찾지 못했습니다.</h3><p>다른 이름이나 시대를 선택해 보십시오.</p></div>
      )}

      {selected && (
        <CharacterDetail
          character={selected}
          truthUnlocked={battleCompleted}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
