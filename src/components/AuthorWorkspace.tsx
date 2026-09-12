import { useState } from 'react';
import { AuthorChronicle } from './AuthorChronicle';
import { ArchiveGallery } from './ArchiveGallery';
import { CharacterDetail } from './CharacterDetail';
import { characters } from '../data/lore';

export function AuthorWorkspace() {
  const [confirmed, setConfirmed] = useState(false);
  const [view, setView] = useState<'chronicle' | 'art' | 'characters'>('chronicle');
  const [characterId, setCharacterId] = useState<string | null>(null);
  const selected = characters.find((character) => character.id === characterId);
  if (!confirmed) return <main className="save-recovery"><strong>제작자 자료실</strong><p>전체 결말과 미정 각색안을 포함합니다. 이 자료실은 게임 진행 기록을 변경하지 않습니다.</p><div><button className="secondary-action" onClick={() => setConfirmed(true)}>전체 제작 자료 열기</button><a className="secondary-action" href="/">게임으로 돌아가기</a></div></main>;
  return <main className="author-workspace">
    <header className="panel author-workspace-header"><div><strong>제작자 자료실 · 전체 스포일러</strong><p>제작 초안과 원전 정사는 구분해서 읽습니다. 정사 판정은 docs/CANON_STATUS.md를 기준으로 합니다.</p></div><a href="/">게임으로 돌아가기</a></header>
    <nav className="segmented-control" aria-label="제작 자료 종류"><button onClick={() => setView('chronicle')} aria-pressed={view === 'chronicle'}>전체 서사·세계</button><button onClick={() => setView('characters')} aria-pressed={view === 'characters'}>인물 원장</button><button onClick={() => setView('art')} aria-pressed={view === 'art'}>설정화·모델 검수</button></nav>
    {view === 'chronicle' && <AuthorChronicle />}
    {view === 'art' && <ArchiveGallery />}
    {view === 'characters' && <section className="player-album-grid">{characters.map((character) => <button className="panel player-album-card" key={character.id} onClick={() => setCharacterId(character.id)}><strong>{character.name}</strong><span>제작 원장 · 결말 포함</span></button>)}</section>}
    {selected && <CharacterDetail key={selected.id} character={selected} truthUnlocked onClose={() => setCharacterId(null)} />}
  </main>;
}
