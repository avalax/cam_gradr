# cam_gradr – Webcam-LUT-Generator mit Datacolor Spyder Checkr Photo

## 1. Ziel

Single-Page-Webapp (rein clientseitig, kein Backend), die mit der Webcam eine Datacolor **Spyder Checkr Photo** aufnimmt und daraus eine **3D-LUT** berechnet, die die Farbwiedergabe der Webcam korrigiert. Die Korrektur ist live in der Vorschau sichtbar und als LUT exportierbar.

## 2. Ablauf (User Flow)

1. **Kamera wählen & starten** (`getUserMedia`, Geräteliste, Auflösung, Spiegelung aus).
2. **Schritt 1 – Graustufenseite (Belichtung/Helligkeit)**
   - Die beiden Graukarten (18 % und 50 % Grau) werden gemeinsam vor die Kamera gehalten und sind zusammen im Bild.
   - Zweck: Die Raumhelligkeit so einstellen, dass die Beleuchtung ideal für Schritt 2 ist. Dieser Schritt berechnet nichts für die LUT.
   - Live-Overlay: Graupatches werden wie in Schritt 2 über vier Eckpunkte ausgerichtet, pro Patch wird die gemessene Helligkeit live mit dem Sollbereich verglichen.
   - Sollbereich (konfigurierbar, im Profil hinterlegt): Weißfeld nicht geclippt (Kanäle unter ca. 95 %), Schwarzfeld nicht abgesoffen (über ca. 3 %), mittleres Grau im vorgegebenen Zielbereich. Die genauen Werte werden in M2 festgelegt und getestet.
   - Anzeige: Clipping-Warnung (Lichter/Schatten) und Ampel „Raum zu dunkel / passt / zu hell“ mit Hinweis, ob Licht heller oder dunkler gestellt werden soll. Kein Histogramm.
   - Warnhinweis, Auto-Belichtung/-Weißabgleich in der Kamera-Software zu fixieren (keine Constraint-Steuerung durch die App).
   - Ergebnis: Der Raum hat die ideale Helligkeit (Ampel grün, nichts geclippt), danach geht es zu Schritt 2.
3. **Schritt 2 – Farbseite (Color Patches)**
   - Die beiden Farbkarten (zusammen 48 Farbfelder) werden gemeinsam vor die Kamera gehalten; Foto/Standbild aufnehmen (Mittelung über mehrere Frames zur Rauschreduktion). Die Aufnahme erfolgt nacheinander zu Schritt 1: erst beide Graukarten, dann beide Farbkarten.
   - Patch-Ausrichtung: 4 Eckpunkte per Klick/Drag setzen (Homographie), später optional Auto-Erkennung.
   - Patch-Messung: Median im inneren ~50 % jedes Feldes (Ränder/Reflexe ausschließen).
4. **Berechnung** der Korrektur und Qualitätsanzeige (ΔE2000 pro Patch, Mittel/Max, vorher/nachher).
5. **Live-Preview**: Kamerabild mit angewandter LUT, Split-View / Vorher-Nachher-Schieber, Korrektur-Stärke-Regler (0–100 %).
6. **Export** als LUT-Datei.

## 3. Funktionale Anforderungen

- Webcam-Zugriff, Kamerawahl, Auflösung (bis 1080p/4K wenn verfügbar), Standbild-Aufnahme.
- Die Spyder Checkr Photo besteht aus 4 Karten: 2 Graukarten (18 % und 50 % Grau) und 2 Farbkarten mit zusammen 48 Farbfeldern. Das Patch-Layout ist daher mehrkartig als Konfigurationsdatei (JSON) beschrieben: Karten mit je eigenem Raster, Positionen, Neutralfeldern und Referenzwerten (Lab/sRGB). Pro Aufnahme sind immer zwei Karten sichtbar (Graupaar oder Farbpaar), jede Karte bekommt eigene vier Eckpunkte. Das genaue Layout (Raster, Reihenfolge) wird vor M2 gegen die reale Karte geprüft.
  - Referenzprofile liegen als Konfigurationsdateien (JSON/CSV) vor und sind in der App auswählbar; zum Start gibt es nur das Profil Spyder Checkr 48 (siehe Abschnitt 10). Felder ohne Referenzwert werden bei der Berechnung ausgelassen.
