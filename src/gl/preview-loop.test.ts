import { describe, expect, it, vi } from 'vitest';

import { startPreviewLoop } from './preview-loop';

// Zeitplaner zum Auslösen einzelner Bilder von Hand.
function manualScheduler() {
  const queue: (() => void)[] = [];
  return {
    schedule: (callback: () => void) => {
      queue.push(callback);
      return queue.length;
    },
    cancel: vi.fn(),
    runNext: () => queue.shift()?.(),
    pending: () => queue.length,
  };
}

describe('startPreviewLoop', () => {
  it('zeichnet bei jedem Durchlauf und plant den nächsten', () => {
    const scheduler = manualScheduler();
    const frame = vi.fn();
    startPreviewLoop(frame, scheduler.schedule, scheduler.cancel);
    expect(frame).not.toHaveBeenCalled();
    scheduler.runNext();
    scheduler.runNext();
    expect(frame).toHaveBeenCalledTimes(2);
    expect(scheduler.pending()).toBe(1);
  });

  it('hört nach dem Stopp auf und bricht den geplanten Durchlauf ab', () => {
    const scheduler = manualScheduler();
    const frame = vi.fn();
    const stop = startPreviewLoop(frame, scheduler.schedule, scheduler.cancel);
    scheduler.runNext();
    stop();
    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    scheduler.runNext();
    expect(frame).toHaveBeenCalledTimes(1);
    expect(scheduler.pending()).toBe(0);
  });

  it('nutzt standardmäßig requestAnimationFrame', () => {
    const request = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(7);
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockReturnValue(undefined);
    const stop = startPreviewLoop(vi.fn());
    expect(request).toHaveBeenCalledTimes(1);
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
    request.mockRestore();
    cancel.mockRestore();
  });
});
