// Where the focus goes when an action removes its own button (the trash in the image toolbar, the
// capture in the preview, the camera switch in the export): to a control that stays, so that the
// keyboard keeps its place instead of starting over at the top of the page.

// The camera switch next to the tabs: after "delete corner points" it starts the search, after a
// capture it starts the camera again.
export const CAMERA_SWITCH_ID = 'camera-switch';

export function focusById(id: string): void {
  document.querySelector<HTMLElement>(`#${id}`)?.focus();
}
