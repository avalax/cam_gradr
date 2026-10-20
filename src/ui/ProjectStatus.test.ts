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

  it('shows no message after saving', async () => {
    const wrapper = mount(ProjectStatus);
    await useProjectStore().save();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="project-message"]').exists()).toBe(false);
  });

  it('shows the project hint floating and closes it with the cross', async () => {
    const wrapper = mount(ProjectStatus);
    useProjectStore().notice = 'Der Referenzsatz fehlt.';
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="project-message"]').classes()).toContain('fixed');
    expect(wrapper.get('[data-testid="project-notice"]').text()).toContain('Referenzsatz');
    expect(wrapper.find('[data-testid="project-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-message-close"]').trigger('click');
    expect(wrapper.find('[data-testid="project-message"]').exists()).toBe(false);
  });

  it('shows the error of a faulty file', async () => {
    const wrapper = mount(ProjectStatus);
    await useProjectStore().load('{"format":"x"}');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="project-error"]').text()).toContain('Unbekanntes Format');
  });
});
