import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCameraStore } from './camera-store';

// Deliberately uses the default adapter; the test environment provides no camera.
describe('useCameraStore with default adapter', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reports missing camera access clearly', async () => {
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(store.errorMessage).toContain('nicht unterstützt');
  });
});
