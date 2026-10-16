# cam_gradr – Webcam-LUT-Generator mit Datacolor Spyder Checkr Photo

## 1. Ziel

Single-Page-Webapp (rein clientseitig, kein Backend), die mit der Webcam eine Datacolor **Spyder Checkr Photo** aufnimmt und daraus eine **3D-LUT** berechnet, die die Farbwiedergabe der Webcam korrigiert. Die Korrektur ist live in der Vorschau sichtbar und als LUT exportierbar.

## 2. Ablauf (User Flow)

1. **Kamera wählen & starten** (`getUserMedia`, Geräteliste, Auflösung, Spiegelung aus).
2. **Schritt 1 – Graustufenseite (Belichtung/Helligkeit)**
   - Karte mit Graustufenseite vor die Kamera halten.
   - Zweck: Die Raumhelligkeit so einstellen, dass die Beleuchtung ideal für Schritt 2 ist. Dieser Schritt berechnet nichts für die LUT.
   - Live-Overlay: Graupatches werden ausgerichtet, pro Patch wird die gemessene Helligkeit live mit dem Sollbereich verglichen.
   - Anzeige: Clipping-Warnung (Lichter/Schatten) und Ampel „Raum zu dunkel / passt / zu hell“ mit Hinweis, ob Licht heller oder dunkler gestellt werden soll. Kein Histogramm.
   - Warnhinweis, Auto-Belichtung/-Weißabgleich in der Kamera-Software zu fixieren (keine Constraint-Steuerung durch die App).
   - Ergebnis: Der Raum hat die ideale Helligkeit (Ampel grün, nichts geclippt), danach geht es zu Schritt 2.
3. **Schritt 2 – Farbseite (Color Patches)**
   - Karte umdrehen, Foto/Standbild aufnehmen (Mittelung über mehrere Frames zur Rauschreduktion).
   - Patch-Ausrichtung: 4 Eckpunkte per Klick/Drag setzen (Homographie), später optional Auto-Erkennung.
   - Patch-Messung: Median im inneren ~50 % jedes Feldes (Ränder/Reflexe ausschließen).
4. **Berechnung** der Korrektur und Qualitätsanzeige (ΔE2000 pro Patch, Mittel/Max, vorher/nachher).
5. **Live-Preview**: Kamerabild mit angewandter LUT, Split-View / Vorher-Nachher-Schieber, Korrektur-Stärke-Regler (0–100 %).
6. **Export** als LUT-Datei.

## 3. Funktionale Anforderungen

- Webcam-Zugriff, Kamerawahl, Auflösung (bis 1080p/4K wenn verfügbar), Standbild-Aufnahme.
- Patch-Layout der Spyder Checkr Photo als Konfigurationsdatei (JSON): Anzahl, Raster, Positionen, Referenzwerte (Lab/sRGB).
  - Referenzprofile liegen als Konfigurationsdateien (JSON/CSV) vor und sind in der App auswählbar; zum Start gibt es nur das Standard-ColorChecker-Profil (siehe Abschnitt 8).
- Linearisierung der Kamerawerte (sRGB-Decode als Annahme, per Neutralpatches der Farbseite korrigierbar).
- Korrekturmodell (alles aus den Messwerten der Farbseite aus Schritt 2, inklusive deren Neutralpatches):
  1. Weißabgleich (Gain je Kanal aus den Neutralpatches, in linearem RGB),
  2. 1D-Tonkurve je Kanal (monotone Interpolation durch die Neutralpatches, z. B. PCHIP),
  3. 3×3-Farbmatrix bzw. Root-Polynomial-Regression (Least Squares, Regularisierung) auf den Farbpatches,
  4. Fehlermaß ΔE2000 (Lab, D50/D65 wählbar).
- Live-Preview in Echtzeit (≥ 30 fps) per GPU, mit 3D-LUT als Textur.
- LUT-Export:
  - `.cube` (Standard, 17/33/65 Stützstellen wählbar) – primär,
  - optional `.3dl` und Hald-CLUT-PNG.
- Projekt speichern/laden (Messdaten + Eckpunkte als JSON), damit ohne Neuaufnahme neu gerechnet werden kann.
- Sprache der UI: Deutsch (i18n-fähig vorbereitet).

## 4. Nicht-funktionale Anforderungen

