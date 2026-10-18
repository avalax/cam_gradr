import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useColorChartStore } from '../chart/chart-store';
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
    expect(wrapper.find('[data-testid="wipe-line"]').exists()).toBe(false);
  });

  it('weist ohne Bildquelle auf Kamera oder Standbild hin', () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-no-source"]').text()).toContain('Kamera');
  });

  it('nimmt im Livebild ein Standbild auf und kehrt zum Livebild zurück', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const camera = useCameraStore();
    const capture = vi.spyOn(camera, 'captureStill').mockResolvedValue();
    const wrapper = mount(PreviewTab);
    const take = wrapper.findAll('button').find((b) => b.text() === 'Standbild aufnehmen');
    expect(take?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).not.toContain('Zurück zum Livebild');

    await camera.start();
    await flushPromises();
    expect(take?.attributes('disabled')).toBeDefined();
    await wrapper.get('video').trigger('loadeddata');
    expect(take?.attributes('disabled')).toBeUndefined();
    await take?.trigger('click');
    expect(capture).toHaveBeenCalledTimes(1);

    camera.still = stillFrame();
    await flushPromises();
    expect(wrapper.text()).toContain('Neues Standbild aufnehmen');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Zurück zum Livebild')
      ?.trigger('click');
    expect(camera.still).toBeNull();
  });

  it('lädt die LUT und zeichnet das Standbild mit der Trennlinie', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    useCameraStore().still = stillFrame();
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
    expect(floats).toMatchObject({ uLutSize: 33, uSplit: 0.25 });
    expect(wrapper.get('[data-testid="wipe-line"]').attributes('style')).toContain('left: 25%');
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

  it('setzt die Trennlinie über den Wischer und hat keinen Regler mehr', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    useCameraStore().still = stillFrame();
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="wipe"]').trigger('keydown', { key: 'End' });
    expect(usePreviewStore().split).toBe(100);
    expect(wrapper.get('[data-testid="wipe-line"]').attributes('style')).toContain('left: 100%');
    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Stärke');
  });

  it('zeigt zuerst die Farben: ein Raster der bunten Felder und die größten Abweichungen', () => {
    mockAnimation();
    mockContexts();
    computeModel();
    useColorChartStore().measurements = measurements;
    const wrapper = mount(PreviewTab);
    const tiles = wrapper.get('[data-testid="color-tiles"]').findAll('[data-patch]');
    expect(tiles).toHaveLength(48 - NEUTRAL_IDS.size);
    expect(tiles.some((tile) => NEUTRAL_IDS.has(String(tile.attributes('data-patch'))))).toBe(
      false,
    );
    expect(wrapper.get('[data-testid="view-colors"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="view-grays"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="worst-patches"]').text()).toMatch(
      /^Größte Abweichung\s*\w\w \d+,\d · \w\w \d+,\d · \w\w \d+,\d$/,
    );
  });

  it('schaltet auf die Graustufen um und wieder zurück auf die Farben', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    useColorChartStore().measurements = measurements;
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="view-grays"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('[data-testid="view-colors"]').trigger('click');
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
  });

  it('zeigt bei den Graustufen den Graukeil, die Änderungen je Tonbereich und das Ergebnis', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    useColorChartStore().measurements = measurements;
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(wrapper.findAll('[data-column="camera"] [data-patch]')).toHaveLength(NEUTRAL_IDS.size);
    expect(
      wrapper
        .get('[data-testid="zone-changes"]')
        .findAll('dt')
        .map((term) => term.text()),
    ).toEqual(['Schatten', 'Mitten', 'Lichter']);
    expect(wrapper.get('[data-testid="preview-summary"]').text()).toMatch(
      /^Ø Abweichung [\d,]+ → [\d,]+$/,
    );
    expect(wrapper.find('[data-testid="preview-side-empty"]').exists()).toBe(false);
  });

  it('nennt Tonbereiche neutral, in denen die Korrektur keine Farbe verschiebt', async () => {
    mockAnimation();
    mockContexts();
    const identity = {
      curves: [
        { xs: [0, 1], ys: [0, 1] },
        { xs: [0, 1], ys: [0, 1] },
        { xs: [0, 1], ys: [0, 1] },
      ],
      matrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
    } as const;
    useSolveStore().loadModel(identity as never);
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(wrapper.get('[data-testid="zone-changes"]').text()).toContain('neutral');
    expect(wrapper.find('[data-testid="preview-summary"]').exists()).toBe(false);
  });

  it('sagt ohne Messung, dass für die Ansichten Farbkarten fehlen', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(false);
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain('Farbkarten');
  });

  it('zeigt ohne Korrektur nur den Hinweis und kein Ergebnis', () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain(
      'Noch keine Korrektur',
    );
    expect(wrapper.find('[data-testid="zone-changes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="preview-summary"]').exists()).toBe(false);
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
