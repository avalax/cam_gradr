import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCameraStore } from './camera-store';

// Nutzt bewusst den Standard-Adapter; die Testumgebung stellt keine Kamera bereit.
describe('useCameraStore mit Standard-Adapter', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('meldet fehlenden Kamerazugriff verständlich', async () => {
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(store.errorMessage).toContain('nicht unterstützt');
  });
});
