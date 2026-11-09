import { CAMERA_SWITCH_ID } from '../ui/focus';

// A stand-in for the camera switch next to the tabs, for the components that hand the focus to it
// when their own button goes. Remove it after the test.
export function cameraSwitchStandIn(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = CAMERA_SWITCH_ID;
  document.body.append(button);
  return button;
}
