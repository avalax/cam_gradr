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

  it('bietet Speichern und Laden an, ohne Meldung zu Beginn', () => {
    const wrapper = mount(ProjectBar);
    expect(wrapper.get('[data-testid="project-save"]').text()).toBe('Projekt speichern');
    expect(wrapper.text()).toContain('Projekt laden');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('speichert das Projekt und meldet es', async () => {
    const wrapper = mount(ProjectBar);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(download).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="project-notice"]').text()).toContain('gespeichert');
  });

  it('lädt die gewählte Datei und meldet das Ergebnis', async () => {
    const wrapper = mount(ProjectBar);
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    const saved = (download.mock.calls[0] as [string, string, string])[1];
    await chooseFile(wrapper, saved);
    expect(wrapper.get('[data-testid="project-notice"]').text()).toContain('Projekt geladen');
    expect(wrapper.find('[data-testid="project-error"]').exists()).toBe(false);
  });

  it('meldet eine fehlerhafte Datei', async () => {
    const wrapper = mount(ProjectBar);
    await chooseFile(wrapper, '{"format":"x"}');
    expect(wrapper.get('[data-testid="project-error"]').text()).toContain('Unbekanntes Format');
    expect(useProjectStore().error).not.toBeNull();
  });

  it('macht ohne gewählte Datei nichts', async () => {
    const wrapper = mount(ProjectBar);
    const input = wrapper.get('[data-testid="project-file"]');
    Object.defineProperty(input.element, 'files', { value: [], configurable: true });
    await input.trigger('change');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
