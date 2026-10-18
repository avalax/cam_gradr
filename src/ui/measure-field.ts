import { DEFAULT_EXPOSURE_CONFIG } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';

// Abweichung (in Anteilen der Helligkeit), die den vollen Ausschlag des Messfelds ergibt.
const LIGHT_RANGE = 0.3;
const CONTRAST_RANGE = 0.25;
const HALF = 50;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export interface Position {
  left: number;
  top: number;
}

// Lage der Messung im Feld in Prozent: waagerecht der Kontrast (rechts = zu hoch), senkrecht die
// Helligkeit (oben = zu hoch).
export function fieldPosition(exposure: ExposureResult): Position {
  return {
    left: clamp(HALF + (exposure.contrast / CONTRAST_RANGE) * HALF),
    top: clamp(HALF - (exposure.delta / LIGHT_RANGE) * HALF),
  };
}

export interface Box extends Position {
  width: number;
  height: number;
}

// Normalbereich in der Mitte des Felds, passend zu den erlaubten Abweichungen.
export function okBox(
  lightTolerance = DEFAULT_EXPOSURE_CONFIG.tolerance,
  contrastTolerance = DEFAULT_EXPOSURE_CONFIG.contrastTolerance,
): Box {
  const halfWidth = (contrastTolerance / CONTRAST_RANGE) * HALF;
  const halfHeight = (lightTolerance / LIGHT_RANGE) * HALF;
  const left = clamp(HALF - halfWidth);
  const top = clamp(HALF - halfHeight);
  return {
    left,
    top,
    width: clamp(HALF + halfWidth) - left,
    height: clamp(HALF + halfHeight) - top,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(0)} %`;
}

function signed(value: number): string {
  const points = value * 100;
  return `${points >= 0 ? '+' : '−'}${Math.abs(points).toFixed(0)} Punkte`;
}

export interface DetailRow {
  label: string;
  value: string;
}

// Überschrift der Messwerte im Popup: Die Prozentwerte sind Helligkeiten im Kamerabild.
export const DETAIL_CAPTION = 'Helligkeit der Graufelder im Bild (0 % schwarz, 100 % weiß)';

function toleranceOf(value: number): string {
  return `Toleranz ±${(value * 100).toFixed(0)}`;
}

export function detailRows(exposure: ExposureResult): DetailRow[] {
  const { target18, target50, tolerance, contrastTolerance } = DEFAULT_EXPOSURE_CONFIG;
  return [
    { label: '18 %-Karte', value: `${percent(exposure.level18)} (Soll ${percent(target18)})` },
    { label: '50 %-Karte', value: `${percent(exposure.level50)} (Soll ${percent(target50)})` },
    { label: 'Helligkeit', value: `${signed(exposure.delta)} (${toleranceOf(tolerance)})` },
    {
      label: 'Kontrast',
      value: `${signed(exposure.contrast)} (${toleranceOf(contrastTolerance)})`,
    },
    { label: 'Lichter', value: exposure.highlightsClipped ? 'überbelichtet' : 'ok' },
    { label: 'Schatten', value: exposure.shadowsCrushed ? 'unterbelichtet' : 'ok' },
  ];
}

export type Edge = 'top' | 'bottom' | 'left' | 'right';

// Wichtigste Meldung: Sie sitzt am Rand des Felds, in dessen Richtung die Messung abweicht, und nennt
// zusammen mit dem Hinweis den nächsten Schritt.
export interface Issue {
  edge: Edge;
  label: string;
  hint: string;
}

const AFTER_BRIGHTNESS = 'Danach den Kontrast prüfen.';

const TOO_DARK: Issue = {
  edge: 'bottom',
  label: 'Helligkeit zu niedrig',
  hint: `Helligkeit erhöhen (Beleuchtung verstärken oder Belichtung der Kamera erhöhen). ${AFTER_BRIGHTNESS}`,
};
const TOO_BRIGHT: Issue = {
  edge: 'top',
  label: 'Helligkeit zu hoch',
  hint: `Helligkeit verringern (Beleuchtung abschwächen oder Belichtung der Kamera verringern). ${AFTER_BRIGHTNESS}`,
};
const LOW_CONTRAST: Issue = {
  edge: 'left',
  label: 'Kontrast zu niedrig',
  hint: 'Helligkeit passt. Kontrast erhöhen (Kontrast der Kamera erhöhen).',
};
const HIGH_CONTRAST: Issue = {
  edge: 'right',
  label: 'Kontrast zu hoch',
  hint: 'Helligkeit passt. Kontrast verringern (Kontrast der Kamera senken oder weicheres Licht verwenden).',
};

// Helligkeit und Kontrast beeinflussen sich (mehr Kontrast drückt die Schatten bei den meisten Kameras
// wieder nach unten). Deshalb gibt es immer nur einen Schritt: zuerst die Helligkeit, beurteilt am
// dunkelsten Streifenfeld und an den großen Feldern, danach der Kontrast.
function brightnessStep(exposure: ExposureResult): Issue | null {
  const { tolerance } = DEFAULT_EXPOSURE_CONFIG;
  if (exposure.shadowsCrushed && exposure.highlightsClipped) {
    return {
      ...HIGH_CONTRAST,
      hint: 'Schatten unterbelichtet und Lichter überbelichtet: Kontrast verringern, das Licht gleichmäßiger ausrichten und Reflexe auf der Karte vermeiden.',
    };
  }
  if (exposure.shadowsCrushed) {
    return {
      ...TOO_DARK,
      hint: `Schatten unterbelichtet: erst die Helligkeit erhöhen (Beleuchtung verstärken oder Belichtung der Kamera erhöhen), bis das dunkelste Streifenfeld nicht mehr schwarz ist. ${AFTER_BRIGHTNESS}`,
    };
  }
  if (exposure.highlightsClipped) {
    return exposure.delta > tolerance
      ? {
          ...TOO_BRIGHT,
          hint: `Lichter überbelichtet: Helligkeit verringern (Beleuchtung abschwächen oder Belichtung der Kamera verringern). ${AFTER_BRIGHTNESS}`,
        }
      : {
          ...HIGH_CONTRAST,
          hint: 'Lichter überbelichtet: Kontrast verringern (Kontrast der Kamera senken oder weicheres Licht verwenden).',
        };
  }
  if (exposure.delta < -tolerance) {
    return TOO_DARK;
  }
  return exposure.delta > tolerance ? TOO_BRIGHT : null;
}

// Das Problem, das als Nächstes zu beheben ist (null im Normalbereich oder ohne Messung).
export function mainIssue(exposure: ExposureResult | null): Issue | null {
  if (exposure === null) {
    return null;
  }
  const { contrastTolerance } = DEFAULT_EXPOSURE_CONFIG;
  const step = brightnessStep(exposure);
  if (step !== null) {
    return step;
  }
  if (exposure.contrast < -contrastTolerance) {
    return LOW_CONTRAST;
  }
  return exposure.contrast > contrastTolerance ? HIGH_CONTRAST : null;
}

// Kurzer Hinweis unter dem Feld: was als Nächstes an Kamera oder Licht zu ändern ist.
export function fieldHint(exposure: ExposureResult | null): string {
  if (exposure === null) {
    return 'Noch keine Messung.';
  }
  return mainIssue(exposure)?.hint ?? 'Helligkeit und Kontrast befinden sich im Normalbereich.';
}
