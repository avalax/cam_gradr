// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setLookStorage, useLookStore } from '../look/look-store';
import { usePreviewStore } from '../lut/preview-store';
import { failingStorage } from '../test-support/failing-storage';
import { IDENTITY_CUBE, cubeFile as file, emptyLookStorage } from '../test-support/look-cubes';

import LookBar from './LookBar.vue';

async function withLooks(...names: string[]): Promise<void> {
  await useLookStore().importFiles(names.map((name) => file(`${name}.cube`)));
  useLookStore().dismiss();
}

// Opens the list of the picker and returns its entries.
async function options(wrapper: VueWrapper): Promise<string[]> {
  await wrapper.get('[data-testid="look-select"]').trigger('click');
  const texts = wrapper.findAll('[role="option"]').map((option) => option.text());
  await wrapper.get('[data-testid="look-select"]').trigger('click');
  return texts;
}

// Chooses an entry of the picker with the mouse.
async function pick(wrapper: VueWrapper, text: string): Promise<void> {
  await wrapper.get('[data-testid="look-select"]').trigger('click');
  const option = wrapper.findAll('[role="option"]').find((entry) => entry.text() === text);
  await option?.trigger('click');
}

describe('LookBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    emptyLookStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers only the import without looks; the strength waits for a look', async () => {
    const wrapper = mount(LookBar);
    expect(await options(wrapper)).toEqual(['Noch keine Look-LUT', '+ Look-LUT importieren …']);
    expect(wrapper.get('[data-testid="look-messages"]').text()).toContain(
      '„+ Look-LUT importieren …“',
    );
    expect(wrapper.find('[data-testid="look-remove"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="look-strength"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('output').text()).toBe('–');
  });

  it('chooses a look and its strength', async () => {
    await withLooks('Warm', 'Cold');
    const preview = usePreviewStore();
    preview.setLook(null);
    const wrapper = mount(LookBar);
    expect(await options(wrapper)).toEqual([
      'Keine Look-LUT',
      'Cold',
      'Warm',
      '+ Look-LUT importieren …',
    ]);

    await pick(wrapper, 'Warm');
    expect(wrapper.get('[data-testid="look-select"]').text()).toBe('Warm');
    expect(preview.look).toBe('Warm');
    expect(wrapper.get('[data-testid="look-remove"]').attributes('aria-label')).toBe(
      'Look-LUT „Warm“ löschen',
    );
    await wrapper.get('[data-testid="look-strength"]').setValue('40');
    expect(preview.strength).toBe(40);
    expect(wrapper.get('output').text()).toBe('40 %');

    await pick(wrapper, 'Keine Look-LUT');
    expect(preview.look).toBeNull();
    expect(wrapper.find('[data-testid="look-remove"]').exists()).toBe(false);
  });

  it('opens the file dialog from the last entry and keeps the chosen look', async () => {
    await withLooks('Warm');
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockReturnValue(undefined);
    const wrapper = mount(LookBar);
    await pick(wrapper, '+ Look-LUT importieren …');
    expect(click).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="look-select"]').text()).toBe('Warm');
    expect(usePreviewStore().look).toBe('Warm');
  });

  it('imports the chosen files and reports what happened', async () => {
    const wrapper = mount(LookBar);
    const input = wrapper.get('[data-testid="look-file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [
        new File([IDENTITY_CUBE], 'Warm.cube'),
        new File(['x'], 'notes.txt'),
        new File([IDENTITY_CUBE], 'SLOG 3 S CINETONE_REC709.cube'),
      ],
    });
    await input.trigger('change');
    await vi.waitFor(() => {
      expect(useLookStore().messages).toHaveLength(3);
    });
    await flushPromises();
    expect(useLookStore().looks.map((look) => look.name)).toEqual([
      'SLOG 3 S CINETONE_REC709',
      'Warm',
    ]);
    const messages = wrapper.get('[data-testid="look-messages"]');
    expect(messages.text()).toContain('2 Look-LUTs importiert');
    expect(messages.get('[role="alert"]').text()).toContain('„notes.txt“ wurde nicht importiert');
    expect(messages.text()).toContain('sieht nach einer Umwandlung aus Log aus');
    expect((input.element as HTMLInputElement).value).toBe('');

    await wrapper.get('[data-testid="look-remove-again"]').trigger('click');
    await flushPromises();
    expect(messages.text()).toContain('Look-LUT „SLOG 3 S CINETONE_REC709“ lokal gelöscht.');
    await wrapper.get('[data-testid="look-undo"]').trigger('click');
    await vi.waitFor(() => {
      expect(useLookStore().looks).toHaveLength(2);
    });
  });

  it('names a single imported look and deletes the chosen one with the trash icon', async () => {
    const wrapper = mount(LookBar);
    const input = wrapper.get('[data-testid="look-file"]');
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([IDENTITY_CUBE], 'Warm.cube')],
    });
    await input.trigger('change');
    await vi.waitFor(() => {
      expect(useLookStore().messages).toHaveLength(1);
    });
    await flushPromises();
    expect(wrapper.text()).toContain('„Warm“ importiert und lokal im Browser gespeichert.');
    await wrapper.get('[data-testid="look-remove"]').trigger('click');
    await flushPromises();
    expect(useLookStore().looks).toEqual([]);
    expect(usePreviewStore().look).toBeNull();
  });

  it('takes no file when the dialog was cancelled', async () => {
    const wrapper = mount(LookBar);
    const input = wrapper.get('[data-testid="look-file"]');
    await input.trigger('change');
    Object.defineProperty(input.element, 'files', { configurable: true, value: null });
    await input.trigger('change');
    await flushPromises();
    expect(useLookStore().messages).toEqual([]);
  });

  it('reports problems of the local storage', async () => {
    setLookStorage(failingStorage());
    const wrapper = mount(LookBar);
    await useLookStore().load();
    await flushPromises();
    expect(wrapper.text()).toContain('Gespeicherte Look-LUTs konnten nicht geladen werden.');
    await useLookStore().importFiles([file('Warm.cube')]);
    await flushPromises();
    expect(wrapper.text()).toContain('„Warm“ konnte nicht lokal gespeichert werden');
  });
});