- Linearisierung der Kamerawerte (sRGB-Decode als Annahme, per Neutralpatches der Farbseite korrigierbar).
- Korrekturmodell (alles aus den Messwerten der Farbseite aus Schritt 2, inklusive deren Neutralpatches):
  1. Weißabgleich (Gain je Kanal aus den Neutralpatches, in linearem RGB),
  2. 1D-Tonkurve je Kanal (monotone Interpolation durch die Neutralpatches, z. B. PCHIP),
  3. 3×3-Farbmatrix bzw. Root-Polynomial-Regression (Least Squares, Regularisierung) auf den Farbpatches,
  4. Fehlermaß ΔE2000 (Lab, D50/D65 wählbar).
- LUT-Erzeugung: Das Korrekturmodell wird auf ein reguläres Gitter (N³) in sRGB-Codewerten ausgewertet. Die Korrektur muss glatt und monoton bleiben, Ausgabewerte werden auf [0, 1] begrenzt; außerhalb des gemessenen Bereichs (Nähe Schwarz/Weiß) wird sanft zur Identität bzw. zu den Extremwerten überblendet, damit keine Artefakte entstehen. Die Stärke (0–100 %) mischt zwischen Identitäts-LUT und Korrektur.
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
| Styling | **Tailwind CSS** | zügiges, konsistentes UI |
| Kamera | Web APIs: `getUserMedia`, `requestVideoFrameCallback` | native |
| Live-Preview / LUT-Anwendung | **WebGL2** (eigener schlanker Fragment-Shader, 3D-Textur, trilineare Interpolation) | Echtzeit, keine schwere Lib nötig |
| Bildanalyse | Canvas 2D / `OffscreenCanvas` + eigener Code (Homographie, Median); optional **OpenCV.js** erst für Auto-Erkennung (Phase 2) | OpenCV.js ist ~8 MB, daher nicht im MVP |
| Mathe | **ml-matrix** (Least Squares / SVD) | kleine Lib für Regression |
| Farbmodell | eigene Module (sRGB↔XYZ↔Lab, Bradford, ΔE2000), gegen **colorjs.io** in Tests verifiziert | nachprüfbar |
| Charts | **uPlot** oder SVG (Tonkurve, ΔE-Balken) | leichtgewichtig |
| Tests | **Vitest** + `@vitest/coverage-v8`, `@vue/test-utils`, happy-dom (Coverage ≥ 99 %) | passt zu Vite |
| Lint/Format | ESLint 9 (strict, typbewusst, Vue, a11y, Unicorn …), Prettier, Stylelint, markdownlint, knip, Husky, lint-staged, commitlint | siehe Abschnitt 8 |
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

0. **M0 – Repo & Pipeline:** Git, Conventional Commits, Husky/lint-staged/commitlint, vollständige Lint-Konfiguration (ESLint strict, Prettier, Stylelint, markdownlint, knip, TypeScript strict), Vitest mit 99-%-Schwellwert, CI-Workflow, release-please, Pages-Deployment, `CHANGELOG.md`.
1. **M1 – Grundgerüst:** Vite/Vue/TS, Kamera-Livebild, Kamerawahl, Standbild.
2. **M2 – Graustufen-Schritt:** Mehrkarten-Layout (JSON), Eckpunkt-Ausrichtung je Karte, Patch-Messung, Helligkeits-Ampel mit Clipping-Warnung, Warnhinweis zur Kamera-Automatik.
3. **M3 – Farb-Schritt & Solver:** Referenzdaten und Profilimport, Farbpaar (2 Karten, 48 Felder), Fit, ΔE-Report, Vorher/Nachher.
4. **M4 – LUT & Live-Preview:** WebGL2-Pipeline, Split-View, Stärke-Regler.
5. **M5 – Export:** `.cube` (+ `.3dl`, Hald), Projekt speichern/laden.
6. **M6 – Politur:** Auto-Erkennung der Karte (OpenCV.js, optional), README mit Anleitung, Lizenz, Feinschliff.

## 8. Qualitätssicherung (Code-Coverage ≥ 99 %)

