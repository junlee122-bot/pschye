import Phaser from 'phaser';

export function stabilizePhaserRuntime(game: Phaser.Game, sceneKey: string) {
  const resume = () => {
    game.resume();
    game.loop.wake();
    if (game.scene.isPaused(sceneKey)) game.scene.resume(sceneKey);
  };

  const resumeTimer = window.setTimeout(resume, 80);
  game.events.once(Phaser.Core.Events.READY, resume);
  window.addEventListener('focus', resume);

  return () => {
    game.events.off(Phaser.Core.Events.READY, resume);
    window.removeEventListener('focus', resume);
    window.clearTimeout(resumeTimer);
  };
}
