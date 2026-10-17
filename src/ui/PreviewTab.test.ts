import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { usePreviewStore } from '../lut/preview-store';
import { useSolveStore } from '../solve/solve-store';
import { createFakeGl } from '../test-support/fake-gl';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { installFakeCamera, installMediaStubs } from '../test-support/media';
import { cameraCode } from '../test-support/synthetic-camera';

import PreviewTab from './PreviewTab.vue';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);

function stillFrame() {
  return { width: 8, height: 4, data: new Float32Array(8 * 4 * 3).fill(0.4) };
}

function computeModel() {
  useSolveStore().compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
}

// Zeitplaner für den Zeichenzyklus: Durchläufe lassen sich von Hand auslösen.
function mockAnimation() {
  const callbacks: (() => void)[] = [];
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.push(() => {
      callback(0);
    });
    return callbacks.length;
  });
  const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockReturnValue(undefined);
  return {
    runFrame: () => callbacks.shift()?.(),
    cancel,
  };
}

function mockContexts(fake = createFakeGl()) {
  const context2d = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((id: string) =>
    id === 'webgl2' ? fake.gl : context2d) as never);
  return fake;
}

describe('PreviewTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    installFakeCamera();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verlangt zuerst eine berechnete Farbkorrektur', () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="preview-no-source"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="split-line"]').exists()).toBe(false);
  });

  it('weist ohne Bildquelle auf Kamera oder Standbild hin', () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-no-source"]').text()).toContain('Kamera');
  });

  it('lädt die LUT und zeichnet das Standbild mit Stärke und Trennlinie', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    useCameraStore().still = stillFrame();
    usePreviewStore().setStrength(60);
    usePreviewStore().setSplit(25);
    const wrapper = mount(PreviewTab);
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(1);
    animation.runFrame();
    expect(fake.call('texImage2D')).toHaveBeenCalledTimes(1);
    const floats = Object.fromEntries(
      fake
        .call('uniform1f')
        .mock.calls.map(([location, value]) => [
          (location as { name: string }).name,
          value as number,
        ]),
    );
    expect(floats).toMatchObject({ uLutSize: 33, uStrength: 0.6, uSplit: 0.25 });
    expect(wrapper.get('[data-testid="split-line"]').attributes('style')).toContain('left: 25%');
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toHaveProperty('width', 8);
  });

  it('zeichnet bei laufender Kamera das Videobild, sobald es Daten hat', async () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    await useCameraStore().start();
    const wrapper = mount(PreviewTab);
    await flushPromises();
    const video = wrapper.get('video').element;
    animation.runFrame();
    expect(fake.call('texImage2D')).not.toHaveBeenCalled();
    Object.defineProperties(video, {
      readyState: { value: 4, configurable: true },
      videoWidth: { value: 16, configurable: true },
      videoHeight: { value: 9, configurable: true },
    });
    animation.runFrame();
    expect(fake.call('texImage2D')).toHaveBeenCalledTimes(1);
    expect(fake.call('texImage2D').mock.calls[0]?.[5]).toBe(video);
  });

  it('zeichnet nichts ohne Quelle', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    mount(PreviewTab);
    animation.runFrame();
    expect(fake.call('drawArrays')).not.toHaveBeenCalled();
  });

  it('zeichnet bei unveränderter Größe ohne die Zeichenfläche neu anzulegen', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    useCameraStore().still = stillFrame();
    mount(PreviewTab);
    animation.runFrame();
    animation.runFrame();
    expect(fake.call('drawArrays')).toHaveBeenCalledTimes(2);
  });

  it('aktualisiert die LUT, wenn sich die Farbkorrektur ändert', async () => {
    mockAnimation();
    const fake = mockContexts();
    computeModel();
    mount(PreviewTab);
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(1);
    computeModel();
    await flushPromises();
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(2);
    useSolveStore().reset();
    await flushPromises();
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(2);
  });

  it('setzt Stärke und Trennlinie über die Regler', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="strength"]').setValue('40');
    await wrapper.get('[data-testid="split"]').setValue('70');
    expect(usePreviewStore().strength).toBe(40);
    expect(usePreviewStore().split).toBe(70);
    expect(wrapper.text()).toContain('Stärke der Korrektur: 40 %');
    expect(wrapper.text()).toContain('Trennlinie: 70 %');
  });

  it('bindet einen laufenden Stream an und folgt einem neuen', async () => {
    mockAnimation();
    mockContexts();
    await useCameraStore().start();
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('video').element.srcObject).not.toBeNull();
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.get('video').element.srcObject).not.toBeNull();
  });

  it('zeigt an, dass die Grafikkarte zeichnet', async () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[data-testid="preview-renderer"]').attributes('data-renderer')).toBe(
      'webgl2',
    );
  });

  it('weicht ohne WebGL2 auf die Software-Darstellung aus und zeichnet verkleinert', async () => {
    const animation = mockAnimation();
    const image = { data: new Uint8ClampedArray(480 * 270 * 4) };
    const context2d = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => image),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((id: string) =>
      id === 'webgl2' ? null : context2d) as never);
    computeModel();
    useCameraStore().still = { width: 960, height: 540, data: new Float32Array(960 * 540 * 3) };
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-renderer"]').attributes('data-renderer')).toBe('cpu');
    // Das Standbild wurde schon beim Einhängen auf die Arbeitsfläche gezeichnet.
    const before = context2d.putImageData.mock.calls.length;
    animation.runFrame();
    expect(context2d.putImageData).toHaveBeenCalledTimes(before + 1);
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toHaveProperty('width', 480);
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toHaveProperty('height', 270);
  });

  it('meldet fehlende WebGL2-Unterstützung', async () => {
    mockAnimation();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('WebGL2');
  });

  it('meldet Fehler beim Anlegen des Renderers', async () => {
    mockAnimation();
    mockContexts(createFakeGl({ getShaderParameter: () => false }));
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Shader konnte nicht übersetzt werden');
  });

  it('beendet den Zeichenzyklus und gibt WebGL-Ressourcen frei', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    const wrapper = mount(PreviewTab);
    wrapper.unmount();
    expect(animation.cancel).toHaveBeenCalled();
    expect(fake.call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('räumt auch ohne Renderer sauber auf', () => {
    mockAnimation();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mount(PreviewTab);
    expect(() => {
      wrapper.unmount();
    }).not.toThrow();
  });
});
