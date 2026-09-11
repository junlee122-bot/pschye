import { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { ArchiveAsset } from '../types';

interface ImageLightboxProps {
  asset: ArchiveAsset;
  onClose: () => void;
}

export function ImageLightbox({ asset, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={asset.title}>
      <button onClick={onClose} aria-label="닫기"><X size={22} /></button>
      <figure>
        <img src={asset.image} alt={`${asset.title} — ${asset.subtitle}`} />
        <figcaption>
          <div><span>{asset.source === 'generated' ? <Sparkles size={14} /> : null}{asset.source === 'generated' ? 'NEWLY RESTORED' : 'SOURCE ARCHIVE'}</span><h2>{asset.title}</h2></div>
          <p>{asset.subtitle}</p>
        </figcaption>
      </figure>
    </div>
  );
}
