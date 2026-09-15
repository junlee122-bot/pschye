import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Footprints, Leaf, RotateCcw, Wind } from 'lucide-react';
import { petalTrainingApproaches } from '../data/petalTraining';
import { canApplyPetalTrainingAction, petalTrainingRules, resolvePetalTrainingAction } from '../game/petalTraining';
import type { PetalTrainingAction, PetalTrainingState } from '../types';
import './PetalTrainingEncounter.css';

interface Props {
  state: PetalTrainingState;
  onStart: () => void;
  onAction: (action: PetalTrainingAction) => void;
  onRetry: () => void;
  onComplete: () => void;
  onAdvance: () => void;
  onExit: () => void;
}

const actions = [
  { id: 'trace', label: '보법 이어가기', Icon: Footprints, description: '다음 발을 내디뎌 기억한 궤적을 잇습니다.' },
  { id: 'balance', label: '무게 나누기', Icon: Leaf, description: '속도를 낮추고 몸에 실린 부담을 나눕니다.' },
  { id: 'breathe', label: '호흡 고르기', Icon: Wind, description: '이어 온 궤적을 유지하며 부담을 낮춥니다.' },
] as const;
const phases = { ready: '수련 준비', active: '궤적 잇기', failed: '잠시 멈춤', review: '마무리 대기', complete: '수련 기록' };
const stages = ['기억한 선', '발을 놓는 간격', '이어지는 움직임', '마지막 한 걸음'];
const petalMarks = Array.from({ length: 16 }, (_, index) => {
  const angle = index * 22.5;
  const radians = (angle - 90) * Math.PI / 180;
  return { angle, x: 180 + 146 * Math.cos(radians), y: 180 + 146 * Math.sin(radians) };
});

