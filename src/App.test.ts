import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import App from './App.vue';
import { APP_NAME } from './ui/app-info';

describe('App', () => {
  it('zeigt den Namen der Anwendung', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
  });
});
