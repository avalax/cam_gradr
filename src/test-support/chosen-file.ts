import { flushPromises } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import type { ChosenFile } from '../ui/chosen-file';

// What the browser throws when reading a file that went away or became unreadable after it was
// chosen.
export function notReadable(): DOMException {
  return new DOMException('The requested file could not be read.', 'NotReadableError');
}

// A file as the file input hands it over: reading it gives its text, or fails with the error the
// browser throws for it.
export function chosenFile(name: string, text: string | DOMException): ChosenFile {
  return {
    name,
    text: () => (typeof text === 'string' ? Promise.resolve(text) : Promise.reject(text)),
  };
}

// Chooses a file in the file input with this test id and waits for what the choice starts.
export async function chooseFile(
  wrapper: VueWrapper,
  testId: string,
  name: string,
  text: string | DOMException,
): Promise<void> {
  const input = wrapper.get(`[data-testid="${testId}"]`);
  Object.defineProperty(input.element, 'files', {
    value: [chosenFile(name, text)],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
}
