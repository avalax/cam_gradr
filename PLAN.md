# cam_gradr – Webcam-LUT-Generator mit Datacolor Spyder Checkr Photo

## 1. Ziel

Single-Page-Webapp (rein clientseitig, kein Backend), die mit der Webcam eine Datacolor **Spyder Checkr Photo** aufnimmt und daraus eine **3D-LUT** berechnet, die die Farbwiedergabe der Webcam korrigiert. Die Korrektur ist live in der Vorschau sichtbar und als LUT exportierbar.

## 2. Ablauf (User Flow)

**Aufbau der Oberfläche (Tabs):** Die App hat drei frei anwählbare Tabs, es gibt keine Sperren. **Kamera:** ein Umschalter „Kamera an / Kamera aus“. Bei „an“ stehen alle Kameraoptionen (Kamera, Auflösung, Hinweis zur Kamera-Automatik) und das Livebild mit „Standbild aufnehmen“ zur Verfügung. Bei „aus“ werden Optionen und Livebild durch die Ansicht des aufgenommenen Standbilds ersetzt. **Graukarten:** Eckpunkte setzen und Raumhelligkeit einstellen (Schritt 1). **Farbkarten:** Referenzwerte importieren, Eckpunkte setzen, Korrektur berechnen (Schritt 2). Das Standbild wandert zwischen dem Kamera-Tab und den Kartentabs mit; beim direkten Wechsel zwischen Grau- und Farbkarten wird es verworfen. Die folgenden Abschnitte nennen die beiden Kartentabs weiter „Schritt 1“ und „Schritt 2“.

1. **Kamera wählen & starten** (`getUserMedia`, Geräteliste, Auflösung, Spiegelung aus); die Steuerung ist Teil von Schritt 1, es gibt keinen eigenen Kamera-Schritt.
2. **Schritt 1 – Graustufenseite (Belichtung/Helligkeit)**
   - Die beiden Graukarten (18 % und 50 % Grau) werden gemeinsam vor die Kamera gehalten und sind zusammen im Bild.
   - Zweck: Die Raumhelligkeit so einstellen, dass die Beleuchtung ideal für Schritt 2 ist. Dieser Schritt berechnet nichts für die LUT.
   - Eckpunkte setzt der Nutzer auf einem **Standbild** (gemittelt über mehrere Frames), nicht auf dem bewegten Livebild; auf dem Standbild lassen sie sich ziehen. Bei jedem neuen Standbild wird mit den vorhandenen Eckpunkten sofort neu gemessen.
   - Zurück im Livebild misst die App laufend mit denselben Eckpunkten (die Karten dürfen dafür nicht bewegt werden), damit das Licht live eingestellt werden kann. Pro Feld wird die gemessene Helligkeit mit dem Sollbereich verglichen.
   - Sollbereich (konfigurierbar, in der Layout-/App-Konfiguration hinterlegt): Weißfeld nicht geclippt (Kanäle unter ca. 95 %), Schwarzfeld nicht abgesoffen (über ca. 3 %), die beiden großen Graufelder im Zielbereich (18 %-Feld ≈ sRGB 46 %, 50 %-Feld ≈ sRGB 74 %, jeweils mit Toleranz, unter Annahme einer sRGB-Kurve). Weiß- und Schwarzprüfung nutzen das hellste und dunkelste Streifenfeld. Die genauen Toleranzen werden in M2 festgelegt und getestet.
   - Anzeige: eine senkrechte Helligkeitsskala in Graustufen neben dem Kamerabild (oben hell = zu hell, unten dunkel = zu dunkel, Zielbereich als umrahmtes Band in der Mitte) mit Marke für die aktuelle Abweichung und Kappen bei geclippten Lichtern bzw. abgesoffenen Schatten. Beim Überfahren (oder Fokussieren per Tastatur) der Skala erscheinen die Details: Hinweis, ob das Licht heller oder dunkler gestellt werden soll, Helligkeit der beiden großen Felder, Abweichung, Lichter und Schatten. Das spart Platz; ein Histogramm gibt es nicht.
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
- Die Spyder Checkr Photo besteht aus 4 Karten: 2 Graukarten (18 % und 50 % Grau) und 2 Farbkarten mit zusammen 48 Farbfeldern. Das Patch-Layout ist daher mehrkartig als Konfigurationsdatei (JSON) beschrieben: Karten mit je eigenem Raster, Positionen, Neutralfeldern und Referenzwerten (Lab/sRGB). Pro Aufnahme sind immer zwei Karten sichtbar (Graupaar oder Farbpaar), jede Karte bekommt eigene vier Eckpunkte. Das Layout ist an Fotos einer SCK300 bestätigt (Details in Abschnitt 11 und in `src/data/profiles/`).
  - **Referenzwerte sind nicht Teil des Repos.** Das Repo enthält nur das Layout (Karte, Spalte, Reihe je Feld-ID). Die Farbwerte (Lab/sRGB je ID) importiert der Nutzer beim ersten Start als Datei (JSON oder CSV, Format `cam_gradr-reference/1`), z. B. aus eigenen Datacolor-Daten. Die App prüft die Datei (alle IDs vorhanden, Wertebereiche, Weißpunkt), speichert sie nur lokal im Browser (IndexedDB) und sendet sie nie irgendwohin. Ohne importierte Werte ist die Berechnung gesperrt; Schritt 1 funktioniert ohne Import. Mehrere importierte Datensätze sind in der App auswählbar. Felder ohne Referenzwert werden bei der Berechnung ausgelassen.
