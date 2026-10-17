import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectStore } from '../project/project-store';

import ProjectBar from './ProjectBar.vue';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

async function chooseFile(wrapper: ReturnType<typeof mount>, text: string) {
  const input = wrapper.get('[data-testid="project-file"]');
  Object.defineProperty(input.element, 'files', {
    value: [{ name: 'projekt.json', text: () => Promise.resolve(text) }],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
}

describe('ProjectBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    download.mockReset();
  });

  it('bietet Speichern und Laden an', () => {
    const wrapper = mount(ProjectBar);
    expect(wrapper.get('[data-testid="project-save"]').text()).toBe('Projekt speichern');
    expect(wrapper.text()).toContain('Projekt laden');
  });

  it('speichert das Projekt und meldet das Ende der Aktion', async () => {
    const wrapper = mount(ProjectBar);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(download).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('done')).toHaveLength(1);
    expect(useProjectStore().notice).toContain('gespeichert');
  });

  it('lädt die gewählte Datei und meldet das Ende der Aktion', async () => {
    const wrapper = mount(ProjectBar);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    const saved = (download.mock.calls[0] as [string, string, string])[1];
    await chooseFile(wrapper, saved);
    expect(useProjectStore().notice).toContain('Projekt geladen');
    expect(wrapper.emitted('done')).toHaveLength(2);
  });

  it('meldet eine fehlerhafte Datei im Speicher des Projekts', async () => {
    const wrapper = mount(ProjectBar);
    await chooseFile(wrapper, '{"format":"x"}');
    expect(useProjectStore().error).toContain('Unbekanntes Format');
  });

  it('macht ohne gewählte Datei nichts', async () => {
    const wrapper = mount(ProjectBar);
    const input = wrapper.get('[data-testid="project-file"]');
    Object.defineProperty(input.element, 'files', { value: [], configurable: true });
    await input.trigger('change');
    expect(wrapper.emitted('done')).toBeUndefined();
    expect(useProjectStore().notice).toBeNull();
  });
});