- Läuft komplett im Browser, Daten verlassen den Rechner nicht (HTTPS/localhost nötig für Kamera).
- Zielbrowser: aktuelles Chrome/Edge, Firefox, Safari (WebGL2).
- Responsive, aber primär Desktop.
- Testbare Farbmathematik (Unit-Tests mit Referenzwerten).
- **Code-Coverage mindestens 99 %**, laufend verifiziert (lokal, per Hook und in der CI), siehe Abschnitt 8.
- Automatisierte Pipeline auf GitHub mit Changelog und automatischen Releases, siehe Abschnitt 9.
- Hinweise zu Grenzen: 8-bit-Webcam, Auto-Funktionen der Kamera, Beleuchtung (Flackern, Mischlicht), Reflexionen auf der Karte.

## 5. Technologie-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Build/Dev | **Vite** + **TypeScript** (`create-vue`) | schnell, statisch deploybar |
| UI | **Vue 3** (Composition API, `<script setup>`) | Komponenten für Wizard-Schritte, reaktive Zustände |
| State | **Pinia** | offizieller Vue-Store, minimal |
| Styling | **Tailwind CSS**  | zügiges, konsistentes UI |
| Kamera | Web APIs: `getUserMedia`, `requestVideoFrameCallback` | native |
| Live-Preview / LUT-Anwendung | **WebGL2** (eigener schlanker Fragment-Shader, 3D-Textur, trilineare Interpolation) | Echtzeit, keine schwere Lib nötig |
| Bildanalyse | Canvas 2D / `OffscreenCanvas` + eigener Code (Homographie, Median); optional **OpenCV.js** erst für Auto-Erkennung (Phase 2) | OpenCV.js ist ~8 MB, daher nicht im MVP |
| Mathe | **ml-matrix** (Least Squares / SVD) | kleine Lib für Regression |
| Farbmodell | eigene Module (sRGB↔XYZ↔Lab, Bradford, ΔE2000), gegen **colorjs.io** in Tests verifiziert | nachprüfbar |
| Charts | **uPlot** oder SVG (Tonkurve, ΔE-Balken) | leichtgewichtig |
| Tests | **Vitest** + `@vitest/coverage-v8`, `@vue/test-utils`, happy-dom (Coverage ≥ 99 %) | passt zu Vite |
| Lint/Format | ESLint + Prettier, Husky, commitlint | |
| CI/CD | **GitHub Actions**, release-please, GitHub Pages, Dependabot | siehe Abschnitt 9 |

## 6. Architektur / Modulstruktur

```
src/
  camera/        Kamerazugriff, Frame-Capture, Mittelung
  chart/         Patch-Layout (JSON), Homographie, Patch-Sampling
  color/         Konvertierungen, ΔE2000, Linearisierung
  solve/         Weißabgleich, Tonkurve, Matrix/Polynom-Fit, Fehlerbericht
  lut/           3D-LUT-Erzeugung, .cube/.3dl/Hald-Export
  gl/            WebGL2-Renderer (Video → LUT → Canvas)
  ui/            Wizard-Schritte, Overlays, Helligkeits-Ampel, Export-Dialog
  data/          spyder-checkr-photo.json (Layout + Referenzwerte)
```

Datenfluss: Kamera → Frame → (Schritt 1) Graumessung → nur Helligkeits-Feedback (Ampel) → (Schritt 2) Farbmessung → Solver → 3D-LUT (Float32Array N³×3) → WebGL-Textur (Preview) und Export (Datei).

## 7. Meilensteine

0. **M0 – Repo & Pipeline:** Git, Conventional Commits, Husky/commitlint, Vitest mit 99-%-Schwellwert, CI-Workflow, release-please, Pages-Deployment, `CHANGELOG.md`.
1. **M1 – Grundgerüst:** Vite/Vue/TS, Kamera-Livebild, Kamerawahl, Standbild.
2. **M2 – Graustufen-Schritt:** Eckpunkt-Ausrichtung, Patch-Messung, Helligkeits-Ampel mit Clipping-Warnung, Warnhinweis zur Kamera-Automatik.
3. **M3 – Farb-Schritt & Solver:** Referenzdaten, Fit, ΔE-Report, Vorher/Nachher.
4. **M4 – LUT & Live-Preview:** WebGL2-Pipeline, Split-View, Stärke-Regler.
5. **M5 – Export:** `.cube` (+ `.3dl`, Hald), Projekt speichern/laden.
6. **M6 – Politur:** Auto-Erkennung der Karte (OpenCV.js, optional), Tests, Doku, Deployment (statisch, z. B. GitHub Pages).

