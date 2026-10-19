import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackHeight } from './panel-height';

class FakeObserver {
  static instances: FakeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) {
    FakeObserver.instances.push(this);
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  fire(entries: Partial<ResizeObserverEntry>[]): void {
    this.callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

describe('trackHeight', () => {
  afterEach(() => {
    FakeObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it('meldet die gerundete Höhe und beendet die Beobachtung', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ height: 452.4 } as DOMRect);
    const heights: number[] = [];
    const stop = trackHeight(element, (height) => {
      heights.push(height);
    });
    const observer = FakeObserver.instances[0];
    expect(observer?.observed).toEqual([element]);
    observer?.fire([{ target: element }]);
    expect(heights).toEqual([452]);
    observer?.fire([]);
    expect(heights).toEqual([452]);
    stop();
    expect(observer?.disconnected).toBe(true);
  });
});
