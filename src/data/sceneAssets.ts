export type StorySceneAssetVariant = 'explore' | 'dialogue' | 'battle' | 'aftermath';

export const storySceneVariantLabels: Record<StorySceneAssetVariant, string> = {
  explore: '탐험',
  dialogue: '대화',
  battle: '전투',
  aftermath: '전후',
};

export function getStoryEpisodeAsset(episodeId: string, variant: StorySceneAssetVariant = 'explore') {
  return `/art/story/scenes/${episodeId}/${variant}.webp`;
}

export function getStoryEpisodeThumbnail(episodeId: string) {
  return `/art/story/scenes/${episodeId}/thumb.webp`;
}

export function getStoryBeatAsset(episodeId: string, localOrder: number) {
  return `/art/story/scenes/${episodeId}/beats/${String(localOrder).padStart(2, '0')}.webp`;
}
