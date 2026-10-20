import { flushPromises, mount } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUNDLED_NAME, BUNDLED_SOURCE_URL } from '../reference/bundled';
import { setReferenceStorage, useReferenceStore } from '../reference/reference-store';
import { createIndexedDbStorage } from '../reference/storage';
import { dummyReferenceCsv, dummyReferenceJson } from '../test-support/dummy-reference';

import ReferencePanel from './ReferencePanel.vue';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

async function mountLoaded() {
  const wrapper = mount(ReferencePanel);
  await useReferenceStore().load();
  await flushPromises();
  return wrapper;
}

async function chooseFile(wrapper: ReturnType<typeof mount>, name: string, text: string) {
  const input = wrapper.get('[data-testid="reference-file"]');
  Object.defineProperty(input.element, 'files', {
    value: [{ name, text: () => Promise.resolve(text) }],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
}

function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text));
}

describe('ReferencePanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test'));
    download.mockReset();
  });

  it('names the source of the bundled set and that it is not from the manufacturer', () => {
    const wrapper = mount(ReferencePanel);
    const source = wrapper.get('[data-testid="reference-source"]');
    expect(source.text()).toContain('keine Datei von Datacolor');
    expect(source.get('a').attributes('href')).toBe(BUNDLED_SOURCE_URL);
    expect(source.get('a').attributes('rel')).toBe('noopener noreferrer');
  });

  it('offers the bundled set as the active set without allowing it to be deleted', async () => {
    const wrapper = await mountLoaded();
    const select = wrapper.get('[data-testid="reference-select"]');
    expect(select.text()).toContain(BUNDLED_NAME);
    expect(button(wrapper, 'Satz löschen')).toBeUndefined();
    expect(button(wrapper, 'Satz herunterladen')).toBeDefined();
  });

  it('imports a JSON file and selects it', async () => {
    const wrapper = await mountLoaded();
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Mein Satz'));
    expect(useReferenceStore().selected?.name).toBe('Mein Satz');
    expect(
      (wrapper.get('[data-testid="reference-select"]').element as HTMLSelectElement).value,
    ).toBe('Mein Satz');
  });

  it('shows that the set was saved locally', async () => {
    const wrapper = await mountLoaded();
    expect(wrapper.find('[data-testid="reference-saved"]').exists()).toBe(false);
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Mein Satz'));
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="reference-saved"]').exists()).toBe(true);
    });
    expect(wrapper.get('[data-testid="reference-saved"]').text()).toContain('gespeichert');
  });

  it('imports a CSV file', async () => {
    const wrapper = await mountLoaded();
    await chooseFile(wrapper, 'werte.csv', dummyReferenceCsv());
    expect(useReferenceStore().selected?.name).toBe('werte');
  });

  it('meldet fehlerhafte Dateien', async () => {
    const wrapper = await mountLoaded();
    await chooseFile(wrapper, 'kaputt.json', '{"format":"x"}');
    expect(wrapper.get('[role="alert"]').text()).toContain('Unbekanntes Format');
  });

  it('does nothing without a selected file', async () => {
    const wrapper = await mountLoaded();
    const input = wrapper.get('[data-testid="reference-file"]');
    Object.defineProperty(input.element, 'files', { value: [], configurable: true });
    await input.trigger('change');
    expect(useReferenceStore().selected?.name).toBe(BUNDLED_NAME);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('switches between sets and deletes custom sets', async () => {
    const wrapper = await mountLoaded();
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Satz A'));
    await chooseFile(wrapper, 'b.json', dummyReferenceJson('Satz B'));
    expect(useReferenceStore().selected?.name).toBe('Satz B');
    await wrapper.get('[data-testid="reference-select"]').setValue('Satz A');
    expect(useReferenceStore().selected?.name).toBe('Satz A');
    await button(wrapper, 'Satz löschen')?.trigger('click');
    await flushPromises();
    expect(useReferenceStore().selected?.name).toBe(BUNDLED_NAME);
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="reference-removed"]').exists()).toBe(true);
    });
    expect(wrapper.get('[data-testid="reference-removed"]').text()).toContain('Satz A');
  });

  it('downloads the active set as a file', async () => {
    const wrapper = await mountLoaded();
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Mein Satz'));
    await button(wrapper, 'Satz herunterladen')?.trigger('click');
    expect(download).toHaveBeenCalledWith('Mein Satz.json', expect.any(String), 'application/json');
  });

  it('shows a warning when storage does not work', async () => {
    setReferenceStorage(null);
    const wrapper = await mountLoaded();
    expect(wrapper.get('[role="status"]').text()).toContain('geladen');
  });

  it('shows no set buttons before loading', () => {
    const wrapper = mount(ReferencePanel);
    expect(button(wrapper, 'Satz herunterladen')).toBeUndefined();
  });
});
