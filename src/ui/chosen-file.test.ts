import { describe, expect, it, vi } from 'vitest';

import { chosenFile, notReadable } from '../test-support/chosen-file';

import { readChosen } from './chosen-file';

describe('readChosen', () => {
  it('gives the text of a file, or why the browser did not hand it over, and logs that', async () => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue();
    await expect(readChosen(chosenFile('a.json', '{}'))).resolves.toEqual({ text: '{}' });
    expect(warn).not.toHaveBeenCalled();
    const gone = notReadable();
    await expect(readChosen(chosenFile('a.json', gone))).resolves.toEqual({
      problem: 'unreadable',
    });
    const denied = new DOMException('Not allowed.', 'NotAllowedError');
    await expect(readChosen(chosenFile('a.json', denied))).resolves.toEqual({
      problem: 'accessDenied',
    });
    expect(warn.mock.calls).toEqual([[gone], [denied]]);
    warn.mockRestore();
  });
});
