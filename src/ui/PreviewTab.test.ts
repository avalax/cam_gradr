import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { setLocale } from '../lang';
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

// Scheduler for the draw cycle: runs can be triggered by hand.
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

  it('asks for a computed color correction first', () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="preview-no-source"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="wipe-line"]').exists()).toBe(false);
  });

  it('points to camera or still image without an image source', () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-no-source"]').text()).toContain('Kamera');
  });

  it('captures a still image in the live view and then switches the camera off', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const camera = useCameraStore();
    const capture = vi.spyOn(camera, 'captureStill').mockImplementation(() => {
      camera.still = stillFrame();
      return Promise.resolve();
    });
    const wrapper = mount(PreviewTab);
    const take = () => wrapper.findAll('button').find((b) => b.text() === 'Standbild aufnehmen');
    expect(take()?.attributes('disabled')).toBeDefined();

    await camera.start();
    await flushPromises();
    expect(take()?.attributes('disabled')).toBeDefined();
    await wrapper.get('video').trigger('loadeddata');
    expect(take()?.attributes('disabled')).toBeUndefined();
    await take()?.trigger('click');
    await flushPromises();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(camera.status).toBe('idle');
    expect(camera.still).not.toBeNull();
    // There is no “Zurück zum Livebild” button: a new camera start shows the live view again.
    expect(wrapper.text()).not.toContain('Zurück zum Livebild');
    expect(take()?.attributes('disabled')).toBeDefined();
    await camera.start();
    await flushPromises();
    expect(camera.still).toBeNull();
  });

  it('keeps the camera on when the capture yields no still image', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const camera = useCameraStore();
    vi.spyOn(camera, 'captureStill').mockResolvedValue();
    const wrapper = mount(PreviewTab);
    await camera.start();
    await flushPromises();
    await wrapper.get('video').trigger('loadeddata');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Standbild aufnehmen')
      ?.trigger('click');
    await flushPromises();
    expect(camera.status).toBe('live');
  });

  it('names the camera and the corrected side above the image', async () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-labels"]').exists()).toBe(false);
    computeModel();
    useCameraStore().still = stillFrame();
    await wrapper.vm.$nextTick();
    const labels = wrapper.get('[data-testid="preview-labels"]').text();
    expect(labels).toContain('Kamera');
    expect(labels).toContain('Korrigiert');
  });

  it('shows the image of the color measurement as long as the preview has none of its own', () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const camera = useCameraStore();
    camera.still = stillFrame();
    camera.swapStill('color', 'preview');
    expect(camera.still).toBeNull();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-source"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-canvas"]').isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="wipe-line"]').exists()).toBe(true);
  });

  it('loads the LUT and draws the still image with the divider line', () => {
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

  it('draws the video image while the camera is running as soon as it has data', async () => {
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

  it('draws nothing without a source', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    mount(PreviewTab);
    animation.runFrame();
    expect(fake.call('drawArrays')).not.toHaveBeenCalled();
  });

  it('redraws at unchanged size without recreating the canvas', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    computeModel();
    useCameraStore().still = stillFrame();
    mount(PreviewTab);
    animation.runFrame();
    animation.runFrame();
    expect(fake.call('drawArrays')).toHaveBeenCalledTimes(2);
  });

  it('updates the LUT when the color correction changes', async () => {
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

  it('sets the divider line via the wipe and no longer has a slider', async () => {
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

  it('shows the colors first: a grid of the colored patches and the largest deviations', () => {
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

  it('switches to grayscale and back to colors', async () => {
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

  it('shows the gray wedge, the changes per tonal range and the result in grayscale', async () => {
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

  it('calls tonal ranges neutral where the correction shifts no color', async () => {
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

  it('says without a measurement that color cards are missing for the views', async () => {
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(false);
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain('Farbkarten');
  });

  it('shows only the hint and no result without a correction', () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain(
      'Noch keine Korrektur',
    );
    expect(wrapper.find('[data-testid="zone-changes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="preview-summary"]').exists()).toBe(false);
  });

  it('binds a running stream and follows a new one', async () => {
    mockAnimation();
    mockContexts();
    await useCameraStore().start();
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('video').element.srcObject).not.toBeNull();
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.get('video').element.srcObject).not.toBeNull();
  });

  it('indicates that the graphics card is drawing', async () => {
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[data-testid="preview-renderer"]').attributes('data-renderer')).toBe(
      'webgl2',
    );
  });

  it('falls back to software rendering without WebGL2 and draws downscaled', async () => {
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
    // The still image was already drawn to the work canvas on mount.
    const before = context2d.putImageData.mock.calls.length;
    animation.runFrame();
    expect(context2d.putImageData).toHaveBeenCalledTimes(before + 1);
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toHaveProperty('width', 480);
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toHaveProperty('height', 270);
  });

  it('reports missing WebGL2 support', async () => {
    mockAnimation();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('WebGL2');
  });

  it('reports errors when creating the renderer', async () => {
    mockAnimation();
    mockContexts(createFakeGl({ getShaderParameter: () => false }));
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Shader konnte nicht übersetzt werden');
  });

  it('ends the draw cycle and releases WebGL resources', () => {
    const animation = mockAnimation();
    const fake = mockContexts();
    const wrapper = mount(PreviewTab);
    wrapper.unmount();
    expect(animation.cancel).toHaveBeenCalled();
    expect(fake.call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('cleans up properly even without a renderer', () => {
    mockAnimation();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mount(PreviewTab);
    expect(() => {
      wrapper.unmount();
    }).not.toThrow();
  });
});

describe('PreviewTab (English)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    installFakeCamera();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows intro, placeholder and view switch in English', async () => {
    setLocale('en');
    mockAnimation();
    mockContexts();
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.text()).toContain('The preview shows the camera image');
    expect(wrapper.get('[data-testid="preview-no-model"]').text()).toContain(
      'No color correction yet',
    );
    expect(wrapper.get('[data-testid="preview-no-model"]').text()).toContain('“Color cards”');
    expect(wrapper.findAll('button').map((b) => b.text())).toContain('Take still image');
    expect(wrapper.get('[data-testid="view-colors"]').text()).toBe('Colors');
    expect(wrapper.get('[data-testid="view-grays"]').text()).toBe('Grays');
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain(
      'No correction yet.',
    );
    expect(wrapper.get('[data-testid="preview-renderer"]').text()).toBe(
      'Rendering: graphics card (WebGL2)',
    );
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain(
      'No correction yet.',
    );
  });

  it('shows placeholder without image and empty side column with model in English', () => {
    setLocale('en');
    mockAnimation();
    mockContexts();
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('[data-testid="preview-no-source"]').text()).toContain('No image yet');
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toBe(
      'This view needs measured color cards.',
    );
  });

  it('shows colors, grayscale, tonal ranges and result in English', async () => {
    setLocale('en');
    mockAnimation();
    mockContexts();
    computeModel();
    useColorChartStore().measurements = measurements;
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('[data-testid="worst-patches"]').text()).toContain('Largest deviation');
    expect(wrapper.text()).toContain('Each patch: target, camera, corrected');
    await wrapper.get('[data-testid="view-grays"]').trigger('click');
    expect(
      wrapper
        .get('[data-testid="zone-changes"]')
        .findAll('dt')
        .map((term) => term.text()),
    ).toEqual(['Shadows', 'Midtones', 'Highlights']);
    expect(wrapper.text()).toContain('Points on the 0–100 scale');
    expect(wrapper.get('[data-testid="preview-summary"]').text()).toMatch(
      /^Ø deviation [\d.]+ → [\d.]+$/,
    );
  });

  it('names the software rendering and errors in English', async () => {
    setLocale('en');
    mockAnimation();
    const context2d = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((id: string) =>
      id === 'webgl2' ? null : context2d) as never);
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[data-testid="preview-renderer"]').text()).toBe(
      'Rendering: software, downscaled (WebGL2 not available)',
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const failing = mount(PreviewTab);
    await flushPromises();
    expect(failing.get('[role="alert"]').text()).toContain(
      'Neither WebGL2 nor a 2D drawing context',
    );
  });
});