- **Vitest** mit `@vitest/coverage-v8`; Schwellwerte in `vitest.config.ts`: `statements`, `branches`, `functions`, `lines` jeweils **99 %**. Unterschreitung lässt den Testlauf fehlschlagen.
- Die Coverage wird bei der Entwicklung laufend verifiziert, nicht erst am Ende:
  - jeder Meilenstein gilt erst als fertig, wenn `npm run test:coverage` die 99 % hält,
  - lokaler Hook (Husky) führt vor `git push` Lint, Typecheck und Coverage-Check aus,
  - CI (siehe Abschnitt 9) prüft dasselbe bei jedem Push und Pull Request.
- Testarten: Unit-Tests für Farbmathe, Solver, LUT-Erzeugung und Exporter (Referenzwerte, Randfälle); Komponententests mit **@vue/test-utils** und **happy-dom**; Kamera, WebGL und Canvas werden hinter dünnen Adaptern gemockt, damit die Logik testbar bleibt.
- Ausschlüsse von der Coverage sind eng gefasst (z. B. reine Einstiegsdatei `main.ts`, Typdeklarationen) und in der Config begründet; Ausschlüsse werden nicht genutzt, um die Schwelle zu erreichen.
- Grenzfall WebGL/Kamera: Die Adapter bleiben so dünn wie möglich und werden mit Fake-Objekten getestet, damit sie in der 99-%-Messung enthalten sind. Reiner Shader-Quelltext (GLSL) zählt nicht als Code; seine Mathematik wird zusätzlich als TypeScript-Referenzimplementierung getestet, die dieselbe Interpolation berechnet.
- Coverage-Report (lcov + Text) wird in der CI als Artefakt abgelegt; ein Badge im README zeigt den Stand.

### Linting & statische Analyse (Best Practices)

Alle Prüfungen laufen lokal (`npm run lint`, Husky `pre-commit` über **lint-staged**), vor dem Push und in der CI. Warnungen zählen als Fehler (`--max-warnings 0`).

- **ESLint 9 (Flat Config)** mit:
  - `typescript-eslint` im Modus `strictTypeChecked` + `stylisticTypeChecked` (typbewusste Regeln, z. B. `no-floating-promises`, `no-unsafe-*`, `strict-boolean-expressions`),
  - `eslint-plugin-vue` mit `flat/recommended` (Vue 3) plus Regeln für `<script setup>`, Typ-basierte Props/Emits und Template-Barrierefreiheit,
  - `eslint-plugin-vuejs-accessibility` (a11y im Template),
  - `eslint-plugin-import-x` (Importreihenfolge, keine Zyklen, keine doppelten Imports),
  - `eslint-plugin-unicorn` (Code-Qualität) und die ESLint-Kernregel `complexity` (Komplexitätsgrenze),
  - `eslint-plugin-vitest` (Testregeln, keine fokussierten/übersprungenen Tests),
  - `eslint-plugin-regexp` und `eslint-plugin-promise`,
  - `eslint-plugin-security` für sicherheitsrelevante Muster,
  - `eslint-config-prettier`, damit Formatierung nicht mit ESLint kollidiert.
- **TypeScript:** `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`; Typecheck mit `vue-tsc --noEmit`.
- **Prettier** für Formatierung (inkl. Vue, JSON, Markdown, YAML), CI prüft mit `prettier --check`.
- **Weitere Linter:** `stylelint` (Tailwind-/CSS-Regeln), `markdownlint-cli2` (README, Plan, Changelog), `actionlint` (GitHub-Workflows), `commitlint` (Commit-Nachrichten), `knip` (ungenutzte Dateien, Exporte und Abhängigkeiten), `import-x/no-cycle` und `import-x/no-restricted-paths` (Architekturregeln, z. B. `color/` darf nicht von `ui/` abhängen).
- **Sicherheit & Abhängigkeiten:** `npm audit --audit-level=high` in der CI, Dependabot, CodeQL-Workflow für JavaScript/TypeScript.
- **Editor-Konsistenz:** `.editorconfig`, empfohlene VS-Code-Extensions und Einstellungen (`.vscode/`), `.gitattributes` für einheitliche Zeilenenden.

## 9. CI/CD & Releases (GitHub)

