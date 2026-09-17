const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const phaser = '<LOCAL_REPOSITORY>/node_modules/phaser/src';
const Zoom = require(`${phaser}/cameras/2d/effects/Zoom.js`);
const Cubic = require(`${phaser}/math/easing/cubic/index.js`);
const ZOOM_COMPLETE = require(`${phaser}/cameras/2d/events/ZOOM_COMPLETE_EVENT.js`);
const makeCamera = () => {
  const camera = new EventEmitter();
  camera.zoom = 1;
  camera.scene = {};
  const effect = new Zoom(camera);
  camera.zoomTo = (...args) => effect.start(...args);
  return { camera, effect };
};
const result = { scope: 'Installed Phaser Zoom effect contract diagnostic. Camera emitter stub only; this is not browser play.', originalBrowserErrors: 2 };
const old = makeCamera();
try { old.camera.zoomTo(1.018, 90, 'Cubic.Out', true); old.effect.update(16, 16); }
catch (error) { result.original = { message: error.message, stack: error.stack }; }
assert.equal(result.original?.message, 'this.ease is not a function');
const fixed = makeCamera();
fixed.camera.once(ZOOM_COMPLETE, () => fixed.camera.zoomTo(1, 160, Cubic.In, true));
fixed.camera.zoomTo(1.018, 90, Cubic.Out, true);
for (let time = 10; time <= 500; time += 10) fixed.effect.update(time, 10);
assert.equal(fixed.camera.zoom, 1);
assert.equal(fixed.effect.isRunning, false);
result.fixed = { noError: true, finalZoom: fixed.camera.zoom, running: fixed.effect.isRunning };
fs.writeFileSync(path.join(__dirname, 'native-battle-zoom-contract.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
