// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore } from '../chart/chart-store';
import { BUNDLED_NAME } from '../reference/bundled';
import { useReferenceStore } from '../reference/reference-store';
import { usePreviewStore } from '../lut/preview-store';
import { useSolveStore } from '../solve/solve-store';
import { parseCube } from '../test-support/cube-parse';
import { dummyReference } from '../test-support/dummy-reference';
import { IDENTITY_MODEL } from '../test-support/identity-model';
import { INVERT_CUBE, cubeFile, importLooks } from '../test-support/look-cubes';
import { syntheticMeasurements } from '../test-support/synthetic-camera';

import ExportTab from './ExportTab.vue';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));
const { fitOnce } = await vi.hoisted(() => import('../test-support/fit-once'));
vi.mock(import('../solve/fit'), async (original) => fitOnce(await original()));

async function chooseInvert(): Promise<void> {
  await importLooks(cubeFile('Invert.cube', INVERT_CUBE));
}

function computeModel() {
  useSolveStore().compute({ measurements: syntheticMeasurements(), reference: dummyReference() });
}

describe('ExportTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    download.mockReset();
  });

  it('asks for a color correction first, but shows what you get', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.get('[data-testid="export-no-model"]').text()).toContain('Noch keine Korrektur');
    // The button only says what it does; the file name beside it describes it.
    const download = wrapper.get('[data-testid="export-download"]');
    expect(download.attributes('disabled')).toBeDefined();
    expect(download.text()).toBe('Herunterladen');
    const name = wrapper.get(`#${String(download.attributes('aria-describedby'))}`);
    expect(name.text()).toBe('cam_gradr-33.cube');
    expect(
      wrapper.get('[data-testid="export-size"] [data-option="17"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('shows gray slices and an empty project list without a correction', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.findAll('[data-testid="lut-slice-empty"]')).toHaveLength(8);
    const facts = wrapper.get('[data-testid="project-facts"]');
    expect(facts.text()).toContain('Graukarten–');
    expect(facts.text()).toContain('Korrektur–');
    expect(facts.text()).toContain('Referenz–');
  });

  it('names the slices, the file size and the project contents with a correction', async () => {
    computeModel();
    useChartStore().setCards([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
      ],
    ]);
    const wrapper = mount(ExportTab);
    expect(wrapper.findAll('[data-testid="lut-slice"]')).toHaveLength(8);
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toBe(
      '33 × 33 × 33 Stützstellen',
    );
    await wrapper.get('[data-testid="export-size"] [data-option="65"]').trigger('click');
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toBe(
      '65 × 65 × 65 Stützstellen',
    );
    const facts = wrapper.get('[data-testid="project-facts"]').text();
    expect(facts).toContain('8 Eckpunkte · 0 Felder');
    expect(facts).toContain('Kurven + Matrix');
  });

  it('is as tall as the preview: an invisible copy of its image area, with the look bar while it has an image', async () => {
    const wrapper = mount(ExportTab);
    const sizer = () => wrapper.get('[data-testid="export-sizer"]');
    expect(sizer().attributes('aria-hidden')).toBe('true');
    expect(sizer().classes()).toContain('invisible');
    expect(sizer().attributes('style')).toContain(`* ${String(16 / 9)})`);
    expect(sizer().find('[data-testid="look-bar"]').exists()).toBe(false);

    // With a correction and the still image of the color cards the preview has an image.
    computeModel();
    useCameraStore().restoreStills({ color: { width: 4, height: 3, data: new Float32Array(36) } });
    await wrapper.vm.$nextTick();
    expect(sizer().attributes('style')).toContain(`* ${String(4 / 3)})`);
    expect(sizer().find('[data-testid="look-bar"]').exists()).toBe(true);
  });

  it('names the set the correction was fitted with, marked while it is missing', async () => {
    await useReferenceStore().load();
    const wrapper = mount(ExportTab);
    const facts = () => wrapper.get('[data-testid="project-facts"]').text();
    // Without a correction the file names the active set.
    expect(facts()).toContain(`Referenz${BUNDLED_NAME}`);
    useSolveStore().loadModel(IDENTITY_MODEL, 'Fehlender Satz');
    await wrapper.vm.$nextTick();
    expect(facts()).toContain('ReferenzFehlender Satz (fehlt)');
  });

  it('leads to the color cards via the link', async () => {
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-no-model"] button').trigger('click');
    expect(wrapper.emitted('goto')).toEqual([['color']]);
  });

  it('offers the project even without a color correction', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.get('[data-testid="project-save"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="project-file"]').exists()).toBe(true);
  });

  it('downloads nothing without a color correction', () => {
    const wrapper = mount(ExportTab);
    (wrapper.vm as unknown as { download: () => void }).download();
    expect(download).not.toHaveBeenCalled();
  });

  it('offers sizes 17, 33 and 65 with 33 as default, each with its file size and purpose', () => {
    computeModel();
    const wrapper = mount(ExportTab);
    const radios = wrapper.findAll('[data-testid="export-size"] [role="radio"]');
    // The unit never breaks from its number (a non-breaking space).
    expect(radios.map((radio) => radio.text())).toEqual([
      '17³ca. 133\u{A0}KBfür ältere Geräte',
      '33³ca. 970\u{A0}KBStandard',
      '65³ca. 7,4\u{A0}MBam genauesten',
    ]);
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(wrapper.get('#export-file-name').text()).toBe('cam_gradr-33.cube');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(false);
  });

  it('downloads the selected size with the look LUT the preview shows, or only the correction', async () => {
    computeModel();
    await chooseInvert();
    usePreviewStore().setStrength(70);
    const wrapper = mount(ExportTab);
    expect(wrapper.find('[data-testid="export-content"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="project-facts"]').text()).toContain('Invert · 70 %');
    // The smallest size keeps the test fast.
    await wrapper.get('[data-testid="export-size"] [data-option="17"]').trigger('click');
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    const [name, content, mime] = download.mock.calls[0] as [string, string, string];
    expect(name).toBe('cam_gradr-17-invert-70.cube');
    expect(mime).toBe('text/plain');
    const looked = parseCube(content);
    expect(looked.lut.size).toBe(17);
    expect(looked.title).toBe('cam_gradr + Invert 70 %');
    expect(content).toContain('# Look LUT: Invert.cube, strength 70 %');

    // Without a look in the preview the file holds the correction alone.
    usePreviewStore().setLook(null);
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    const [plainName, plainContent] = download.mock.calls[1] as [string, string, string];
    expect(plainName).toBe('cam_gradr-17.cube');
    const plain = parseCube(plainContent);
    expect(plain.title).toBe('cam_gradr');
    expect(plainContent).not.toContain('Look LUT');
    // The file holds the full correction: the node (r = 1/16 of the scale) does not stay on the
    // identity.
    expect(plain.lut.data[3 * (1 + 17 * 2 + 17 * 17 * 4)]).not.toBeCloseTo(1 / 16, 3);
    // The look moved the colors 70 % of the way towards their inverse.
    const first = Number(plain.lut.data[0]);
    expect(looked.lut.data[0]).toBeCloseTo(first + 0.7 * (1 - 2 * first), 4);
  });
});
