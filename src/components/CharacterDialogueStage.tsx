import { useEffect, useState, type CSSProperties } from 'react';
import { Eye, Image, Sparkles, X } from 'lucide-react';
import {
  characterPresentations,
  getCharacterCardAsset,
  getCharacterPresentation,
  getEmotionLabel,
  type CharacterSceneDirection,
} from '../data/characterPresentation';

interface CharacterDialogueStageProps {
  speakerId: string;
  speakerName: string;
  speakerRole: string;
  speakerArt: string;
  dialogue: string;
  direction: CharacterSceneDirection;
  contextLabel?: string;
  compact?: boolean;
}

export function CharacterDialogueStage({
  speakerId,
  speakerName,
  speakerRole,
  speakerArt,
  dialogue,
  direction,
  contextLabel,
  compact = false,
}: CharacterDialogueStageProps) {
  const [showArtwork, setShowArtwork] = useState(false);
  const raon = characterPresentations.raon;
  const speaker = getCharacterPresentation(speakerId, {
    name: speakerName,
    title: speakerRole,
    portrait: speakerArt,
  });
  const speakerCard = getCharacterCardAsset(speaker, direction.cardStage);

  useEffect(() => {
    const portrait = new window.Image();
    portrait.src = speaker.portrait;
    const card = new window.Image();
    card.src = speakerCard;
  }, [speaker.portrait, speakerCard]);

  const stageStyle = {
    '--speaker-accent': speaker.accent,
    '--speaker-focus': speaker.focus,
    '--raon-focus': raon.focus,
  } as CSSProperties;

  return (
    <section
      className={`character-dialogue-stage camera-${direction.camera} ${compact ? 'compact' : ''}`}
      style={stageStyle}
      aria-label={`${speakerName}과 라온의 대화`}
    >
      <div className="character-stage-light" aria-hidden="true" />

      <figure className="character-stage-figure player-figure" aria-label="라온">
        <img src={raon.portrait} alt="" decoding="async" />
        <figcaption>
          <small>PLAYER · {getEmotionLabel(direction.raonEmotion)}</small>
          <strong>라온</strong>
        </figcaption>
      </figure>

      <div className="character-stage-axis" aria-hidden="true">
        <span><Eye size={13} /> {direction.beatLabel}</span>
        <i />
        <small>{contextLabel ?? '말과 표정이 기억에 남습니다'}</small>
      </div>

      <figure className="character-stage-figure speaker-figure" aria-label={speakerName}>
        <img src={speaker.portrait} alt="" decoding="async" />
        <figcaption>
          <small>{getEmotionLabel(direction.speakerEmotion)}</small>
          <strong>{speakerName}</strong>
        </figcaption>
      </figure>

      <button
        className="character-art-button"
        type="button"
        onClick={() => setShowArtwork(true)}
        aria-haspopup="dialog"
      >
        <Image size={15} />
        <span>현재 시점 설정화</span>
      </button>

      <div className="character-dialogue-box">
        <div className="character-speaker-mark">
          <span style={{ background: speaker.accent }} />
          <div>
            <small>{speakerRole}</small>
            <strong>{speakerName}</strong>
          </div>
        </div>
        <p>“{dialogue}”</p>
        <Sparkles className="character-dialogue-spark" size={17} aria-hidden="true" />
      </div>

      {showArtwork && (
        <div className="character-art-inspector" role="dialog" aria-modal="true" aria-label={`${speakerName} 설정화`}>
          <button type="button" onClick={() => setShowArtwork(false)} aria-label="설정화 닫기">
            <X size={18} />
          </button>
          <img src={speakerCard} alt={`${speakerName} ${direction.beatLabel} 설정화`} />
          <div>
            <small>CHARACTER ART · {direction.cardStage.toUpperCase()}</small>
            <strong>{speakerName}</strong>
            <p>대화 화면에서는 감정과 시선을 우선하고, 원본 설정집 카드는 이 보기에서 온전히 확인합니다.</p>
          </div>
        </div>
      )}
    </section>
  );
}
