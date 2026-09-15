import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Footprints, RotateCcw, Shield, Swords, Wind } from 'lucide-react';
import { captainTrialApproaches, captainTrialDefinitions, captainTrialIntents } from '../data/captainTrial';
import { canApplyCaptainTrialAction, captainTrialRules, getCaptainTrialIntent, resolveCaptainTrialAction } from '../game/captainTrial';
import type { CaptainTrialAction, CaptainTrialState } from '../types';
import './CaptainTrialEncounter.css';

interface Props {
  state: CaptainTrialState;
  onStart: () => void;
  onAction: (action: CaptainTrialAction) => void;
  onRetry: () => void;
  onComplete: () => void;
  onAdvance: () => void;
  onExit: () => void;
}

const actions = [
  { id: 'parry', label: '창 흘리기', Icon: Shield, description: '곧게 들어오는 창대를 바깥으로 흘립니다.' },
  { id: 'sidestep', label: '비켜딛기', Icon: Footprints, description: '넓게 들어오는 창날에서 몸을 빼냅니다.' },
  { id: 'counter', label: '검로 잇기', Icon: Swords, description: '상대가 거두는 틈에 라온의 검로를 잇습니다.' },
  { id: 'recover', label: '거리 두고 호흡', Icon: Wind, description: '호흡을 되찾습니다. 공격 중에는 균형을 잃을 수 있습니다.' },
] as const;
const phaseLabels = { ready: '대결 준비', active: '공방', failed: '시도 중단', resolved: '승부 마무리', complete: '대결 기록' };
const signed = (value: number) => value > 0 ? `+${value}` : String(value);