- Linearisierung der Kamerawerte (sRGB-Decode als Annahme, per Neutralpatches der Farbseite korrigierbar).
- Korrekturmodell (alles aus den Messwerten der Farbseite aus Schritt 2, inklusive deren Neutralpatches):
  1. 1D-Tonkurve je Kanal inklusive Weißabgleich (monotone Interpolation, PCHIP, durch die Neutralpatches),
  2. 3×3-Farbmatrix mit Zeilensumme 1 (Least Squares, Regularisierung) auf allen Patches; Root-Polynomial-Regression als spätere Erweiterung,
  3. Bericht ΔE2000 je Patch vorher/nachher,
  4. Fehlermaß ΔE2000 (Lab). Referenzen liegen in D50 vor, die Kamerawerte (sRGB, D65) werden per Bradford nach D50 adaptiert; der Bezugsweißpunkt steht in den importierten Referenzdaten.
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
- Responsive, aber primär Desktop. Die Seite und das Kamerabild nutzen die volle Fensterbreite.
- Testbare Farbmathematik (Unit-Tests mit Referenzwerten).
- **Code-Coverage mindestens 99 %**, laufend verifiziert (lokal, per Hook und in der CI), siehe Abschnitt 8.
- Automatisierte Pipeline auf GitHub mit Changelog und automatischen Releases, siehe Abschnitt 10.
- **Playwright-Akzeptanztests** für die komplette User Story, inkrementell mit jedem Meilenstein erweitert und mit denselben Qualitätsanforderungen wie die App, siehe Abschnitt 9.
- Hinweise zu Grenzen: 8-bit-Webcam, Auto-Funktionen der Kamera, Beleuchtung (Flackern, Mischlicht), Reflexionen auf der Karte.

## 5. Technologie-Stack

