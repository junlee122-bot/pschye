import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Flag, Hammer, ShieldCheck, UsersRound } from 'lucide-react';
import { fieldExamApproaches } from '../data/fieldExam';
import { canApplyFieldExamPlan, fieldExamRules, getFieldExamLoad, resolveFieldExamPlan } from '../game/fieldExam';
import type { FieldExamOrder, FieldExamPlan, FieldExamState } from '../types';
import './FieldExamEncounter.css';

interface Props {
  state: FieldExamState;
  onStart: () => void;
  onPlan: (plan: FieldExamPlan) => void;
  onRetry: () => void;
  onReturn: () => void;
  onAdvance: () => void;
  onExit: () => void;
}

const orderLabels: Record<FieldExamOrder, string> = { left: '왼쪽 통로 구조', right: '오른쪽 통로 구조', brace: '통로 받치기' };
const steps = ['접근', '구조 보조', '출구 인도'];
const actors = [{ id: 'raon', name: '라온', portrait: '/art/portraits/raon-v1.webp' }, { id: 'leo', name: '레오', portrait: '/art/archive/leo-sheet.webp' }] as const;

export function FieldExamEncounter({ state, onStart, onPlan, onRetry, onReturn, onAdvance, onExit }: Props) {
  const [orders, setOrders] = useState<Partial<FieldExamPlan>>({});
  const resultRef = useRef<HTMLElement>(null);
  const commandRef = useRef<HTMLFormElement>(null);
  const previousTurn = useRef(state.turn);
  const approach = fieldExamApproaches[state.choiceId];
  const active = state.phase === 'active';
  const firstSupport = state.choiceId === 'defy-order' && state.turn === 0;
  const selectedPlan = orders.raon && orders.leo ? { raon: orders.raon, leo: orders.leo } : undefined;
  const legal = active && selectedPlan !== undefined && canApplyFieldExamPlan(state, selectedPlan);
  const preview = legal && selectedPlan ? resolveFieldExamPlan(state, selectedPlan) : undefined;
  const assistedRoutes = selectedPlan && selectedPlan.raon !== 'brace' && selectedPlan.leo !== 'brace';
  const overlaps = selectedPlan && selectedPlan.raon !== 'brace' && selectedPlan.raon === selectedPlan.leo && state[selectedPlan.raon] === 2;
  const splitBenefit = state.choiceId === 'split-route' && assistedRoutes && selectedPlan.raon !== selectedPlan.leo;
  const finished = Number(state.left === 3) + Number(state.right === 3);
  const status = { ready: '구조 준비', active: '구조 지휘', failed: '시도 중단', return: '철수 확인 대기', complete: '전원 철수 완료' }[state.phase];

  useEffect(() => {
    const nextCommand = state.phase === 'active' && state.turn > previousTurn.current;
    previousTurn.current = state.turn;
    if (['failed', 'return', 'complete'].includes(state.phase)) resultRef.current?.focus();
    else if (nextCommand) commandRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    else document.getElementById('field-exam-title')?.focus({ preventScroll: true });
  }, [state.phase, state.turn]);

  const executePlan = (event: FormEvent) => {
    event.preventDefault();
    if (!legal || !selectedPlan) return;
    onPlan(selectedPlan);
    setOrders({});
  };

  return <main className="field-exam-page">
    <header className="field-exam-header">
      <button onClick={onExit}><ArrowLeft size={17} /> 타이틀로 · 이어하기</button>
      <span>제2장 · 선발원 / 선발 11일차</span>
      <span>{state.attempt > 0 ? `${state.attempt}번째 시도` : '폐광 모의구역'}</span>
    </header>
    <div className="field-exam-layout">
      <section className="field-exam-scene" aria-label="폐광 구조 상황">
        <div className="field-exam-heading"><span>FIELD EXAM / {status}</span><h1 id="field-exam-title" tabIndex={-1}>이기는 조와 돌아오는 조</h1><p>두 사람을 갱도 밖으로 이끌고, 라온도 함께 돌아오세요.</p></div>
        <div className="field-exam-plan-note"><UsersRound size={20} /><div><strong>{approach.label}</strong><p>{approach.cooperation}</p></div></div>
        <dl className="field-exam-stats">
          <div><dt>통로 버팀</dt><dd>{state.integrity}<small> / {fieldExamRules.maxIntegrity}</small></dd></div>
          <div><dt>실행한 명령</dt><dd>{state.turn}<small> / {fieldExamRules.turnLimit}</small></dd></div>
          <div><dt>출구에 도착한 지원자</dt><dd>{finished}<small> / 2</small></dd></div>
        </dl>
        <div className="field-exam-integrity" role="meter" aria-label="통로 버팀" aria-valuemin={0} aria-valuemax={fieldExamRules.maxIntegrity} aria-valuenow={state.integrity}>
          {Array.from({ length: fieldExamRules.maxIntegrity }, (_, index) => <i key={index} className={index < state.integrity ? 'filled' : ''} />)}
        </div>
        <div className="field-exam-mine">
          <div className="field-exam-entrance"><Flag size={18} /><span>안전한 출구</span><small>지원자 둘을 이곳으로</small></div>
          <div className="field-exam-tunnels">
            {(['left', 'right'] as const).map((route, index) => <article className={`field-exam-tunnel ${state[route] === 3 ? 'cleared' : ''}`} key={route} aria-label={`${index === 0 ? '왼쪽' : '오른쪽'} 통로 구조 진행 ${state[route]} / 3`}>
              <div className="field-exam-tunnel-top"><span>통로 {index === 0 ? 'A' : 'B'} · {index === 0 ? '왼쪽' : '오른쪽'}</span><UsersRound size={25} /></div>
              <h2>{state[route] === 3 ? '출구 도착' : `고립된 지원자 ${index + 1}`}</h2>
              <ol>{steps.map((step, stepIndex) => <li className={stepIndex < state[route] ? 'done' : ''} key={step}><span>{stepIndex < state[route] ? <Check size={13} /> : stepIndex + 1}</span>{step}</li>)}</ol>
            </article>)}
          </div>
          <div className="field-exam-support"><Hammer size={18} /><p>{state.choiceId === 'defy-order'
            ? state.turn === 0 ? '라온이 잠깐 지지대를 받칩니다. 첫 명령은 받치기로 시작하세요.' : '하도리가 지지대의 하중을 넘겨받았습니다. 라온도 구조 명령을 내릴 수 있습니다.'
            : state.choiceId === 'rescue-team' ? '카즈린도 구조를 돕습니다. 받치기 한 명령으로 버팀이 3 회복됩니다.' : '카즈린은 시험 목표를 유지합니다. 두 사람이 통로를 나누면 이번 하중이 1 줄어듭니다.'}</p></div>
        </div>
        {active && <p className={`field-exam-forecast ${getFieldExamLoad(state) === 3 ? 'strong' : ''}`}><Hammer size={18} /><span>다음 하중 <strong>{getFieldExamLoad(state)}</strong> · {getFieldExamLoad(state) === 3 ? '낙석이 예고됩니다. 통로를 먼저 받쳐 주세요.' : '명령 실행 후 통로 버팀이 줄어듭니다.'}</span></p>}
      </section>

      <aside className="field-exam-console">
        {state.phase === 'ready' && <section className="field-exam-stage-message">
          <span>01 / 구조 준비</span><h2>깃발보다 먼저, 안쪽의 목소리.</h2><p>{approach.pending}</p><p>{approach.instruction}</p>
          <ul><li>라온과 레오의 명령을 고르고 함께 실행합니다.</li><li>한 통로에 구조 명령을 세 번 보내면 지원자가 출구에 도착합니다.</li><li>받치기로 버팀을 회복하세요. 0이 되면 이번 시도를 중단합니다.</li><li>명령을 실행할 때만 시간이 흐릅니다.</li></ul>
          <button className="field-exam-primary" onClick={onStart}>구조 지휘 시작 <ArrowRight size={17} /></button>
        </section>}
        {active && <form ref={commandRef} onSubmit={executePlan}>
          <div className="field-exam-console-title"><span>02 / 동료에게 명령</span><h2>각자의 역할을 정하세요.</h2><p>명령 두 개를 함께 실행합니다. 통로 하나에 집중하거나, 역할을 나눌 수 있습니다.</p></div>
          {actors.map((actor) => <fieldset className="field-exam-orders" key={actor.id}>
            <legend><img src={actor.portrait} alt="" /><span>{actor.name}</span><small>{actor.id === 'raon' && firstSupport ? '첫 명령 · 받치기' : '한 가지 명령 선택'}</small></legend>
            {(['left', 'right', 'brace'] as const).map((order) => {
              const disabled = (order !== 'brace' && state[order] === 3) || (actor.id === 'raon' && firstSupport && order !== 'brace');
              return <label className={`${orders[actor.id] === order ? 'selected' : ''} ${disabled ? 'unavailable' : ''}`} key={order}>
                <input type="radio" name={`field-exam-${actor.id}`} value={order} checked={orders[actor.id] === order} disabled={disabled} onChange={() => setOrders((current) => ({ ...current, [actor.id]: order }))} />
                <span>{orderLabels[order]}</span><small>{order === 'brace' ? `버팀 +${state.choiceId === 'rescue-team' ? 3 : 2}` : state[order] === 3 ? '출구 도착' : `진행 ${state[order]} / 3`}</small>
              </label>;
            })}
          </fieldset>)}
          <div className={`field-exam-preview ${preview?.phase === 'failed' ? 'danger' : ''}`} aria-live="polite">
            {preview ? <><strong>실행 후 버팀 예상 {preview.integrity} / {fieldExamRules.maxIntegrity}</strong><p>{preview.phase === 'failed' ? '이 명령으로는 이번 시도를 마치기 어렵습니다. 받치기와 남은 구조를 확인하세요.' : splitBenefit ? '서로 다른 통로를 맡아 하중이 1 줄어듭니다.' : overlaps ? '이 통로에는 한 단계만 남아 있습니다. 다른 한 명은 통로를 받칠 수 있습니다.' : '선택한 명령을 실행하면 한 턴이 흐릅니다.'}</p></> : <p>라온과 레오의 명령을 하나씩 선택하세요.</p>}
          </div>
          <button className="field-exam-primary" type="submit" disabled={!legal}>두 명령 함께 실행 <ArrowRight size={17} /></button>
        </form>}
        {state.phase === 'failed' && <section ref={resultRef} tabIndex={-1} className="field-exam-stage-message" role="alert"><span>시도 중단</span><h2>통로를 다시 살피자.</h2><p>{state.integrity === 0 ? '통로가 더 버티지 못해 구조 시도를 멈췄습니다.' : '제한된 행동 안에 구조 경로를 열지 못했습니다.'} 같은 선택으로 처음부터 다시 도전할 수 있습니다.</p><p>낙석이 오는 세 번째 명령과 통로를 받칠 사람을 먼저 정해 보세요.</p><button className="field-exam-primary" onClick={onRetry}>같은 선택으로 재도전 <ArrowRight size={17} /></button></section>}
        {state.phase === 'return' && <section ref={resultRef} tabIndex={-1} className="field-exam-stage-message"><span>03 / 마지막 철수</span><h2>둘은 출구에 도착했다.</h2><p>라온과 구조에 참여한 동료도 함께 갱도를 나가야 합니다. 아직 시험 결과를 기록하지 않았습니다.</p><button className="field-exam-primary" onClick={onReturn}>모두와 함께 철수 <ArrowRight size={17} /></button></section>}
        {state.phase === 'complete' && <section ref={resultRef} tabIndex={-1} className="field-exam-stage-message"><span><ShieldCheck size={17} /> 전원 철수 완료</span><h2>돌아오는 조의 첫 명령.</h2><p>{approach.completion}</p><p>선택과 귀환을 기록했습니다. 다음 날, 선발원에서 라온의 평가를 듣습니다.</p><button className="field-exam-primary" onClick={onAdvance}>선발 12일차 · 다음 장면 <ArrowRight size={17} /></button></section>}
        <section className="field-exam-log"><h3>현장 기록</h3><ol aria-live="polite" aria-relevant="additions text">{state.log.slice(0, 5).map((line, index) => <li key={`${state.attempt}-${state.turn}-${index}`}>{line}</li>)}</ol></section>
        <p className="field-exam-save-note">실행한 명령과 구조 진행은 자동 저장됩니다. 타이틀의 이야기 계속으로 이어갈 수 있습니다.</p>
      </aside>
    </div>
  </main>;
}
