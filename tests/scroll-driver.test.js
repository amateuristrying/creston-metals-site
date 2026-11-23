import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollDriver } from '../src/js/scroll-driver.js';

function setup() {
  const frames = [];
  const driver = createScrollDriver((progress, time) => frames.push({ progress, time }));
  driver.setActive(true);
  return { driver, frames };
}

test('a stationary scroll position holds its frame regardless of elapsed time', () => {
  const { driver, frames } = setup();
  driver.setProgress(0.9);
  driver.frame(1000);
  driver.frame(5000);
  driver.frame(60000);
  assert.deepEqual(frames, [{ progress: 0.9, time: 54 }]);
});

test('reverse scrolling restores the same playhead and effect time', () => {
  const { driver, frames } = setup();
  for (const p of [0.2, 0.95, 0.2]) {
    driver.setProgress(p);
    driver.frame();
  }
  assert.deepEqual(frames[0], frames[2]);
  assert.equal(frames[1].progress, 0.95);
});

test('offscreen scenes seek to the latest scroll position on re-entry', () => {
  const { driver, frames } = setup();
  driver.setActive(false);
  driver.setProgress(0.25);
  driver.frame();
  driver.setProgress(0.6);
  driver.frame();
  assert.equal(frames.length, 0);
  driver.setActive(true);
  driver.frame();
  assert.deepEqual(frames, [{ progress: 0.6, time: 36 }]);
});

test('theme or size changes redraw without advancing animation', () => {
  const { driver, frames } = setup();
  driver.setProgress(0.5);
  driver.frame();
  driver.invalidate();
  driver.frame();
  assert.equal(frames.length, 2);
  assert.deepEqual(frames[0], frames[1]);
});
