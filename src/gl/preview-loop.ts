type Schedule = (callback: () => void) => number;
type Cancel = (handle: number) => void;

// Calls `frame` on every repaint until the returned function is called.
export function startPreviewLoop(
  frame: () => void,
  schedule: Schedule = (callback) => requestAnimationFrame(callback),
  cancel: Cancel = (handle) => {
    cancelAnimationFrame(handle);
  },
): () => void {
  let handle = 0;
  let running = true;
  const tick = (): void => {
    if (running) {
      frame();
      handle = schedule(tick);
    }
  };
  handle = schedule(tick);
  return () => {
    running = false;
    cancel(handle);
  };
}
