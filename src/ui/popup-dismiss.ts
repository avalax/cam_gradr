import { ref } from 'vue';
import type { Ref } from 'vue';

// A popup that opens on hover or keyboard focus (the details of the measuring field, the result of
// the color correction) closes with Escape and stays closed until the pointer or the focus leaves
// its trigger, so that it never has to be moved away to see what it covers.
export function usePopupDismiss(): {
  dismissed: Ref<boolean>;
  onKey: (event: KeyboardEvent) => void;
  reset: () => void;
} {
  const dismissed = ref(false);

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      dismissed.value = true;
    }
  }

  function reset(): void {
    dismissed.value = false;
  }

  return { dismissed, onKey, reset };
}
