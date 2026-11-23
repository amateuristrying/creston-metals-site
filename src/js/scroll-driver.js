/** A paused scroll playhead: wall-clock time never advances a sequence. */
export function createScrollDriver(render) {
  let progress = 0;
  let active = false;
  let dirty = true;
  return {
    setProgress(value) {
      const next = Math.max(0, Math.min(1, value));
      if (next !== progress) {
        progress = next;
        dirty = true;
      }
    },
    setActive(value) {
      if (value && !active) dirty = true;
      active = value;
    },
    invalidate() {
      dirty = true;
    },
    frame() {
      if (!active || !dirty) return;
      // One deterministic minute of effects; seeking backwards restores the same frame.
      render(progress, progress * 60);
      dirty = false;
    },
  };
}
