// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.vue';
import { useCameraStore } from './camera/camera-store';
import { useChartStore } from './chart/chart-store';
import { useProjectStore } from './project/project-store';
import { BUNDLED_NAME } from './reference/bundled';
import { useReferenceStore } from './reference/reference-store';
import { useSolveStore } from './solve/solve-store';
import { cubeFile, importLooks } from './test-support/look-cubes';
import { installFakeCamera, installMediaStubs } from './test-support/media';
import { grayFrame } from './test-support/frames';
import { APP_ID, APP_NAME } from './ui/app-info';
import { APP_VERSION } from './ui/app-version';

function mountApp(options: { attach?: boolean } = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(App, {
    global: { plugins: [pinia] },
    ...(options.attach === true && { attachTo: document.body }),
  });
}

function tabs(wrapper: ReturnType<typeof mountApp>) {
  return wrapper.findAll('[role="tab"]');
}

describe('App', () => {
  let api: ReturnType<typeof installFakeCamera>;

  beforeEach(() => {
    installMediaStubs();
    api = installFakeCamera();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows name, identifier, camera toggle, settings and initially the gray cards tab', () => {
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.get('[data-testid="camera-toggle"]').text()).toBe('Kamera starten');
    expect(wrapper.find('[data-testid="settings-button"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Dieser Tab stellt die Raumhelligkeit ein');
    expect(wrapper.get('footer').text()).toContain(APP_ID);
    expect(wrapper.get('footer').text()).toContain(`Version ${APP_VERSION}`);
  });

  it('names in the preview tab what lies left and right of the divider, as its labels do', async () => {
    const wrapper = mountApp();
    const preview = () => tabs(wrapper)[2]?.text();
    expect(preview()).toContain('Kamera / Korrigiert');
    // How the sides are named is up to preview-sides.ts; the tab follows the chosen look.
    await importLooks(cubeFile('Warm.cube'));
    await flushPromises();
    expect(preview()).toContain('Kamera / Korrigiert + Look-LUT');
  });

  it('shows the result in the tab: light is fine, but the colors still have a high deviation', async () => {
    const wrapper = mountApp();
    const gauges = () =>
      wrapper
        .findAll('[data-testid="status-gauge"]')
        .map((gauge) => gauge.attributes('data-level'));
    expect(gauges()).toEqual(['off', 'off']);
    expect(tabs(wrapper)[3]?.text()).toContain('.cube, Projekt');
    useChartStore().exposure = {
      verdict: 'ok',
      highlightsClipped: false,
      shadowsCrushed: false,
      level18: 0.46,
      level50: 0.74,
      delta: 0,
      contrast: 0,
    };
    useSolveStore().result = {
      model: {} as never,
      report: { meanBefore: 20.2, meanAfter: 8 },
    } as never;
    await flushPromises();
    const [gray, color] = tabs(wrapper);
    expect(gray?.text()).toContain('Licht passt');
    expect(color?.text()).toContain('Ø 20,2 → 8,0');
    expect(gauges()).toEqual(['ok', 'warn']);
  });

  it('offers four tabs, all freely selectable', () => {
    const wrapper = mountApp();
    const all = tabs(wrapper);
    expect(all.map((tab) => tab.attributes('aria-label'))).toEqual([
      'Graukarten',
      'Farbkarten',
      'Vorschau',
      'Export',
    ]);
    expect(all.map((tab) => tab.attributes('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true);
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe('tab-gray');
    expect(all[0]?.attributes('aria-describedby')).toBe('tab-hint-gray');
  });

  it('moves between the tabs with the arrow keys as one stop of the Tab key', async () => {
    const wrapper = mountApp();
    const stops = () => tabs(wrapper).map((tab) => tab.attributes('tabindex'));
    expect(stops()).toEqual(['0', '-1', '-1', '-1']);
    await tabs(wrapper)[0]?.trigger('keydown', { key: 'ArrowLeft' });
    expect(tabs(wrapper)[3]?.attributes('aria-selected')).toBe('true');
    expect(stops()).toEqual(['-1', '-1', '-1', '0']);
    await tabs(wrapper)[3]?.trigger('keydown', { key: 'Home' });
    expect(tabs(wrapper)[0]?.attributes('aria-selected')).toBe('true');
    // Up and down keep scrolling the page, other keys do nothing either.
    await tabs(wrapper)[0]?.trigger('keydown', { key: 'ArrowDown' });
    await tabs(wrapper)[0]?.trigger('keydown', { key: 'a' });
    expect(tabs(wrapper)[0]?.attributes('aria-selected')).toBe('true');
  });

  it('shows the camera switch in the export only while the camera runs', async () => {
    const wrapper = mountApp({ attach: true });
    const cameraSwitch = () => wrapper.find('[data-testid="camera-toggle"]');
    await tabs(wrapper)[3]?.trigger('click');
    expect(cameraSwitch().exists()).toBe(false);
    await useCameraStore().start();
    await flushPromises();
    expect(cameraSwitch().text()).toBe('Kamera stoppen');
    // Stopped by keyboard, the switch goes and hands the focus to the tab of the export.
    (cameraSwitch().element as HTMLButtonElement).focus();
    await cameraSwitch().trigger('click');
    expect(cameraSwitch().exists()).toBe(false);
    expect(document.activeElement?.id).toBe('tab-export');
    // A camera that stops while the focus is elsewhere leaves the focus where it is.
    await useCameraStore().start();
    await flushPromises();
    useCameraStore().stop();
    await flushPromises();
    expect(document.activeElement?.id).toBe('tab-export');
    wrapper.unmount();
  });

  it('keeps the camera running when switching tabs', async () => {
    const wrapper = mountApp();
    await useCameraStore().start();
    await tabs(wrapper)[1]?.trigger('click');
    await tabs(wrapper)[2]?.trigger('click');
    expect(api.close).not.toHaveBeenCalled();
    expect(useCameraStore().status).toBe('live');
  });

  it('gives each tab with a camera image its own still image, the export changes nothing', async () => {
    const wrapper = mountApp();
    const camera = useCameraStore();
    const gray = grayFrame(4, 3);
    camera.still = gray;
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).toBe(gray);
    await tabs(wrapper)[1]?.trigger('click');
    expect(camera.still).toBeNull();
    await tabs(wrapper)[2]?.trigger('click');
    expect(camera.still).toBeNull();
    await tabs(wrapper)[3]?.trigger('click');
    expect(camera.still).toBeNull();
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).toBe(gray);
  });

  it('shows the missing-color-correction notice in the export tab and jumps to the color cards', async () => {
    const wrapper = mountApp({ attach: true });
    await tabs(wrapper)[3]?.trigger('click');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(true);
    await wrapper.get('[data-testid="export-no-model"] button').trigger('click');
    expect(tabs(wrapper)[1]?.attributes('aria-selected')).toBe('true');
    // The link went with the export: the focus is on the tab that opened.
    expect(document.activeElement?.id).toBe('tab-color');
    wrapper.unmount();
  });

  it('puts the floating project message after the panel in the order of the Tab key', async () => {
    const wrapper = mountApp();
    useProjectStore().notice = 'Hinweis';
    await flushPromises();
    const panel = wrapper.get('[role="tabpanel"]').element;
    const message = wrapper.get('[data-testid="project-message"]').element;
    expect(panel.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('loads the bundled reference set at startup', async () => {
    mountApp();
    await flushPromises();
    expect(useReferenceStore().selected?.name).toBe(BUNDLED_NAME);
  });

  it('stops the camera when the app is removed', async () => {
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
