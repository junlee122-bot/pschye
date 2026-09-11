import type { DetailedHTMLProps, HTMLAttributes } from 'react';

interface ModelViewerAttributes extends DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> {
  src?: string;
  poster?: string;
  alt?: string;
  loading?: 'auto' | 'lazy' | 'eager';
  reveal?: 'auto' | 'interaction' | 'manual';
  exposure?: string;
  'shadow-intensity'?: string;
  'shadow-softness'?: string;
  'camera-orbit'?: string;
  'camera-target'?: string;
  'field-of-view'?: string;
  'interaction-prompt'?: 'auto' | 'none';
  'animation-name'?: string;
  'camera-controls'?: boolean;
  'auto-rotate'?: boolean;
  autoplay?: boolean;
  ar?: boolean;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}

export {};
