import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import App from './App.vue';
import { APP_ID, APP_NAME } from './ui/app-info';

describe('App', () => {
  it('zeigt den Namen der Anwendung und das Kamera-Panel', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.text()).toContain('Kamera starten');
    expect(wrapper.get('footer').text()).toBe(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });
});
