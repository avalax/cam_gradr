import { describe, expect, it } from 'vitest';

import { version } from '../../package.json';

import { APP_VERSION, appVersion } from './app-info';

describe('appVersion', () => {
  it('is the version of the package', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(appVersion('/cam_gradr/')).toBe(version);
    expect(APP_VERSION).toBe(version);
  });

  it('names the pull request in its preview', () => {
    expect(appVersion('/cam_gradr/pr-preview/pr-78/')).toBe(`${version}, PR #78`);
  });
});
