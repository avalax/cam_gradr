// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { setLocale } from '../lang';
import { useColorChartStore } from '../chart/chart-store';
import { usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';
import { cameraSwitchStandIn } from '../test-support/camera-switch';
import { dummyReference, dummyReferenceJson } from '../test-support/dummy-reference';
import { createFakeGl } from '../test-support/fake-gl';
import { IDENTITY_MODEL } from '../test-support/identity-model';
import { chooseInvert } from '../test-support/look-cubes';
import { installFakeCamera, installMediaStubs } from '../test-support/media';
import { grayFrame } from '../test-support/frames';
import {
  computeModel,
  syntheticFit,
  syntheticMeasurements,
} from '../test-support/synthetic-camera';

import PreviewTab from './PreviewTab.vue';

const { fitOnce } = await vi.hoisted(() => import('../test-support/fit-once'));
vi.mock(import('../solve/fit'), async (original) => fitOnce(await original()));
const { lutOnce } = await vi.hoisted(() => import('../test-support/lut-once'));
vi.mock(import('../lut/lut'), async (original) => lutOnce(await original()));

const reference = dummyReference();
const measurements = syntheticMeasurements();

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
  // The draw cycle runs by hand, on a fake graphics card; a test that needs other contexts mocks
  // them again.
  let animation: ReturnType<typeof mockAnimation>;
  let fake: ReturnType<typeof createFakeGl>;

  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    installFakeCamera();
    animation = mockAnimation();
    fake = mockContexts();
    // While the preview is open, the shown still image is its own, as the app arranges it.
    useCameraStore().stillOwner = 'preview';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for a computed color correction first', async () => {
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="preview-no-source"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="wipe-line"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-canvas"]').attributes('style')).toContain(
      'display: none',
    );
    // Without a correction the band names what is missing, also while the camera runs: the preview
    // shows no camera image then.
    const band = wrapper.get('[data-testid="stage-label"]');
    expect(band.text()).toBe('Noch keine Korrektur');
    expect(band.attributes('data-state')).toBe('off');
    await useCameraStore().start();
    await flushPromises();
    expect(band.text()).toBe('Noch keine Korrektur');
    expect(wrapper.find('[data-testid="preview-source"]').exists()).toBe(false);
    // The icon of the placeholder has no circle: the tests count the corner points as circles.
    expect(wrapper.find('circle').exists()).toBe(false);
  });

  it('points to camera or still image without an image source', () => {
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-model"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-no-source"]').text()).toContain('„Kamera starten“');
    // Without an image the band says what the camera does, as on the card tabs.
    expect(wrapper.get('[data-testid="stage-label"]').text()).toBe('Kamera aus');
  });

  it('shows a camera error on the image, over a placeholder that keeps only its title', async () => {
    installFakeCamera({ open: () => Promise.reject(new Error('x')) });
    const wrapper = mount(PreviewTab);
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.get('[data-testid="camera-error"]').text()).toContain('nicht gestartet');
    expect(wrapper.get('[data-testid="preview-no-model"]').text()).toBe('Noch keine Korrektur');
    computeModel();
    await flushPromises();
    expect(wrapper.get('[data-testid="preview-no-source"]').text()).toBe('Noch kein Bild');
  });

  it('captures a still image in the live view and then switches the camera off', async () => {
    computeModel();
    const camera = useCameraStore();
    const capture = vi.spyOn(camera, 'captureStill').mockImplementation(() => {
      camera.still = grayFrame(8, 4, 0.4);
      return Promise.resolve();
    });
    const wrapper = mount(PreviewTab);
    // The button sits in the image corner and only appears with the live image.
    const take = () => wrapper.find('[data-testid="preview-capture"]');
    expect(take().exists()).toBe(false);

    await camera.start();
    await flushPromises();
    // A badge on the image says live image or still image, as the band of the card tabs does.
    expect(wrapper.get('[data-testid="preview-source"]').text()).toBe('Livebild');
    expect(take().attributes('aria-label')).toBe('Standbild aufnehmen');
    expect(take().attributes('disabled')).toBeDefined();
    await wrapper.get('video').trigger('loadeddata');
    expect(take().attributes('disabled')).toBeUndefined();
    const cameraSwitch = cameraSwitchStandIn();
    await take().trigger('click');
    await flushPromises();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(camera.status).toBe('idle');
    expect(camera.still).not.toBeNull();
    expect(take().exists()).toBe(false);
    // The button left with the live image: the focus is on the camera switch.
    expect(document.activeElement).toBe(cameraSwitch);
    cameraSwitch.remove();
    expect(wrapper.get('[data-testid="preview-source"]').text()).toBe('Standbild');
    await camera.start();
    await flushPromises();
    expect(camera.still).toBeNull();
  });

  it('keeps the camera on when the capture yields no still image', async () => {
    computeModel();
    const camera = useCameraStore();
    vi.spyOn(camera, 'captureStill').mockResolvedValue();
    const wrapper = mount(PreviewTab);
    await camera.start();
    await flushPromises();
    await wrapper.get('video').trigger('loadeddata');
    await wrapper.get('[data-testid="preview-capture"]').trigger('click');
    await flushPromises();
    expect(camera.status).toBe('live');
  });

  it('shows the image of the color measurement as long as the preview has none of its own', () => {
    computeModel();
    const camera = useCameraStore();
    camera.still = grayFrame(8, 4, 0.4);
    camera.swapStill('color', 'preview');
    expect(camera.still).toBeNull();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="preview-no-source"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-canvas"]').isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="wipe-line"]').exists()).toBe(true);
  });

  it('loads the LUT and draws the still image with the divider line on the graphics card', async () => {
    computeModel();
    useCameraStore().still = grayFrame(8, 4, 0.4);
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
    await flushPromises();
    expect(wrapper.get('[data-testid="preview-renderer"]').attributes('data-renderer')).toBe(
      'webgl2',
    );
  });

  it('lays the chosen look LUT over the correction and can show the correction left', async () => {
    computeModel();
    useCameraStore().still = grayFrame(8, 4, 0.4);
    await chooseInvert();
    const preview = usePreviewStore();
    const wrapper = mount(PreviewTab);
    const labels = () => wrapper.get('[data-testid="preview-labels"]').text();
    const floats = () =>
      Object.fromEntries(
        fake
          .call('uniform1f')
          .mock.calls.map(([location, value]) => [
            (location as { name: string }).name,
            value as number,
          ]),
      );
    expect(wrapper.find('[data-testid="look-bar"]').exists()).toBe(true);
    expect(labels()).toBe('KameraKorrigiert + Look-LUT 100 %');
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(1);

    preview.setStrength(50);
    await flushPromises();
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(2);
    preview.setLeft('corrected');
    await flushPromises();
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(3);
    expect(labels()).toBe('KorrigiertKorrigiert + Look-LUT 50 %');
    animation.runFrame();
    expect(floats()).toMatchObject({ uLeftCorrected: 1 });

    preview.setLook(null);
    await flushPromises();
    expect(labels()).toBe('KameraKorrigiert');
    animation.runFrame();
    expect(floats()).toMatchObject({ uLeftCorrected: 0 });
  });

  it('switches both sides with a click on their labels, the right one to the look alone', async () => {
    computeModel();
    useCameraStore().still = grayFrame(8, 4, 0.4);
    await chooseInvert();
    const preview = usePreviewStore();
    const wrapper = mount(PreviewTab);
    const labels = () => wrapper.get('[data-testid="preview-labels"]').text();
    expect(wrapper.get('[data-testid="labels-right"]').attributes('title')).toBe(
      'Klicken: Look-LUT ohne Korrektur',
    );

    await wrapper.get('[data-testid="labels-right"]').trigger('click');
    expect(preview.right).toBe('camera');
    expect(labels()).toBe('KameraKamera + Look-LUT 100 %');
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(2);
    // Without correction the inverting look turns black into white.
    const bytes = fake.call('texImage3D').mock.calls[1]?.[9] as Uint8Array;
    expect([...bytes.slice(0, 3)]).toEqual([255, 255, 255]);

    await wrapper.get('[data-testid="labels-left"]').trigger('click');
    expect(preview.left).toBe('corrected');
    expect(labels()).toBe('KorrigiertKamera + Look-LUT 100 %');
    // The divider names the sides that are shown.
    const wipe = wrapper.get('[data-testid="wipe"]');
    expect(wipe.attributes('aria-label')).toBe(
      'Trennlinie: links Korrigiert, rechts Kamera + Look-LUT 100 %',
    );
    expect(wipe.attributes('aria-valuetext')).toBe('50 % Korrigiert');
    await wrapper.get('[data-testid="labels-left"]').trigger('click');
    await wrapper.get('[data-testid="labels-right"]').trigger('click');
    expect(preview.left).toBe('camera');
    expect(preview.right).toBe('corrected');
    expect(wrapper.get('[data-testid="labels-right"]').attributes('title')).toBe(
      'Klicken: Look-LUT ohne Korrektur',
    );
    await wrapper.get('[data-testid="labels-right"]').trigger('click');
    expect(wrapper.get('[data-testid="labels-right"]').attributes('title')).toBe(
      'Klicken: Look-LUT mit Korrektur',
    );
  });

  it('draws the video image while the camera is running as soon as it has data', async () => {
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
    // The live image changes all the time and is drawn on every repaint.
    animation.runFrame();
    expect(fake.call('texImage2D')).toHaveBeenCalledTimes(2);
  });

  it('draws nothing without a source', () => {
    computeModel();
    mount(PreviewTab);
    animation.runFrame();
    expect(fake.call('drawArrays')).not.toHaveBeenCalled();
  });

  it('draws an unchanged still image only once', () => {
    computeModel();
    useCameraStore().still = grayFrame(8, 4, 0.4);
    const wrapper = mount(PreviewTab);
    animation.runFrame();
    animation.runFrame();
    animation.runFrame();
    expect(fake.call('drawArrays')).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="preview-canvas"]').element).toHaveProperty('width', 8);
  });

  it('draws the still image again when the divider, the correction or the image changes', async () => {
    computeModel();
    const camera = useCameraStore();
    camera.still = grayFrame(8, 4, 0.4);
    mount(PreviewTab);
    animation.runFrame();
    usePreviewStore().setSplit(30);
    await flushPromises();
    animation.runFrame();
    expect(fake.call('drawArrays')).toHaveBeenCalledTimes(2);
    useSolveStore().loadModel({ ...syntheticFit().model }, null);
    await flushPromises();
    animation.runFrame();
    expect(fake.call('drawArrays')).toHaveBeenCalledTimes(3);
    camera.still = grayFrame(4, 2, 0.6);
    await flushPromises();
    animation.runFrame();
    animation.runFrame();
    expect(fake.call('drawArrays')).toHaveBeenCalledTimes(4);
  });

  it('updates the LUT when the color correction changes', async () => {
    computeModel();
    mount(PreviewTab);
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(1);
    useSolveStore().loadModel({ ...syntheticFit().model }, null);
    await flushPromises();
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(2);
    // A failed calculation leaves no model.
    useSolveStore().compute({ measurements: {}, reference });
    await flushPromises();
    expect(fake.call('texImage3D')).toHaveBeenCalledTimes(2);
  });

  it('sets the divider line via the wipe', async () => {
    computeModel();
    useCameraStore().still = grayFrame(8, 4, 0.4);
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="wipe"]').trigger('keydown', { key: 'End' });
    expect(usePreviewStore().split).toBe(100);
    expect(wrapper.get('[data-testid="wipe-line"]').attributes('style')).toContain('left: 100%');
  });

  it('shows the colors first: a grid of the colored patches and the largest deviations', () => {
    computeModel();
    useColorChartStore().measurements = measurements;
    const wrapper = mount(PreviewTab);
    expect(
      wrapper.get('[data-testid="color-tiles"]').findAll('[data-patch]').length,
    ).toBeGreaterThan(0);
    expect(
      wrapper.get('[data-testid="preview-view"] [data-option="colors"]').attributes('aria-checked'),
    ).toBe('true');
    expect(
      wrapper.get('[data-testid="preview-view"] [data-option="grays"]').attributes('aria-checked'),
    ).toBe('false');
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="worst-patches"]').text()).toContain('Größte Abweichung');
  });

  it('shows targets only from the set the correction was fitted with', async () => {
    const references = useReferenceStore();
    await references.importFile('mein.json', dummyReferenceJson('Mein Satz'));
    useColorChartStore().measurements = measurements;
    useSolveStore().compute({ measurements, reference: references.selected ?? reference });
    const wrapper = mount(PreviewTab);
    const stripes = () =>
      new Set(wrapper.findAll('[data-stripe]').map((stripe) => stripe.attributes('data-stripe')));
    expect(stripes().has('target')).toBe(true);
    expect(wrapper.text()).toContain('Jedes Feld: Soll, Kamera, korrigiert');

    // A correction loaded with a set that is missing here: no targets from the active set.
    useSolveStore().loadModel(syntheticFit().model, 'Fehlender Satz');
    await flushPromises();
    expect(stripes().has('target')).toBe(false);
    expect(wrapper.text()).toContain('Jedes Feld: Kamera, korrigiert');
  });

  it('switches to the gray wedge with the tonal ranges and the result, and back to colors', async () => {
    computeModel();
    useColorChartStore().measurements = measurements;
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="preview-view"] [data-option="grays"]').trigger('click');
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="preview-view"] [data-option="grays"]').attributes('aria-checked'),
    ).toBe('true');
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="zone-changes"]').text()).toContain('Schatten');
    expect(wrapper.get('[data-testid="preview-summary"]').text()).toContain('Ø Abweichung');
    expect(wrapper.find('[data-testid="preview-side-empty"]').exists()).toBe(false);
    await wrapper.get('[data-testid="preview-view"] [data-option="colors"]').trigger('click');
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
  });

  it('calls tonal ranges neutral where the correction shifts no color', async () => {
    useSolveStore().loadModel(IDENTITY_MODEL, null);
    const wrapper = mount(PreviewTab);
    await wrapper.get('[data-testid="preview-view"] [data-option="grays"]').trigger('click');
    expect(wrapper.get('[data-testid="zone-changes"]').text()).toContain('neutral');
    // A correction without a report says so in the band, as under the color cards' divider.
    expect(wrapper.get('[data-testid="preview-summary"]').text()).toBe(
      'Ohne Bericht (Referenz fehlt)',
    );
  });

  it('says without a measurement that color cards are missing for the views', async () => {
    computeModel();
    const wrapper = mount(PreviewTab);
    expect(wrapper.find('[data-testid="color-tiles"]').exists()).toBe(false);
    await wrapper.get('[data-testid="preview-view"] [data-option="grays"]').trigger('click');
    expect(wrapper.find('[data-testid="gray-wedge"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="preview-side-empty"]').text()).toContain('Farbkarten');
  });

  it('leaves the column empty without a correction, in both views: the image says what is missing', async () => {
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('[data-testid="preview-no-model"]').text()).toContain(
      'Noch keine Korrektur',
    );
    expect(wrapper.find('[data-testid="preview-side-empty"]').exists()).toBe(false);
    await wrapper.get('[data-testid="preview-view"] [data-option="grays"]').trigger('click');
    expect(wrapper.find('[data-testid="preview-side-empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="zone-changes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="preview-summary"]').exists()).toBe(false);
  });

  it('binds a running stream and follows a new one', async () => {
    await useCameraStore().start();
    const wrapper = mount(PreviewTab);
    expect(wrapper.get('video').element.srcObject).not.toBeNull();
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.get('video').element.srcObject).not.toBeNull();
  });

  it('falls back to software rendering without WebGL2 and draws downscaled', async () => {
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
    useCameraStore().still = grayFrame(960, 540);
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
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('WebGL2');
  });

  it('reports errors when creating the renderer', async () => {
    mockContexts(createFakeGl({ getShaderParameter: () => false }));
    const wrapper = mount(PreviewTab);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Shader konnte nicht übersetzt werden');
    setLocale('en');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Shader could not be compiled');
  });

  it('ends the draw cycle and releases WebGL resources', () => {
    const wrapper = mount(PreviewTab);
    wrapper.unmount();
    expect(animation.cancel).toHaveBeenCalled();
    expect(fake.call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('cleans up properly even without a renderer', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mount(PreviewTab);
    expect(() => {
      wrapper.unmount();
    }).not.toThrow();
  });
});
