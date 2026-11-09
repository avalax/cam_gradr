// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLookStore } from '../look/look-store';
import { useProjectStore } from '../project/project-store';
import { chooseFile } from '../test-support/file-input';
import { cubeFile } from '../test-support/look-cubes';
import { emptyLookStorage } from '../test-support/empty-storage';

import ProjectBar from './ProjectBar.vue';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

describe('ProjectBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    download.mockReset();
  });

  afterEach(() => {
    const globals = globalThis as unknown as Record<string, unknown>;
    delete globals.showOpenFilePicker;
    delete globals.showSaveFilePicker;
  });

  it('offers saving and loading', () => {
    const wrapper = mount(ProjectBar);
    expect(wrapper.get('[data-testid="project-save"]').text()).toBe('Projekt speichern');
    expect(wrapper.text()).toContain('Projekt laden');
  });

  it('saves with still images by default and without when the checkbox is unchecked', async () => {
    const wrapper = mount(ProjectBar);
    const save = vi.spyOn(useProjectStore(), 'save').mockResolvedValue();
    const box = wrapper.get('[data-testid="project-stills"]');
    expect((box.element as HTMLInputElement).checked).toBe(true);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(save).toHaveBeenLastCalledWith({ withStills: true, withLooks: false });
    await box.setValue(false);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(save).toHaveBeenLastCalledWith({ withStills: false, withLooks: false });
    // The choice survives a switch to another tab, which mounts the bar anew.
    wrapper.unmount();
    const again = mount(ProjectBar);
    expect((again.get('[data-testid="project-stills"]').element as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('offers to save the look LUTs along as soon as one is imported', async () => {
    emptyLookStorage();
    const wrapper = mount(ProjectBar);
    const save = vi.spyOn(useProjectStore(), 'save').mockResolvedValue();
    expect(wrapper.find('[data-testid="project-looks"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(save).toHaveBeenLastCalledWith({ withStills: true, withLooks: false });

    await useLookStore().importFiles([cubeFile('Warm.cube')]);
    await flushPromises();
    const box = wrapper.get('[data-testid="project-looks"]');
    expect((box.element as HTMLInputElement).checked).toBe(true);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(save).toHaveBeenLastCalledWith({ withStills: true, withLooks: true });
    await box.setValue(false);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(save).toHaveBeenLastCalledWith({ withStills: true, withLooks: false });
    wrapper.unmount();
    const again = mount(ProjectBar);
    expect((again.get('[data-testid="project-looks"]').element as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('remembers the name of the loaded file for saving', async () => {
    const wrapper = mount(ProjectBar);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    const saved = (download.mock.calls[0] as [string, string, string])[1];
    await chooseFile(wrapper, 'project-file', 'project.json', saved);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    await flushPromises();
    expect((download.mock.calls.at(-1) as [string, string, string])[0]).toBe('project.json');
  });

  it('leaves choosing the file to the file input without the system dialogs', () => {
    const wrapper = mount(ProjectBar);
    const click = new MouseEvent('click', { cancelable: true });
    wrapper.get('[data-testid="project-file"]').element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it('chooses the file in the system dialog where the browser has it', async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    Object.assign(globals, { showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn() });
    const wrapper = mount(ProjectBar);
    const open = vi.spyOn(useProjectStore(), 'open').mockResolvedValue();
    const click = new MouseEvent('click', { cancelable: true });
    wrapper.get('[data-testid="project-file"]').element.dispatchEvent(click);
    await flushPromises();
    expect(click.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a selected file', async () => {
    const wrapper = mount(ProjectBar);
    const input = wrapper.get('[data-testid="project-file"]');
    Object.defineProperty(input.element, 'files', { value: [], configurable: true });
    const load = vi.spyOn(useProjectStore(), 'loadChosen');
    await input.trigger('change');
    expect(load).not.toHaveBeenCalled();
  });
});