| Bereich                      | Wahl                                                                                                                         | Begründung                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Build/Dev                    | **Vite** + **TypeScript** (`create-vue`)                                                                                     | schnell, statisch deploybar                        |
| UI                           | **Vue 3** (Composition API, `<script setup>`)                                                                                | Komponenten für Wizard-Schritte, reaktive Zustände |
| State                        | **Pinia**                                                                                                                    | offizieller Vue-Store, minimal                     |
| Styling                      | **Tailwind CSS**                                                                                                             | zügiges, konsistentes UI                           |
| Kamera                       | Web APIs: `getUserMedia`, `requestVideoFrameCallback`                                                                        | native                                             |
| Live-Preview / LUT-Anwendung | **WebGL2** (eigener schlanker Fragment-Shader, 3D-Textur, trilineare Interpolation)                                          | Echtzeit, keine schwere Lib nötig                  |
| Bildanalyse                  | Canvas 2D / `OffscreenCanvas` + eigener Code (Homographie, Median); optional **OpenCV.js** erst für Auto-Erkennung (Phase 2) | OpenCV.js ist ~8 MB, daher nicht im MVP            |
| Mathe                        | **ml-matrix** (Least Squares / SVD)                                                                                          | kleine Lib für Regression                          |
| Farbmodell                   | eigene Module (sRGB↔XYZ↔Lab, Bradford, ΔE2000), gegen **colorjs.io** in Tests verifiziert                                    | nachprüfbar                                        |
| Charts                       | **uPlot** oder SVG (Tonkurve, ΔE-Balken)                                                                                     | leichtgewichtig                                    |
| Tests                        | **Vitest** + `@vitest/coverage-v8`, `@vue/test-utils`, happy-dom (Coverage ≥ 99 %)                                           | passt zu Vite                                      |
| Akzeptanztests               | **Playwright** (`@playwright/test`, Chromium, synthetische Kamera per Y4M-Video), `eslint-plugin-playwright`                 | echter Browser, ganze User Story                   |
| Lint/Format                  | ESLint 9 (strict, typbewusst, Vue, a11y, Unicorn …), Prettier, Stylelint, markdownlint, knip, Husky, lint-staged, commitlint | siehe Abschnitt 8                                  |
| CI/CD                        | **GitHub Actions**, release-please, GitHub Pages, Dependabot                                                                 | siehe Abschnitt 10                                 |

## 6. Architektur / Modulstruktur

```text
src/
  camera/        Kamerazugriff, Frame-Capture, Mittelung
  chart/         Patch-Layout (JSON), Homographie, Patch-Sampling
  color/         Konvertierungen, ΔE2000, Linearisierung
  solve/         Weißabgleich, Tonkurve, Matrix/Polynom-Fit, Fehlerbericht
  lut/           3D-LUT-Erzeugung, .cube/.3dl/Hald-Export
  gl/            WebGL2-Renderer (Video → LUT → Canvas)
  ui/            Wizard-Schritte, Overlays, Helligkeits-Ampel, Export-Dialog
  data/layouts/  *.layout.json (Karten-Geometrie ohne Farbwerte); Referenzwerte kommen zur Laufzeit per Import
```

Datenfluss: Kamera → Frame → (Schritt 1) Graumessung → nur Helligkeits-Feedback (Ampel) → (Schritt 2) Farbmessung → Solver → 3D-LUT (Float32Array N³×3) → WebGL-Textur (Preview) und Export (Datei).

## 7. Meilensteine

0. **M0 – Repo & Pipeline** (inklusive Playwright-Setup und Job `acceptance`)**:** Git, Conventional Commits, Husky/lint-staged/commitlint, vollständige Lint-Konfiguration (ESLint strict, Prettier, Stylelint, markdownlint, knip, TypeScript strict), Vitest mit 99-%-Schwellwert, CI-Workflow, release-please, Pages-Deployment, `CHANGELOG.md`.
1. **M1 – Grundgerüst:** Vite/Vue/TS, Kamera-Livebild, Kamerawahl, Standbild.
2. **M2 – Graustufen-Schritt:** Mehrkarten-Layout (JSON), Eckpunkt-Ausrichtung je Karte, Patch-Messung, Helligkeits-Ampel mit Clipping-Warnung, Warnhinweis zur Kamera-Automatik.
3. **M3 – Farb-Schritt & Solver:** Referenz-Import (Validierung, lokale Speicherung), Farbpaar (2 Karten, 48 Felder), Fit, ΔE-Report, Vorher/Nachher.
4. **M4 – LUT & Live-Preview:** WebGL2-Pipeline, Split-View, Stärke-Regler.
5. **M5 – Export:** `.cube` (+ `.3dl`, Hald), Projekt speichern/laden.
6. **M6 – Politur:** Auto-Erkennung der Karte (OpenCV.js, optional), README mit Anleitung, Feinschliff.

