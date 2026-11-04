import { storedPreference } from '../ui/stored-preference';

import { isPreference } from './locales';

// The language choice; without one the app follows the browser ("auto").
export const languagePreference = storedPreference('language', isPreference, 'auto');
