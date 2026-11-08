// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChartStore } from '../chart/chart-store';
import { usePreviewStore } from '../lut/preview-store';
import { useSolveStore } from '../solve/solve-store';
import { parseCube } from '../test-support/cube-parse';
import { dummyReference } from '../test-support/dummy-reference';
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
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toContain(
      '33 × 33 × 33 · ca. 970 KB',
    );
    await wrapper.get('[data-testid="export-size"] [data-option="65"]').trigger('click');
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toContain('65 × 65 × 65');
    const facts = wrapper.get('[data-testid="project-facts"]').text();
    expect(facts).toContain('8 Eckpunkte · 0 Felder');
    expect(facts).toContain('Kurven + Matrix');
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

  it('offers sizes 17, 33 and 65 with 33 as default', () => {
    computeModel();
    const wrapper = mount(ExportTab);
    const radios = wrapper.findAll('[data-testid="export-size"] [role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual(['17³', '33³ Standard', '65³']);
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(wrapper.get('#export-file-name').text()).toBe('cam_gradr-33.cube');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(false);
  });

  it('downloads the selected size with the look LUT chosen in the preview, or only the correction', async () => {
    computeModel();
    await chooseInvert();
    usePreviewStore().setStrength(70);
    const wrapper = mount(ExportTab);
    const checked = () =>
      wrapper
        .findAll('[data-testid="export-content"] [role="radio"]')
        .map((radio) => radio.attributes('aria-checked'));
    expect(checked()).toEqual(['false', 'true']);
    expect(wrapper.get('[data-testid="export-look"]').text()).toBe(
      'Look-LUT „Invert“ mit 70 %, eingestellt in der Vorschau.',
    );
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

    await wrapper.get('[data-testid="export-content"] [data-option="plain"]').trigger('click');
    expect(checked()).toEqual(['true', 'false']);
    expect(wrapper.get('[data-testid="export-look"]').text()).toBe(
      'Die LUT enthält nur die Farbkorrektur.',
    );
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

  it('points to the preview for a look LUT and goes there', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    expect(
      wrapper.get('[data-testid="export-content"] [data-option="look"]').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.get('[data-testid="export-look"]').text()).toBe(
      'Eine Look-LUT wählst du in der Vorschau.',
    );
    await wrapper.get('[data-testid="export-look"] button').trigger('click');
    expect(wrapper.emitted('goto')).toEqual([['preview']]);

    await chooseInvert();
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="export-look"] button').trigger('click');
    expect(wrapper.emitted('goto')).toEqual([['preview'], ['preview']]);
  });
});
