import { useEffect } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, Heart, Shield, Waves } from 'lucide-react';
import { villageRescueApproaches } from '../data/villageRescue';
import { canApplyVillageRescueAction, villageRescueRules } from '../game/villageRescue';
import type { VillageRescueAction, VillageRescueState } from '../types';
import './VillagePrologue.css';

interface Props {
  state: VillageRescueState;
  onAction: (action: VillageRescueAction) => void;
  onRetry: () => void;
  onExit: () => void;
}

const directions = [
  { label: '위로 피하기', dx: 0, dy: -1, Icon: ArrowUp },
  { label: '왼쪽으로 이동', dx: -1, dy: 0, Icon: ArrowLeft },
  { label: '아래로 피하기', dx: 0, dy: 1, Icon: ArrowDown },
  { label: '오른쪽으로 이동', dx: 1, dy: 0, Icon: ArrowRight },
];

export function VillageRescueEncounter({ state, onAction, onRetry, onExit }: Props) {
  const approach = villageRescueApproaches[state.choiceId];
  const active = state.phase === 'active';
  const rescued = state.progress === villageRescueRules.goal;
  const assist = { type: 'assist' } as const;
  const canAssist = canApplyVillageRescueAction(state, assist);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!active || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
      const actions: Record<string, VillageRescueAction> = {
        ArrowUp: { type: 'move', dx: 0, dy: -1 }, w: { type: 'move', dx: 0, dy: -1 },
        ArrowDown: { type: 'move', dx: 0, dy: 1 }, s: { type: 'move', dx: 0, dy: 1 },
        ArrowLeft: { type: 'move', dx: -1, dy: 0 }, a: { type: 'move', dx: -1, dy: 0 },
        ArrowRight: { type: 'move', dx: 1, dy: 0 }, d: { type: 'move', dx: 1, dy: 0 },
        e: { type: 'assist' }, q: { type: 'guard' },
      };
      const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!action) return;
      event.preventDefault();
      onAction(action);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, onAction]);

  return (
    <main className="village-rescue-page">
      <header className="rescue-header">
        <button onClick={onExit}><ArrowLeft size={17} /> 타이틀로 · 이어하기</button>
        <div><span>서장 · 북쪽 수로</span><h1>물속에서 들린 공포</h1></div>
        <span className="rescue-attempt">{state.attempt}번째 시도</span>
      </header>
      <div className="rescue-layout">
        <section className="rescue-field" aria-label="수로 구출 전장">
          <div className="rescue-objective">
            <span><Waves size={18} /> {approach.label}</span>
            <h2>{rescued ? '아이는 안전하다. 라온도 1열로 돌아가자.' : '아이와 함께 수로를 빠져나가자.'}</h2>
            <p>{approach.instruction}</p>
          </div>
          <div className="rescue-stats" aria-label="구출 상황">
            <span><Heart size={17} /> 체력 <strong>{state.hp} / {villageRescueRules.maxHp}</strong></span>
            <span>행동 <strong>{state.turn} / {villageRescueRules.turnLimit}</strong></span>
            <span>구출 <strong>{state.progress} / {villageRescueRules.goal}</strong></span>
          </div>
          <p className="rescue-warning" role="status">{active ? `다음 돌진: ${state.threatRow + 1}행 · 붉은 칸에서 행동을 마치면 체력 1을 잃습니다.` : '이번 시도는 여기서 멈췄습니다.'}</p>
          <div className="rescue-column-labels" aria-hidden="true">{Array.from({ length: 5 }, (_, x) => <span key={x}>{x + 1}열{x === 0 ? ' · 귀환' : ''}</span>)}</div>
          <div className="rescue-board" aria-label="5열 3행 지도. 인접한 칸을 선택하면 이동합니다.">
            {Array.from({ length: 15 }, (_, i) => {
              const x = i % 5;
              const y = Math.floor(i / 5);
              const player = x === state.x && y === state.y;
              const danger = active && y === state.threatRow;
              const marked = state.markedColumns.includes(x);
              const action = { type: 'move', dx: x - state.x, dy: y - state.y } as const;
              const legal = canApplyVillageRescueAction(state, action);
              return (
                <button key={i} className={`rescue-cell ${player ? 'player' : ''} ${danger ? 'danger' : ''} ${x === 0 ? 'exit' : ''} ${marked ? 'marked' : ''}`}
                  aria-label={`${y + 1}행 ${x + 1}열${player ? ' 라온 현재 위치' : ''}${danger ? ' 돌진 예고' : ''}${marked ? ' 표식' : ''}${x === 0 ? ' 귀환 지점' : ''}`}
                  aria-current={player ? 'location' : undefined} disabled={!legal} onClick={() => onAction(action)}>
                  <small>{y + 1}–{x + 1}</small>
                  {player ? <><img src="/art/portraits/raon-v1.webp" alt="" /><strong>라온</strong></> : x === 4 && y === 1 ? <strong>{rescued ? '안전 확보' : '아이'}</strong> : x === 0 ? <Flag size={20} /> : marked ? <span>◆</span> : <span aria-hidden="true">·</span>}
                  {danger && <em>돌진</em>}
                </button>
              );
            })}
          </div>
          <p className="rescue-legend"><span>⚑ 1열: 라온의 귀환 지점</span><span>◆ 돌 표식</span><span>생물을 쓰러뜨릴 필요는 없습니다.</span></p>
        </section>
        <aside className="rescue-actions" aria-label="구출 조작">
          {state.phase === 'failed' ? <div className="rescue-failure" role="alert">
            <h2>숨을 고르고 다시 시도하자</h2>
            <p>{state.hp === 0 ? '라온이 더 버티기 어려워 물러났습니다.' : '구조할 틈을 놓쳤습니다.'} 같은 선택으로 처음부터 다시 도전할 수 있습니다.</p>
            <button className="rescue-primary" onClick={onRetry}>구출 다시 시도</button>
          </div> : <>
            <h2>한 번 움직이고, 다음 위험을 살피세요.</h2>
            <p>입력할 때만 한 턴이 흐릅니다. 방향키·WASD 또는 지도와 버튼으로 조작합니다.</p>
            <div className="rescue-direction-pad">{directions.map(({ label, dx, dy, Icon }) => {
              const action = { type: 'move', dx, dy } as const;
              return <button key={label} aria-label={label} disabled={!canApplyVillageRescueAction(state, action)} onClick={() => onAction(action)}><Icon size={22} /></button>;
            })}</div>
            <button className="rescue-primary" disabled={!canAssist} onClick={() => onAction(assist)}><kbd>E</kbd> {approach.action}</button>
            <p className="rescue-action-hint">{rescued ? '이제 왼쪽 1열까지 돌아가세요.' : canAssist ? '이 자리에서 구출을 진행할 수 있습니다. 돌진 예고를 먼저 확인하세요.' : approach.locationHint}</p>
            <button className="rescue-guard" onClick={() => onAction({ type: 'guard' })} disabled={!active}><Shield size={17} /><kbd>Q</kbd> 몸을 낮춰 막기</button>
            <small>한 턴을 써서 이번 돌진 피해를 막습니다.</small>
          </>}
          <div className="rescue-log"><h3>지금 일어난 일</h3><ol aria-live="polite" aria-relevant="additions text">{state.log.slice(0, 4).map((line, i) => <li key={`${state.turn}-${i}`}>{line}</li>)}</ol></div>
          <p className="rescue-save-note">행동 뒤 진행을 자동 저장합니다. 타이틀의 여정 계속으로 같은 위치에서 이어갈 수 있습니다.</p>
        </aside>
      </div>
    </main>
  );
}
