import { version } from '../../package.json';

// Version of the app from package.json, which release-please raises with every release. The preview
// of a pull request also names the pull request, as it contains changes that are not released yet.
// Kept apart from app-info.ts: the acceptance tests load modules that use app-info in Node, which
// knows neither this JSON import nor import.meta.env.
export function appVersion(base: string = import.meta.env.BASE_URL): string {
  const preview = /\/pr-preview\/pr-(\d+)\/$/.exec(base);
  return preview === null ? version : `${version}, PR #${String(preview[1])}`;
}

export const APP_VERSION = appVersion();
