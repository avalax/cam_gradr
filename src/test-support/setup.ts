import { config } from '@vue/test-utils';
import { beforeEach } from 'vitest';

import { i18n, setLocale } from '../lang';

// Every component mounted in a test gets the i18n plugin.
config.global.plugins = [i18n];

// The tests check the German texts, the language the app first shipped with. Tests of other languages
// switch the language themselves; every test starts German again.
beforeEach(() => {
  setLocale('de');
});
