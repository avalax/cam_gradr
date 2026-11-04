import { config } from '@vue/test-utils';
import { beforeEach } from 'vitest';

import { i18n, setLocale } from '../lang';

// Every component mounted in a test gets the i18n plugin.
config.global.plugins = [i18n];

// The tests check the German texts, the language the app first shipped with. Tests of other languages
// switch the language themselves; every test starts German again. Without a DOM there is no page
// whose lang attribute could be set.
beforeEach(() => {
  if (typeof document === 'undefined') {
    i18n.global.locale.value = 'de';
  } else {
    setLocale('de');
  }
});