export function PetalTrainingEncounter({ state, onStart, onAction, onRetry, onComplete, onAdvance, onExit }: Props) {
  const [selected, setSelected] = useState<PetalTrainingAction>();
  const resultRef = useRef<HTMLElement>(null);
  const active = state.phase === 'active';
  const approach = petalTrainingApproaches[state.choiceId];
  const legal = active && selected !== undefined && canApplyPetalTrainingAction(state, selected);
  const preview = legal && selected ? resolvePetalTrainingAction(state, selected) : undefined;
  const stage = Math.min(3, Math.floor(state.petals / 4));

  useEffect(() => {
    if (['failed', 'review', 'complete'].includes(state.phase)) resultRef.current?.focus();
    else document.getElementById('petal-training-title')?.focus({ preventScroll: true });
  }, [state.phase]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!legal || !selected) return;
    onAction(selected);
    setSelected(undefined);
  };

  return <main className="petal-training-page">
    <header className="petal-training-header">
      <button onClick={onExit}><ArrowLeft size={17} /> 타이틀로 · 이어하기</button>
      <span>제3장 · 현자를 찾아서 / 선발 17~29일차</span>
      <span>{state.attempt ? `${state.attempt}번째 연습` : '연구소 뒤편 폐정원'}</span>
    </header>
    <div className="petal-training-layout">
      <section className="petal-training-scene" aria-label="열여섯 궤적 수련 상황">
        <div className="petal-training-heading"><span>폐정원 수련 / {phases[state.phase]}</span><h1 id="petal-training-title" tabIndex={-1}>힘이 빠진 열여섯 꽃잎</h1><p>기억 속의 검로를, 라온의 다음 발로 이어 보세요.</p></div>
        <div className="petal-training-teacher"><img src="/art/archive/maru-sheet.png" alt="마루" /><div><strong>마루 · 기억을 짚어 주는 사람</strong><p>마루는 손가락으로 궤적을 짚습니다. 그 선을 몸으로 다시 만드는 일은 라온의 몫입니다.</p></div></div>
        <figure className={`petal-training-garden ${state.phase === 'failed' ? 'interrupted' : ''}`}>
          <svg viewBox="0 0 360 360" role="img" aria-label={`이어진 궤적 ${state.petals} / 16`}>
            <circle className="petal-training-orbit" cx="180" cy="180" r="146" />
            {petalMarks.map((mark, index) => <g key={index} className={`petal-training-mark ${index < state.petals ? 'traced' : ''} ${index === state.petals && active ? 'next' : ''}`}>
              <path d="M 180 124 C 159 98 162 60 180 47 C 198 60 201 98 180 124 Z" transform={`rotate(${mark.angle} 180 180)`} />
              <text x={mark.x} y={mark.y} dominantBaseline="middle" textAnchor="middle">{index + 1}</text>
            </g>)}
            <circle className="petal-training-center" cx="180" cy="180" r="49" />
            <text className="petal-training-count" x="180" y="176" textAnchor="middle">{state.petals}<tspan> / 16</tspan></text>
            <text className="petal-training-count-label" x="180" y="201" textAnchor="middle">이어진 궤적</text>
          </svg>
          <figcaption>{state.phase === 'failed' ? '이어지려던 궤적이 끊겼습니다.' : state.petals === 16 ? '열여섯 궤적을 한 번 끝까지 이었습니다.' : `${String(stage + 1).padStart(2, '0')} / ${stages[stage]}`}<small>다음 발이 이어지는 이유를 찾는 연습입니다.</small></figcaption>
        </figure>
        <ol className="petal-training-stages" aria-label="궤적 진행 구간">{stages.map((label, index) => <li className={state.petals >= (index + 1) * 4 ? 'done' : ''} key={label}><span>{state.petals >= (index + 1) * 4 ? <Check size={13} /> : `${index * 4 + 1}–${(index + 1) * 4}`}</span>{label}</li>)}</ol>
        <div className="petal-training-method"><span>{approach.label}</span><p>{approach.method}</p></div>
      </section>

      <aside className="petal-training-console">
        <div className="petal-training-live" aria-live="polite"><span>궤적 <strong>{state.petals} / 16</strong></span><span>몸의 부담 <strong>{state.burden} / 8</strong></span><span>동작 <strong>{state.turn} / 10</strong></span></div>
        <div className={`petal-training-burden ${state.burden >= 6 ? 'high' : ''}`} role="meter" aria-label="몸의 부담" aria-valuemin={0} aria-valuemax={8} aria-valuenow={state.burden}>{Array.from({ length: 8 }, (_, index) => <i className={index < state.burden ? 'filled' : ''} key={index} />)}</div>
        {state.phase === 'ready' && <section className="petal-training-message"><span>수련 준비</span><h2>모양보다, 이어지는 이유.</h2><p>{approach.pending}</p><p>{approach.instruction}</p><ul><li>10번의 동작 안에 열여섯 궤적을 잇습니다.</li><li>부담이 8에 닿으면 마지막 궤적에서도 멈춥니다.</li><li>호흡을 고르면 진행을 잃지 않고 부담을 낮춥니다.</li><li>동작은 여러 날의 수련 중 한 번의 연습을 나타냅니다.</li></ul><button className="petal-training-primary" onClick={onStart}>궤적 수련 시작 <ArrowRight size={17} /></button></section>}
        {active && <form onSubmit={submit}>
          <div className="petal-training-console-title"><span>다음 동작</span><h2>계속 잇거나, 숨을 고르거나.</h2><p>몸에 여유를 남겨 두고 열여섯 번째 발까지 이어가세요.</p></div>
          <fieldset className="petal-training-actions"><legend>라온의 수련 동작</legend>{actions.map(({ id, label, Icon, description }) => {
            const allowed = canApplyPetalTrainingAction(state, id);
            const next = allowed ? resolvePetalTrainingAction(state, id) : undefined;
            const petalsDelta = next ? next.petals - state.petals : 0;
            const burdenDelta = next ? next.burden - state.burden : 0;
            return <label className={`${selected === id ? 'selected' : ''} ${!allowed ? 'unavailable' : ''}`} key={id}>
              <input type="radio" name="petal-training-action" value={id} checked={selected === id} disabled={!allowed} onChange={() => setSelected(id)} />
              <Icon size={20} /><span><strong>{label}</strong><small>{description}</small><em>{next ? `궤적 +${petalsDelta} · 부담 ${burdenDelta > 0 ? '+' : ''}${burdenDelta}` : '부담이 없을 때는 호흡을 고를 필요가 없습니다.'}</em></span>
            </label>;
          })}</fieldset>
          <div className={`petal-training-preview ${preview?.phase === 'failed' ? 'danger' : ''}`} aria-live="polite">{preview ? <><strong>실행 후 궤적 {preview.petals} / 16 · 부담 {preview.burden} / 8</strong><p>{preview.phase === 'failed' ? preview.burden === petalTrainingRules.maxBurden ? '부담이 한계에 닿아 이번 연결을 멈춥니다. 호흡이나 무게 나누기를 살펴보세요.' : '이번 동작으로 연습 기회를 모두 쓰지만, 열여섯 궤적에 닿지 못합니다.' : preview.phase === 'review' ? '열여섯 궤적이 이어집니다. 마루 앞에서 마무리할 수 있습니다.' : `${petalTrainingRules.turnLimit - preview.turn}번의 동작이 남습니다. 입력을 실행할 때만 연습이 진행됩니다.`}</p></> : <p>다음 동작을 고르면 궤적과 부담의 변화를 볼 수 있습니다.</p>}</div>
          <button className="petal-training-primary" type="submit" disabled={!legal}>선택한 동작 실행 <ArrowRight size={17} /></button>
        </form>}
        {state.phase === 'failed' && <section className="petal-training-message" ref={resultRef} tabIndex={-1} role="alert"><span>이번 연결은 여기까지</span><h2>다음 발을 다시 생각하자.</h2><p>{state.burden === petalTrainingRules.maxBurden ? '몸에 실린 부담이 한계에 닿았습니다.' : '이번 연습의 동작을 모두 썼지만 열여섯 궤적을 잇지 못했습니다.'} 충분히 쉬고 같은 방침으로 처음부터 다시 연습할 수 있습니다.</p><p>호흡을 고르는 동안에도 이어 온 궤적은 남습니다. 마지막에 한계에 닿지 않도록 간격을 두세요.</p><button className="petal-training-primary" onClick={onRetry}><RotateCcw size={16} /> 쉬고 다시 연습</button></section>}
        {state.phase === 'review' && <section className="petal-training-message" ref={resultRef} tabIndex={-1}><span>열여섯 궤적 연결</span><h2>마지막 발을 놓은 자리.</h2><p>라온은 기억한 선을 한 번 끝까지 이었습니다. 마루 앞에서 움직임을 마무리하고 이번 수련을 돌아봅니다.</p><button className="petal-training-primary" onClick={onComplete}>마루 앞에서 수련 마무리 <ArrowRight size={17} /></button></section>}
        {state.phase === 'complete' && <section className="petal-training-message" ref={resultRef} tabIndex={-1}><span><Check size={17} /> 이번 수련을 마쳤습니다</span><h2>이제, 그 발로 원형장에.</h2><p>{approach.completion}</p><p>선발전에서 이어 볼 한 번의 움직임을 남겼습니다. 다음은 조장 후보들과 마주하는 날입니다.</p><button className="petal-training-primary" onClick={onAdvance}>조장 선발전으로 <ArrowRight size={17} /></button></section>}
        <section className="petal-training-log"><h3>연습 기록</h3><ol>{state.log.slice(0, 4).map((line, index) => <li key={`${state.attempt}-${state.turn}-${index}`}>{line}</li>)}</ol></section>
        <p className="petal-training-save-note">실행한 동작과 진행은 자동 저장됩니다. 타이틀에서 수련을 이어갈 수 있습니다.</p>
      </aside>
    </div>
  </main>;
}
