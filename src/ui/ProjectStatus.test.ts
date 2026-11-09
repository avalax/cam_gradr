// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectStore } from '../project/project-store';

import ProjectStatus from './ProjectStatus.vue';

vi.mock('../lut/download', () => ({ downloadFile: vi.fn() }));

describe('ProjectStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows nothing without a message', () => {
    const wrapper = mount(ProjectStatus);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('shows the project hint floating and closes it with the cross', async () => {
    const wrapper = mount(ProjectStatus);
    useProjectStore().notices = [{ key: 'missingReference', name: 'Mein Satz' }];
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="project-message"]').classes()).toContain('fixed');
    expect(wrapper.get('[data-testid="project-notice"]').text()).toContain('Referenzsatz');
    expect(wrapper.find('[data-testid="project-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-message-close"]').trigger('click');
    expect(wrapper.find('[data-testid="project-message"]').exists()).toBe(false);
  });

  it('gives the focus back to where it was when the message appeared, else to the open tab', async () => {
    const save = document.createElement('button');
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'true');
    document.body.append(save, tab);
    const wrapper = mount(ProjectStatus, { attachTo: document.body });
    const close = async () => {
      const button = wrapper.get('[data-testid="project-message-close"]');
      (button.element as HTMLButtonElement).focus();
      await button.trigger('click');
    };

    save.focus();
    await useProjectStore().load('{"format":"x"}', { name: 'kaputt.json' });
    await wrapper.vm.$nextTick();
    await close();
    expect(document.activeElement).toBe(save);

    // The button that had the focus went with its tab: the focus goes to the open tab.
    await useProjectStore().load('{"format":"x"}', { name: 'kaputt.json' });
    await wrapper.vm.$nextTick();
    save.remove();
    await close();
    expect(document.activeElement).toBe(tab);

    // Nothing had the focus: the open tab as well.
    tab.blur();
    await useProjectStore().load('{"format":"x"}', { name: 'kaputt.json' });
    await wrapper.vm.$nextTick();
    await close();
    expect(document.activeElement).toBe(tab);
    tab.remove();
    wrapper.unmount();
  });

  it('shows the error of a faulty file', async () => {
    const wrapper = mount(ProjectStatus);
    await useProjectStore().load('{"format":"x"}', { name: 'kaputt.json' });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="project-error"]').text()).toContain('Unbekanntes Format');
  });
});