export function CaptainTrialEncounter({ state, onStart, onAction, onRetry, onComplete, onAdvance, onExit }: Props) {
  const [selected, setSelected] = useState<CaptainTrialAction>();
  const resultRef = useRef<HTMLElement>(null);
  const commandRef = useRef<HTMLFormElement>(null);
  const previousStep = useRef({ sceneId: state.sceneId, turn: state.turn });
  const definition = captainTrialDefinitions[state.sceneId];
  const approach = state.choiceId ? captainTrialApproaches[state.choiceId] : undefined;
  const hadori = state.sceneId === 'hadori-wall';
  const active = state.phase === 'active';
  const intent = getCaptainTrialIntent(state);
  const cue = captainTrialIntents[intent];
  const legal = active && selected !== undefined && canApplyCaptainTrialAction(state, selected);
  const preview = legal && selected ? resolveCaptainTrialAction(state, selected) : undefined;
  const counterReady = active && !hadori && canApplyCaptainTrialAction(state, 'counter');
  const counterNeedsBreath = active && !hadori && intent === 'recover' && state.opening && state.breath === 0;

  useEffect(() => {
    const nextCommand = state.phase === 'active' && state.sceneId === previousStep.current.sceneId && state.turn > previousStep.current.turn;
    previousStep.current = { sceneId: state.sceneId, turn: state.turn };
    if (['failed', 'resolved', 'complete'].includes(state.phase)) resultRef.current?.focus();
    else if (nextCommand) commandRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    else document.getElementById('captain-trial-title')?.focus({ preventScroll: true });
  }, [state.phase, state.sceneId, state.turn]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!legal || !selected) return;
    onAction(selected);
    setSelected(undefined);
  };

  return <main className="captain-trial-page" style={{ backgroundImage: `linear-gradient(105deg,#111820ed,#10151bec),url('${definition.background}')` }}>
    <header className="captain-trial-header"><button onClick={onExit}><ArrowLeft size={17} /> 타이틀로 · 이어하기</button><span>제4장 · 여섯 조장 / 중앙 원형장</span><span>{state.attempt > 0 ? `${state.attempt}번째 시도` : `${definition.opponent}과의 대결`}</span></header>
    <div className="captain-trial-layout">
      <section className="captain-trial-scene" aria-label={`${definition.opponent} 대결 상황`}>
        <div className="captain-trial-heading"><span>{hadori && state.phase === 'resolved' ? '도전전 종료' : phaseLabels[state.phase]}</span><h1 id="captain-trial-title" tabIndex={-1}>{definition.title}</h1><p>{definition.subtitle}</p></div>
        <div className={`captain-trial-arena ${counterReady ? 'opening' : ''} ${state.phase === 'failed' || (hadori && state.phase === 'resolved') ? 'ended' : ''}`}>
          <div className="captain-trial-fighter"><img src="/art/portraits/raon-v1.webp" alt="라온" /><strong>라온</strong><span>빌린 검을 잇는 발</span></div>
          <div className="captain-trial-crossing" aria-hidden="true"><i /><Swords size={30} /><i /></div>
          <div className="captain-trial-fighter"><img src={definition.portrait} alt={definition.opponent} /><strong>{definition.opponent}</strong><span>{hadori ? '제1조장 도전자 앞에' : '같은 원형장의 후보'}</span></div>
          {!hadori && <div className="captain-trial-progress" aria-label={`승부 진행 ${state.progress} / 3`}>{[1, 2, 3].map((step) => <span className={state.progress >= step ? 'done' : ''} key={step}>{state.progress >= step ? <Check size={15} /> : step}</span>)}<small>{state.phase === 'failed' ? state.poise === 0 ? '균형을 잃어 연결이 끊겼습니다.' : '정해진 동작 안에 검로를 잇지 못했습니다.' : state.progress === 3 ? '마지막 검로가 이어졌습니다.' : '틈을 잡아 마지막 검로까지 잇습니다.'}</small></div>}
        </div>
        <div className="captain-trial-method"><strong>{approach?.label ?? '제1조장에게 도전한다'}</strong><p>{approach?.method ?? definition.method}</p></div>
        {!hadori && <p className="captain-trial-pattern">{definition.method}</p>}
        {active && <section className={`captain-trial-cue ${counterReady ? 'open' : ''}`} aria-live="polite"><span>{hadori ? '첫 합' : '상대의 다음 움직임'}</span><h2>{cue.label}</h2><p>{cue.hint}</p>{!hadori && <strong>{counterReady ? '반격할 틈이 열렸습니다.' : counterNeedsBreath ? '틈은 있지만 호흡이 부족합니다. 호흡을 되찾으세요.' : state.sceneId === 'kazrin-duel' && intent === 'thrust' && state.opening ? '첫 공격을 읽었습니다. 이어지는 찌르기도 받아내세요.' : intent === 'recover' ? '이어갈 틈을 만들지 못했습니다. 호흡을 되찾을 수 있습니다.' : '몸짓을 읽고 대응할 동작을 고르세요.'}</strong>}</section>}
      </section>

      <aside className="captain-trial-console">
        {!hadori && <><dl className="captain-trial-stats" aria-live="polite"><div><dt>균형</dt><dd>{state.poise}<small> / 6</small></dd></div><div><dt>호흡</dt><dd>{state.breath}<small> / 4</small></dd></div><div><dt>동작</dt><dd>{state.turn}<small> / {captainTrialRules.turnLimit}</small></dd></div></dl><div className="captain-trial-meter" role="meter" aria-label="라온의 균형" aria-valuemin={0} aria-valuemax={6} aria-valuenow={state.poise}>{Array.from({ length: 6 }, (_, index) => <i className={index < state.poise ? 'filled' : ''} key={index} />)}</div></>}
        {state.phase === 'ready' && <section className="captain-trial-message"><span>{hadori ? '제1조장 도전전' : '선택한 마음으로'}</span><h2>{hadori ? '남은 한 사람을 향해.' : '이제 선택을 검로로.'}</h2><p>{approach?.pending ?? definition.prelude}</p>{!hadori && <ul><li>찌르기는 창 흘리기, 넓은 공격은 비켜딛기로 받습니다.</li><li>상대가 거둘 때, 만들어 둔 틈에 검로를 잇습니다.</li><li>호흡이 부족하면 거리를 두세요. 균형이 0이 되면 다시 시도합니다.</li><li>동작을 실행할 때만 공방이 진행됩니다.</li></ul>}<button className="captain-trial-primary" onClick={onStart}>{hadori ? '하도리 앞에 서기' : '대결 시작'} <ArrowRight size={17} /></button></section>}
        {active && hadori && <section className="captain-trial-message"><span>라온의 첫 발</span><h2>배운 검을 어디까지 이을 수 있을까.</h2><p>라온은 하도리 앞에서 자세를 잡습니다. 자신의 발로 그 거리에 들어섭니다.</p><button className="captain-trial-primary" onClick={() => onAction('challenge')}>첫 발을 내딛기 <Footprints size={17} /></button></section>}
        {active && !hadori && <form ref={commandRef} onSubmit={submit}>
          <div className="captain-trial-console-title"><span>라온의 대응</span><h2>{counterReady ? '열린 틈을 이을 차례.' : '읽고, 흘리고, 다시 잇기.'}</h2><p className="captain-trial-inline-cue">{cue.label} · {counterReady ? '반격 가능' : counterNeedsBreath ? '호흡을 되찾을 차례' : cue.hint}</p></div>
          <fieldset className="captain-trial-actions"><legend>이번 공방의 동작</legend>{actions.map(({ id, label, Icon, description }) => {
            const allowed = canApplyCaptainTrialAction(state, id);
            const next = allowed ? resolveCaptainTrialAction(state, id) : undefined;
            const unavailable = id === 'counter' ? intent !== 'recover' ? '상대가 거둘 때 사용할 수 있습니다.' : !state.opening ? '방어로 만든 틈이 필요합니다.' : '호흡이 부족합니다.' : '호흡이 부족합니다.';
            return <label className={`${selected === id ? 'selected' : ''} ${!allowed ? 'unavailable' : ''}`} key={id}><input type="radio" name="captain-trial-action" value={id} checked={selected === id} disabled={!allowed} onChange={() => setSelected(id)} /><Icon size={19} /><span><strong>{label}</strong><small>{description}</small><em>{next ? `균형 ${signed(next.poise - state.poise)} · 호흡 ${signed(next.breath - state.breath)}${next.progress > state.progress ? ` · 승부 +${next.progress - state.progress}` : ''}` : unavailable}</em></span></label>;
          })}</fieldset>
          <div className={`captain-trial-preview ${preview?.phase === 'failed' || (preview && preview.poise < state.poise) ? 'danger' : ''}`} aria-live="polite">{preview ? <><strong>실행 후 균형 {preview.poise}/6 · 호흡 {preview.breath}/4 · 승부 {preview.progress}/3</strong><p>{preview.phase === 'failed' ? '이번 동작으로 대결 시도가 중단됩니다.' : preview.phase === 'resolved' ? '마지막 흐름이 이어집니다. 검을 거두고 승부를 확인하세요.' : preview.poise < state.poise ? '공격을 받아 균형을 잃습니다. 상대의 움직임을 다시 살펴보세요.' : preview.opening ? '상대의 흐름을 읽었습니다. 다음 움직임을 확인하세요.' : '선택한 동작 뒤 상대의 다음 움직임으로 이어집니다.'}</p></> : <p>동작을 고르면 균형과 호흡의 변화를 미리 볼 수 있습니다.</p>}</div>
          <button className="captain-trial-primary" type="submit" disabled={!legal}>선택한 대응 실행 <ArrowRight size={17} /></button>
        </form>}
        {state.phase === 'failed' && <section className="captain-trial-message" ref={resultRef} tabIndex={-1} role="alert"><span>이번 시도 중단</span><h2>끊긴 공방을 다시 읽자.</h2><p>{state.poise === 0 ? '라온이 균형을 잃어 검로를 이어가지 못했습니다.' : '정해진 동작 안에 승부를 마무리하지 못했습니다.'} 같은 선택으로 대결을 처음부터 다시 시도할 수 있습니다.</p><button className="captain-trial-primary" onClick={onRetry}><RotateCcw size={16} /> 대결 다시 시도</button></section>}
        {state.phase === 'resolved' && <section className="captain-trial-message" ref={resultRef} tabIndex={-1}><span>{hadori ? '도전전 종료' : '마지막 흐름'}</span><h2>{hadori ? '한 방, 그리고 의무동.' : '검을 거두고 마주 선다.'}</h2><p>{hadori ? '하도리의 한 방으로 도전전은 끝났습니다. 라온은 의무동에서 눈을 뜹니다.' : `${definition.opponent}의 흐름을 끊고 마지막 검로를 이었습니다. 검을 거두고 승부를 마무리하세요.`}</p><button className="captain-trial-primary" onClick={onComplete}>{hadori ? '의무동에서 눈뜨기' : '검을 거두고 승부 확인'} <ArrowRight size={17} /></button></section>}
        {state.phase === 'complete' && <section className="captain-trial-message" ref={resultRef} tabIndex={-1}><span><Check size={17} /> 대결을 마쳤습니다</span><h2>{hadori ? '하도리와 나눌 말.' : '다음 상대를 향해.'}</h2><p>{approach?.completion ?? definition.completion}</p>{hadori ? <p>이어서 의무동에서 하도리와 대화합니다.</p> : <button className="captain-trial-primary" onClick={onAdvance}>{definition.nextLabel} <ArrowRight size={17} /></button>}</section>}
        <section className="captain-trial-log"><h3>공방 기록</h3><ol>{state.log.slice(0, 4).map((line, index) => <li key={`${state.sceneId}-${state.attempt}-${state.turn}-${index}`}>{line}</li>)}</ol></section><p className="captain-trial-save-note">실행한 동작과 대결 진행은 자동 저장됩니다. 타이틀에서 이어갈 수 있습니다.</p>
      </aside>
    </div>
  </main>;
}
