import { labToLinearSrgb } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { linearToSrgb } from '../color/srgb';

// Künstliche Webcam mit bekannter Verfälschung: Farbmischung (Zeilensumme 1) und je Kanal
// Verstärkung und Gamma. Sie dient Tests als "Wahrheit": ein gutes Modell macht sie rückgängig.
const GAIN: Vec3 = [0.95, 1, 0.9];
const GAMMA: Vec3 = [1.1, 1, 0.92];
const MIX: readonly [Vec3, Vec3, Vec3] = [
  [0.9, 0.08, 0.02],
  [0.05, 0.9, 0.05],
  [0.02, 0.1, 0.88],
];

function channel(value: number, index: 0 | 1 | 2): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return Math.min(1, GAIN[index] * clamped ** GAMMA[index]);
}

// Was die künstliche Webcam (sRGB-codiert) für ein Feld mit dem Lab-Wert (D50) meldet.
export function cameraCode(lab: Vec3): Vec3 {
  const [r, g, b] = labToLinearSrgb(lab);
  const mixed = MIX.map((row) => row[0] * r + row[1] * g + row[2] * b);
  return [
    linearToSrgb(channel(Number(mixed[0]), 0)),
    linearToSrgb(channel(Number(mixed[1]), 1)),
    linearToSrgb(channel(Number(mixed[2]), 2)),
  ];
}