## 8. Qualitätssicherung (Code-Coverage ≥ 99 %)

- **Vitest** mit `@vitest/coverage-v8`; Schwellwerte in `vitest.config.ts`: `statements`, `branches`, `functions`, `lines` jeweils **99 %**. Unterschreitung lässt den Testlauf fehlschlagen.
- Die Coverage wird bei der Entwicklung laufend verifiziert, nicht erst am Ende:
  - jeder Meilenstein gilt erst als fertig, wenn `npm run test:coverage` die 99 % hält,
  - lokaler Hook (Husky) führt vor `git push` Lint, Typecheck und Coverage-Check aus,
  - CI (siehe Abschnitt 9) prüft dasselbe bei jedem Push und Pull Request.
- Testarten: Unit-Tests für Farbmathe, Solver, LUT-Erzeugung und Exporter (Referenzwerte, Randfälle); Komponententests mit **@vue/test-utils** und **happy-dom**; Kamera, WebGL und Canvas werden hinter dünnen Adaptern gemockt, damit die Logik testbar bleibt.
- Ausschlüsse von der Coverage sind eng gefasst (z. B. reine Einstiegsdatei `main.ts`, Typdeklarationen) und in der Config begründet; Ausschlüsse werden nicht genutzt, um die Schwelle zu erreichen.
- Coverage-Report (lcov + Text) wird in der CI als Artefakt abgelegt; ein Badge im README zeigt den Stand.

## 9. CI/CD & Releases (GitHub)

- **Repository:** GitHub, Standardbranch `main`. Ablauf: initialer Commit mit dem Plan lokal, danach legt der Nutzer das GitHub-Repo an und pusht.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:` …), geprüft per **commitlint** (lokal über Husky und in der CI für Pull Requests).
- **CI-Workflow** (`.github/workflows/ci.yml`, bei Push und Pull Request): Install (`npm ci`, Cache) → ESLint → Prettier-Check → `vue-tsc` Typecheck → Vitest mit Coverage-Schwellwert 99 % → Production-Build. Node-LTS-Version fest gepinnt.
- **Changelog & Releases:** **release-please** (GitHub Action) liest die Conventional Commits, pflegt `CHANGELOG.md` und öffnet einen Release-PR mit Versionssprung (SemVer). Beim Mergen entstehen automatisch Git-Tag und GitHub Release mit Changelog-Eintrag und angehängtem Build-Artefakt (zip von `dist/`).
- **Deployment:** Nach einem Release automatisch Veröffentlichung auf **GitHub Pages** (statischer Build, HTTPS ist für die Kamera nötig).
- **Zusätzlich:** Dependabot für npm und GitHub Actions; Branch-Protection auf `main` (CI muss grün sein) wird beim Anlegen des Repos vom Nutzer aktiviert.

## 10. Entscheidungen (geklärt)

- **Referenzwerte:** Zum Start Standard-ColorChecker-Werte als einziges Profil. Weitere Referenzsätze (z. B. echte Datacolor-Werte) lassen sich als Konfigurationsdateien (JSON/CSV) hinterlegen und in der App auswählen.
- **Einsatzzweck:** Die LUT wird für die Webcam bzw. den Portkeys-Kameramonitor erzeugt und manuell dort hochgeladen. Die App erzeugt nur die LUT-Datei, es gibt keine Geräteanbindung. Primärformat `.cube`; die vom Portkeys-Modell unterstützte Größe (17³/33³) ist noch gegen das Handbuch zu prüfen, die Größe bleibt im Export wählbar.
- **Webcam-Automatik:** Nur Warnhinweis. Auto-Belichtung/-Weißabgleich fixiert der Nutzer in der Kamera-Software, die App setzt keine Constraints.
- **Farbraum:** sRGB / Rec.709 für Ein- und Ausgabe.

## 11. Risiken

- **Dynamikumfang:** 8-bit-Video und Kamera-Tonemapping begrenzen die Genauigkeit; die LUT korrigiert nur den fixierten Kamerazustand (bei geänderter Beleuchtung/Einstellung neu kalibrieren).
- **Referenzgenauigkeit:** Standard-ColorChecker-Werte sind nur eine Näherung der Datacolor-Karte, bis ein genaues Profil hinterlegt wird.
