import { flushPromises } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { chosenFile } from './chosen-file';

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