**Stand M0 (umgesetzt):** Projektgerüst, Lint-/Format-Konfiguration, Husky-Hooks (pre-commit, commit-msg, pre-push), Vitest mit 99-%-Gate, CI-, Release-, CodeQL-Workflows und Dependabot sind im Repo; `npm run verify` läuft lokal grün. TypeScript ist auf `~6.0` festgelegt, weil `typescript-eslint` TypeScript 7 noch nicht unterstützt. Noch zu tun durch den Nutzer: GitHub-Repo anlegen, `RELEASE_PLEASE_TOKEN` als Secret setzen, Pages auf „GitHub Actions“ stellen, Branch-Protection aktivieren.

**Stand M1 (umgesetzt):** Kamerawahl, Auflösungswahl, Livebild, Start/Stop und Standbild (Mittelung über 8 Frames) mit Fehlermeldungen und Hinweis zur Kamera-Automatik. Die Browser-Kamera liegt hinter dem Adapter `CameraApi`; Coverage liegt bei 100 %. Offen für den Praxistest: Das Verhalten mit der echten Webcam und dem Portkeys-Workflow ist noch nicht geprüft.

**Stand M2 (umgesetzt):** Schritt 1 enthält die Kamerasteuerung. Nach dem ersten Praxistest wurde das Setzen der Eckpunkte vom Livebild auf ein Standbild verlegt (auf bewegten Bildern nicht bedienbar). Eckpunkte beider Graukarten werden auf dem Standbild per Klick gesetzt, sind nummeriert, lassen sich ziehen und werden unabhängig von der Klickreihenfolge automatisch einsortiert (oben links, oben rechts, unten rechts, unten links); die Homographie rechnet Kartenkoordinaten ins Bild um, der Median im inneren Feldbereich liefert die Messwerte, und die Ampel (zu dunkel / passt / zu hell / zu hoher Kontrast) wertet die großen Felder sowie das hellste und dunkelste Streifenfeld aus. Das Layout liegt im Format `cam_gradr-layout/2` mit Feldrechtecken relativ zur Karte. **Offen:** Die Rechtecke und Ampel-Schwellen sind aus Fotos geschätzt und müssen an der echten Karte per Overlay geprüft und nachjustiert werden.

**Stand M3 (umgesetzt):** Schritt 2 „Farbkarten“ mit Referenz-Import (JSON `cam_gradr-reference/1` oder CSV mit id, L, a, b; Prüfung von IDs, Wertebereichen, Mindestzahl an Feldern; lokale Ablage in IndexedDB unter `avalax.cam_gradr`, Auswahl und Löschen mehrerer Sätze), Aufnahme der Farbkarten auf einem Standbild mit denselben Eckpunkt-Werkzeugen wie Schritt 1 (gemeinsame Komponente `CardStage`), Berechnung des Korrekturmodells und Bericht mit ΔE2000 je Feld, Mittel und Maximum sowie Farbfeldern Soll / Kamera / korrigiert.

Umgesetztes Korrekturmodell (Abweichung vom ursprünglichen Plan): Weißabgleich und Tonkurve sind zu **einer monotonen Tonkurve je Kanal** (PCHIP durch die zwölf Neutralfelder, Ankerpunkte bei 0 und 1) zusammengefasst, danach folgt eine **3×3-Matrix, deren Zeilen sich zu 1 summieren** (Neutral bleibt neutral), mit schwacher Regularisierung zur Einheitsmatrix. Das Ziel ist linearer sRGB (D65); die Referenzen (Lab, D50) werden per Bradford umgerechnet. Die Farbmathematik (Lab, ΔE2000) ist gegen **colorjs.io** getestet. Eine Root-Polynomial-Regression bleibt eine mögliche spätere Erweiterung.

## 8. Qualitätssicherung (Code-Coverage ≥ 99 %)

- **Vitest** mit `@vitest/coverage-v8`; Schwellwerte in `vitest.config.ts`: `statements`, `branches`, `functions`, `lines` jeweils **99 %**. Unterschreitung lässt den Testlauf fehlschlagen.
- Die Coverage wird bei der Entwicklung laufend verifiziert, nicht erst am Ende:
  - jeder Meilenstein gilt erst als fertig, wenn `npm run test:coverage` die 99 % hält,
  - lokaler Hook (Husky) führt vor `git push` Lint, Typecheck und Coverage-Check aus,
  - CI (siehe Abschnitt 10) prüft dasselbe bei jedem Push und Pull Request.
