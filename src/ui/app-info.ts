import { version } from '../../package.json';

export const APP_NAME = 'cam_gradr';

// Unique application identifier (vendor and app name).
export const APP_ID = 'avalax.cam_gradr';

// Version of the app from package.json, which release-please raises with every release. The preview
// of a pull request also names the pull request, as it contains changes that are not released yet.
export function appVersion(base: string = import.meta.env.BASE_URL): string {
  const preview = /\/pr-preview\/pr-(\d+)\/$/.exec(base);
  return preview === null ? version : `${version}, PR #${String(preview[1])}`;
}

export const APP_VERSION = appVersion();