- **Repository:** GitHub, Standardbranch `main`. Ablauf: initialer Commit mit dem Plan lokal, danach legt der Nutzer das GitHub-Repo an und pusht.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:` …), geprüft per **commitlint** (lokal über Husky und in der CI für Pull Requests).
- **CI-Workflow** (`.github/workflows/ci.yml`, bei Push und Pull Request): Install (`npm ci`, Cache) → ESLint (`--max-warnings 0`) → Stylelint → markdownlint → actionlint → Prettier-Check → `vue-tsc` Typecheck → knip → `npm audit` → Vitest mit Coverage-Schwellwert 99 % → Production-Build. Node-LTS-Version fest gepinnt.
- **Changelog & Releases:** **release-please** (GitHub Action) liest die Conventional Commits, pflegt `CHANGELOG.md` und öffnet einen Release-PR mit Versionssprung (SemVer). Beim Mergen entstehen automatisch Git-Tag und GitHub Release mit Changelog-Eintrag und angehängtem Build-Artefakt (zip von `dist/`).
  - Hinweis: Pull Requests, die mit dem Standard-`GITHUB_TOKEN` erstellt werden, lösen keine weiteren Workflows aus. Damit die CI auch auf dem Release-PR läuft, braucht release-please ein eigenes Token (Personal Access Token oder GitHub App), das der Nutzer als Repo-Secret hinterlegt.
- **Deployment:** Nach einem Release automatisch Veröffentlichung auf **GitHub Pages** (statischer Build, HTTPS ist für die Kamera nötig). Der Deploy-Job läuft im selben Workflow wie release-please (Bedingung: Release wurde erstellt), weil ein Release, das mit dem `GITHUB_TOKEN` entsteht, keinen separaten Workflow startet.
- **Zusätzlich:** Dependabot für npm und GitHub Actions; Branch-Protection auf `main` (CI muss grün sein) wird beim Anlegen des Repos vom Nutzer aktiviert.

## 10. Entscheidungen (geklärt)

- **Referenzwerte:** Startprofil `src/data/profiles/spyder-checkr-48.json` mit 48 Feldern (Lab D50 + sRGB), abgetippt aus einer Drittquelle (Bartneck 2017, Ursprung Datacolor-Bitmap). Status `unverified`: nicht offiziell und nicht gegen die Checkr Photo bestätigt. Lab und sRGB passen im Mittel gut zusammen (ΔE76 ≈ 0,8; Ausreißer 1F wegen sRGB-Clipping). Echte Datacolor-Werte lassen sich später als JSON/CSV importieren und in der App auswählen.
- **Einsatzzweck:** Die LUT wird für die Webcam bzw. den Portkeys-Kameramonitor erzeugt und manuell dort hochgeladen. Die App erzeugt nur die LUT-Datei, es gibt keine Geräteanbindung. Primärformat `.cube`; welche Größe der Monitor akzeptiert, testet der Nutzer selbst. Export wahlweise 17³/33³/65³, Standard 33³.
- **Webcam-Automatik:** Nur Warnhinweis. Auto-Belichtung/-Weißabgleich fixiert der Nutzer in der Kamera-Software, die App setzt keine Constraints.
- **Farbraum:** sRGB / Rec.709 für Ein- und Ausgabe.
- **Kartenaufnahme:** Immer sind beide Graukarten oder beide Farbkarten gleichzeitig sichtbar, die Aufnahme erfolgt nacheinander (Grau, dann Farbe); jede Karte bekommt eigene Eckpunkte.
- **Ampelwerte Schritt 1:** Weiß unter ca. 95 %, Schwarz über ca. 3 %, Mittelgrau im Zielbereich; Werte sind im Profil hinterlegt und später in der App justierbar.

## 11. Risiken

- **Dynamikumfang:** 8-bit-Video und Kamera-Tonemapping begrenzen die Genauigkeit; die LUT korrigiert nur den fixierten Kamerazustand (bei geänderter Beleuchtung/Einstellung neu kalibrieren).
- **Referenzgenauigkeit:** Das Startprofil ist eine inoffizielle Transkription; Abweichungen zur realen Karte (Charge, Alterung, andere Zuordnung der Felder) sind möglich. Die Kartenzuordnung (Spalten 1–6, Reihen A–H, zwei Karten zu je 24 Feldern) ist angenommen und wird an der realen Karte geprüft.