- Testarten: Unit-Tests für Farbmathe, Solver, LUT-Erzeugung und Exporter (Referenzwerte, Randfälle); Komponententests mit **@vue/test-utils** und **happy-dom**; Testbilder werden synthetisch im Test erzeugt, es werden keine Fotos ins Repo eingecheckt (Bilddateien sind in `.gitignore` ausgeschlossen); Kamera, WebGL und Canvas werden hinter dünnen Adaptern gemockt, damit die Logik testbar bleibt.
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
  - `@vitest/eslint-plugin` (Testregeln, keine fokussierten/übersprungenen Tests),
  - `eslint-plugin-regexp` und `eslint-plugin-promise`,
  - `eslint-plugin-security` für sicherheitsrelevante Muster,
  - `eslint-config-prettier`, damit Formatierung nicht mit ESLint kollidiert.
- **TypeScript:** `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`; Typecheck mit `vue-tsc --noEmit`.
- **Prettier** für Formatierung (inkl. Vue, JSON, Markdown, YAML), CI prüft mit `prettier --check`.
- **Weitere Linter:** `stylelint` (Tailwind-/CSS-Regeln), `markdownlint-cli2` (README, Plan, Changelog), `actionlint` (GitHub-Workflows), `commitlint` (Commit-Nachrichten), `knip` (ungenutzte Dateien, Exporte und Abhängigkeiten), `import-x/no-cycle` und `import-x/no-restricted-paths` (Architekturregeln, z. B. `color/` darf nicht von `ui/` abhängen).
- **Sicherheit & Abhängigkeiten:** `npm audit --omit=dev --audit-level=high` in der CI (nur Produktionsabhängigkeiten; bekannte Hinweise in reinen Dev-Tools wie markdownlint-cli2 werden über Dependabot nachgezogen), Dependabot, CodeQL-Workflow für JavaScript/TypeScript.
- **Editor-Konsistenz:** `.editorconfig`, empfohlene VS-Code-Extensions und Einstellungen (`.vscode/`), `.gitattributes` für einheitliche Zeilenenden.

## 9. Akzeptanztests (Playwright)

Die komplette User Story wird mit **Playwright** durchgängig im echten Browser getestet. Die Tests wachsen **inkrementell mit den Meilensteinen**: Zu jedem Meilenstein kommen die Szenarien der neuen Schritte hinzu, bestehende Szenarien bleiben und müssen grün bleiben. Ein Meilenstein gilt erst als fertig, wenn seine Szenarien grün sind.

