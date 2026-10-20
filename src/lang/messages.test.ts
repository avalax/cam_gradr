import { describe, expect, it } from 'vitest';

import { messages } from './index';

interface Tree {
  [key: string]: string | Tree;
}

// All messages of a language as "namespace.path.key" => text.
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const flat = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      flat.set(path, value);
    } else {
      for (const [inner, text] of flatten(value, path)) {
        flat.set(inner, text);
      }
    }
  }
  return flat;
}

function sortedKeys(flat: Map<string, string>): string[] {
  const keys: string[] = [];
  for (const key of flat.keys()) {
    keys.push(key);
  }
  return keys.toSorted((a, b) => a.localeCompare(b));
}

// The named placeholders of a text, for example "{count}".
function placeholders(text: string): string[] {
  const found: string[] = Array.from(text.matchAll(/\{(\w+)\}/g), (match) => String(match[1]));
  return found.toSorted((a, b) => a.localeCompare(b));
}

const english = flatten(messages.en);
const german = flatten(messages.de);

// Keys whose text breaks a rule, with the language, so a failure names the culprits.
function offenders(test: (text: string) => boolean): string[] {
  const bad: string[] = [];
  for (const [lang, flat] of [
    ['en', english],
    ['de', german],
  ] as const) {
    for (const [key, text] of flat) {
      if (test(text)) {
        bad.push(`${lang}: ${key}`);
      }
    }
  }
  return bad;
}

describe('translations', () => {
  it('have exactly the same keys in all languages', () => {
    expect(sortedKeys(german)).toEqual(sortedKeys(english));
  });

  it('have no empty texts', () => {
    expect(offenders((text) => text.trim() === '')).toEqual([]);
  });

  it('have the same placeholders in all languages', () => {
    const different: string[] = [];
    for (const [key, text] of english) {
      const other = placeholders(String(german.get(key)));
      if (JSON.stringify(other) !== JSON.stringify(placeholders(text))) {
        different.push(key);
      }
    }
    expect(different).toEqual([]);
  });

  it('contain no special characters that vue-i18n reads as syntax', () => {
    // "|" separates plural forms, "@" links to other messages, "{" and "}" open placeholders.
    expect(offenders((text) => /[|@{}]/.test(text.replaceAll(/\{\w+\}/g, '')))).toEqual([]);
  });
});
