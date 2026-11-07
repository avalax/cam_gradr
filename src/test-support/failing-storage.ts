import type { NamedStorage } from '../storage/indexed-db';

const fail = () => Promise.reject(new Error('blocked'));

// A browser storage that refuses everything, as when the site data is blocked.
export function failingStorage<T extends { name: string }>(): NamedStorage<T> {
  return { list: fail, save: fail, remove: fail };
}