- **Gegenstand:** die Produktions-Build-Version der App (`vite preview`), bedient wie ein Anwender (Klicks, Anzeigen, Texte), ohne Kenntnis der Interna.
- **Browser:** Jedes Szenario läuft in **Chrome und Firefox** (zwei Playwright-Projekte `chrome` und `firefox`). Safari/WebKit ist nicht Teil der Pipeline.
- **Synthetische Kamera:** Pro Test ersetzt ein Init-Skript `getUserMedia` und `enumerateDevices` durch einen Canvas-Stream (`canvas.captureStream`), auf den die Karten aus dem Layout gezeichnet werden (`e2e/support/synthetic-cards.ts`, `camera-stub.ts`). Damit funktionieren dieselben Szenarien in beiden Browsern, auch weil Firefox keine Videodatei als Kamera kennt. Es werden keine Fotos oder Videodateien benötigt. Es gibt Beleuchtungsvarianten (`ok`, `dark`, `bright`), die pro Szenario gewählt werden. Spätere Meilensteine ergänzen Farbkarten mit bekannter Verzerrung und Dummy-Referenzwerte.
- **Struktur:** `e2e/support/` (Seitenobjekt `AppPage`, Fixtures, Kamera-Attrappe, Szenenbeschreibung), `e2e/*.spec.ts` (ein File pro Abschnitt der Story, Szenarien auf Deutsch), `playwright.config.ts`.
- **Stand M2:** `schritt-1-raumhelligkeit.spec.ts` mit 10 Szenarien in beiden Browsern, also 20 Läufen (Raum passt, Livebild-Messung, Zurücksetzen, Eckpunkte nur auf dem Standbild, zu dunkel, zu hell, Reihenfolge der Eckpunkte egal, Layout liegt richtig auf beiden Karten).
- **Stand M3:** `schritt-2-farbkorrektur.spec.ts` mit 8 Szenarien (kein Berechnen ohne Referenzwerte, Import als JSON und als CSV, fehlerhafte Datei, Referenzwerte bleiben nach dem Neuladen, Löschen, Berechnung verbessert die Farben deutlich, beliebige Eckpunkt-Reihenfolge). Die Kamera-Attrappe zeigt dafür Farbkarten mit erfundenen Referenzwerten und einer bekannten Verfälschung (Farbmischung, Gain, Gamma), die die Berechnung rückgängig machen muss.
- **Geplante Erweiterung:** M4 Live-Vorschau und Stärke-Regler, M5 Export (heruntergeladene `.cube`-Datei wird geprüft), zum Schluss ein durchgehendes Szenario „vom Kamerastart bis zur LUT-Datei“.
- **Qualitätsanforderungen wie bei der App:** gleiche Lint-Regeln (ESLint strikt plus `eslint-plugin-playwright`), Prettier, strikte TypeScript-Prüfung (`e2e/` ist Teil von `vue-tsc`), knip, Commit-Konventionen und Hooks. In der CI läuft ein eigener Job `acceptance` (Pflichtprüfung für `main`) mit Installation von Chrome und Firefox und Report-Artefakt bei Fehlern.
- **Coverage-Anforderung:** Die 99 % Codeabdeckung gelten für die Unit-Tests. Für die Akzeptanztests ist die sinnvolle Entsprechung die **Abdeckung der User Story**: Jeder Schritt und jeder Fehlerfall der Story hat mindestens ein Szenario, und ein Szenario darf nur mit Begründung übersprungen werden (`test.fixme`/`skip` sind verboten, `forbidOnly` ist in der CI aktiv). Eine messbare Browser-Code-Coverage der E2E-Läufe ist nicht vorgesehen.
- **Lokal:** `npm run e2e:install` (einmalig, installiert Firefox; Google Chrome muss lokal installiert sein, die CI installiert beides), `npm run e2e`; `npm run verify:all` führt Unit- und Akzeptanztests zusammen aus. Der pre-push-Hook startet nur `verify`, damit Pushes schnell bleiben; die Akzeptanztests laufen verbindlich in der CI.

## 10. CI/CD & Releases (GitHub)

