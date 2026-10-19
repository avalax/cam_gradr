// Höhe (in rem) von allem außer dem Bild: Seitenkopf und Abstände. Graukarten, Farbkarten und Vorschau
// nutzen denselben Wert, damit das Bild auf allen Seiten gleich groß ist und an derselben Stelle steht.
const IMAGE_CHROME_REM = 12;

// Größte Breite des Bildes: Es soll mit allem Drumherum auf einen Bildschirm passen (Breite = Höhe × Seitenverhältnis).
export function imageMaxWidth(aspect: number): string {
  return `calc((100vh - ${String(IMAGE_CHROME_REM)}rem) * ${String(aspect)})`;
}
