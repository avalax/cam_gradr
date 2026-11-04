import { storedPreference } from '../ui/stored-preference';

import { isThemePreference } from './theme';

// The appearance choice; without one the app follows the device ("system").
export const themePreference = storedPreference('theme', isThemePreference, 'system');