- **Repository:** GitHub, Standardbranch `main`. Der lokale Git-Verlauf besteht bereits (Plan, Layout-Dateien); danach legt der Nutzer das GitHub-Repo an und pusht.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:` …), geprüft per **commitlint** (lokal über Husky und in der CI für Pull Requests).
- **CI-Workflow** (`.github/workflows/ci.yml`, bei Push und Pull Request): Install (`npm ci`, Cache) → ESLint (`--max-warnings 0`) → Stylelint → markdownlint → actionlint → Prettier-Check → `vue-tsc` Typecheck → knip → `npm audit` → Vitest mit Coverage-Schwellwert 99 % → Production-Build. Parallel dazu läuft der Job `acceptance` mit den Playwright-Akzeptanztests (Abschnitt 9). Node-LTS-Version fest gepinnt.
- **Changelog & Releases:** **release-please** (GitHub Action) liest die Conventional Commits, pflegt `CHANGELOG.md` und öffnet einen Release-PR mit Versionssprung (SemVer). Beim Mergen entstehen automatisch Git-Tag und GitHub Release mit Changelog-Eintrag und angehängtem Build-Artefakt (zip von `dist/`).
  - Hinweis: Pull Requests, die mit dem Standard-`GITHUB_TOKEN` erstellt werden, lösen keine weiteren Workflows aus. Damit die CI auch auf dem Release-PR läuft, braucht release-please ein eigenes Token (Personal Access Token oder GitHub App), das der Nutzer als Repo-Secret hinterlegt.
- **Deployment:** Nach einem Release automatisch Veröffentlichung auf **GitHub Pages** (statischer Build, HTTPS ist für die Kamera nötig). Der Deploy-Job läuft im selben Workflow wie release-please (Bedingung: Release wurde erstellt), weil ein Release, das mit dem `GITHUB_TOKEN` entsteht, keinen separaten Workflow startet.
- **Zusätzlich:** Dependabot für npm und GitHub Actions; Branch-Protection auf `main` (CI muss grün sein) wird beim Anlegen des Repos vom Nutzer aktiviert.

## 11. Entscheidungen (geklärt)

- **Referenzwerte:** Werden bewusst nicht ins Repo eingecheckt und nicht ausgeliefert, damit keine Urheberrechts- oder Referenzverletzung entstehen kann. Die App importiert sie beim Start aus einer vom Nutzer bereitgestellten Datei und hält sie nur lokal im Browser. Das Repo enthält nur das selbst aus Fotos abgeleitete Layout (`src/data/layouts/`, ohne Farbwerte und ohne Herstellerbezeichnungen). Die Importdatei des Nutzers liegt lokal im Ordner `local-data/`, der in `.gitignore` steht. Tests nutzen ausschließlich synthetische Dummy-Referenzen.
- **Einsatzzweck:** Die LUT wird für die Webcam bzw. den Portkeys-Kameramonitor erzeugt und manuell dort hochgeladen. Die App erzeugt nur die LUT-Datei, es gibt keine Geräteanbindung. Primärformat `.cube`; welche Größe der Monitor akzeptiert, testet der Nutzer selbst. Export wahlweise 17³/33³/65³, Standard 33³.
- **Webcam-Automatik:** Nur Warnhinweis. Auto-Belichtung/-Weißabgleich fixiert der Nutzer in der Kamera-Software, die App setzt keine Constraints.
- **Farbraum:** sRGB / Rec.709 für Ein- und Ausgabe.
- **Lizenz:** MIT, Copyright (c) 2026 Avalax. Die Lizenz gilt für den Quellcode; Herstellerdaten (Referenzwerte der Karten) sind nicht Teil des Repos und fallen nicht darunter.
- **Anwendungs-Kennung:** `avalax.cam_gradr` (Anbieter- und App-Name, Inhaber ist der Nutzer). Sie steht als Konstante `APP_ID` in `src/ui/app-info.ts`, wird in der App angezeigt und dient als Präfix für lokale Speicherschlüssel (z. B. IndexedDB-Name für die Referenz-Importe) und für Projektdateien.
- **Kartenaufnahme:** Immer sind beide Graukarten oder beide Farbkarten gleichzeitig sichtbar, die Aufnahme erfolgt nacheinander (Grau, dann Farbe); jede Karte bekommt eigene Eckpunkte.
- **Ampelwerte Schritt 1:** Weiß unter ca. 95 %, Schwarz über ca. 3 %, Mittelgrau im Zielbereich; Werte sind in der Konfiguration hinterlegt und später in der App justierbar.

## 12. Risiken

- **Dynamikumfang:** 8-bit-Video und Kamera-Tonemapping begrenzen die Genauigkeit; die LUT korrigiert nur den fixierten Kamerazustand (bei geänderter Beleuchtung/Einstellung neu kalibrieren).
- **Referenzgenauigkeit:** Die Qualität der LUT hängt von den importierten Referenzwerten ab; inoffizielle oder abgetippte Quellen können Fehler enthalten, und Abweichungen zur realen Karte (Charge, Alterung) sind möglich. Die App validiert nur Format und Wertebereiche, nicht die Richtigkeit.
- **Graukarten:** Die Zuordnung 18 % / 50 % beruht nur auf dem Helligkeitsunterschied (auf den Karten ist keine Beschriftung sichtbar); für die 12 Streifenfelder gibt es keine Referenzwerte, die großen Felder sind nominal aus der Reflexion berechnet. Die Zuordnung ist per Konfiguration umkehrbar.
- **Urheberrecht:** Geklärt durch den Import-Ansatz (siehe Abschnitt 11). Der lokale Git-Verlauf wurde bereinigt, sodass die Referenzwerte auch in früheren Commits nicht mehr enthalten sind (geprüft vor dem ersten Push).
