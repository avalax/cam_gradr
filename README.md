# cam_gradr

[![CI](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml/badge.svg)](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

Webcam-LUT-Generator für die **Datacolor Spyder Checkr Photo**. Die Single-Page-Webapp nimmt die Karten
mit der Webcam auf, stellt zuerst die Raumhelligkeit ein und berechnet danach eine 3D-LUT, die die
Farbwiedergabe der Webcam korrigiert. Die LUT lässt sich als Datei exportieren und zum Beispiel in einen
Kameramonitor laden.

Alles läuft im Browser. Es gibt kein Backend, Bilder und Messwerte verlassen den Rechner nicht.

## Status

Die App entsteht in Meilensteinen (siehe [PLAN.md](PLAN.md)).

| Meilenstein | Inhalt                                                      | Stand  |
| ----------- | ----------------------------------------------------------- | ------ |
| M0          | Repo, Lint, Tests mit 99-%-Coverage-Gate, CI, Releases      | fertig |
| M1          | Kamerawahl, Livebild, Standbild                             | fertig |
| M2          | Schritt 1: Graukarten, Eckpunkte, Helligkeits-Ampel         | fertig |
| M3          | Schritt 2: Farbkarten, Referenz-Import, Korrekturberechnung | fertig |
| M4          | LUT-Erzeugung und Live-Vorschau mit Vorher/Nachher          | fertig |
| M5          | Export als `.cube`, Projekt speichern und laden (JSON)      | fertig |
| M6          | Optionale automatische Kartenerkennung, Feinschliff         | offen  |

Noch nicht an der echten Karte geprüft sind die Feldpositionen im Layout und die Schwellen der Ampel.
Beides ist aus Fotos geschätzt und lässt sich in `src/data/layouts/` bzw. `src/chart/exposure.ts`
anpassen.

## So funktioniert es

Die App hat fünf Tabs, die jederzeit frei anwählbar sind: **Kamera**, **Graukarten**, **Farbkarten**,
**Vorschau** und **Export**.
Im Tab Kamera schaltest du die Kamera an oder aus: bei „an“ siehst du alle Kameraoptionen und das
Livebild, bei „aus“ das aufgenommene Standbild.

1. **Tab Graukarten: Raumhelligkeit.** Beide Graukarten ruhig vor die Kamera halten und ein Standbild
   aufnehmen. Auf dem Standbild die Eckpunkte der Karten setzen. Eine senkrechte Graustufen-Skala neben dem Bild zeigt, ob der Raum zu dunkel,
   zu hell oder passend ist. Das Licht so einstellen, dass die Marke im umrahmten Zielbereich steht (Details beim Überfahren der Skala). Im Livebild misst die App
   laufend mit denselben Eckpunkten weiter, solange die Karten nicht bewegt werden.
2. **Tab Farbkarten: Farbkorrektur.** Referenzwerte der Karten importieren (JSON oder CSV, bleiben lokal im
   Browser), beide Farbkarten aufnehmen, Eckpunkte setzen und die Korrektur berechnen. Der Bericht zeigt
   den Farbfehler (ΔE2000) je Feld vorher und nachher.
3. **Tab Vorschau.** Das Kamerabild mit der berechneten Korrektur ansehen: ein Regler stellt die Stärke
   ein, eine verschiebbare Trennlinie zeigt links das Original und rechts das korrigierte Bild.
4. **Tab Export.** Die Korrektur als 3D-LUT im Format `.cube` herunterladen (Größe 17³, 33³ oder 65³). Die
   in der Vorschau gewählte Stärke wird fest eingerechnet. Welche Größe dein Gerät annimmt, steht in
   dessen Handbuch.

In der Kopfzeile sichern **Projekt speichern** und **Projekt laden** den Arbeitsstand als JSON-Datei
(Eckpunkte, Messwerte, Korrekturmodell, Vorschau-Einstellungen). Referenzwerte der Hersteller stehen nicht
in der Datei, nur der Name des gewählten Satzes.

Wichtig für brauchbare Ergebnisse: Auto-Belichtung und Auto-Weißabgleich der Kamera vorher in der
Kamera-Software festsetzen. Die App kann das nicht selbst tun und zeigt dazu einen Hinweis.

## Referenzwerte der Karten

Die Farbwerte der Karten gehören dem Hersteller und sind **nicht Teil dieses Repos**. Das Repo enthält
nur das Layout (Position der Felder). Die Referenzwerte importierst du in Schritt 2 selbst aus einer
eigenen Datei. Die App speichert sie ausschließlich lokal im Browser (IndexedDB) und sendet sie nie
irgendwohin. Ordner wie `local-data/` sind in der `.gitignore` ausgeschlossen, damit solche Dateien
nicht versehentlich eingecheckt werden.

Unterstützte Formate (Lab-Werte mit Weißpunkt D50, je Feld-ID wie `1A` bis `6H`; Ziffer = Reihe,
Buchstabe = Spalte, Karte 1 = Spalten A–D, Karte 2 = Spalten E–H):

- **JSON:** `{ "format": "cam_gradr-reference/1", "name": "Mein Satz", "illuminant": "D50",
"patches": [{ "id": "1A", "lab": [L, a, b] }, …] }`
- **CSV:** Spalten `id; L; a; b` (Trennzeichen Semikolon, Tabulator oder Komma, optionale Kopfzeile,
  bei Semikolon auch Dezimalkomma).

Es müssen mindestens 12 Felder enthalten sein, davon mindestens 4 Neutralfelder (Grauleitern, Spalten
D und E). Gespeicherte Sätze lassen sich in der App auswählen und löschen.

## Entwicklung

Voraussetzung ist Node.js 22 (siehe `.nvmrc`).

```bash
npm ci            # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver starten
npm run build     # Produktions-Build
npm run verify    # alle Prüfungen (Lint, Typecheck, knip, Tests mit Coverage)
npm run e2e:install   # einmalig: Firefox für die Akzeptanztests installieren (Chrome muss vorhanden sein)
npm run e2e       # Playwright-Akzeptanztests (baut die App und startet sie)
npm run verify:all    # verify und e2e zusammen
```

Die Kamera funktioniert nur über `localhost` oder HTTPS.

### Qualitätssicherung

- **Tests:** Vitest mit mindestens **99 % Coverage** (Statements, Branches, Functions, Lines). Fällt die
  Coverage darunter, schlägt der Lauf fehl.
- **Akzeptanztests:** Playwright prüft die komplette User Story in Chrome und Firefox mit einer synthetischen Kamera (siehe `e2e/`). Sie wachsen mit jedem Meilenstein und laufen in der CI als eigener Job `acceptance`.
- **Linting:** ESLint (strikt, typbewusst, Vue, Barrierefreiheit), Prettier, Stylelint, markdownlint und
  knip. Warnungen gelten als Fehler.
- **Git-Hooks (Husky):** `pre-commit` prüft die geänderten Dateien, `commit-msg` prüft das Format der
  Commit-Nachricht, `pre-push` führt `npm run verify` aus.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/), zum Beispiel
  `feat: ...` oder `fix: ...`.

### Technik

Vue 3, Pinia, TypeScript (strikt), Vite und Tailwind CSS. Die Farbmathematik und die
Kartenauswertung (Homographie, Feldmessung, Helligkeitsbewertung) liegen als reine, getestete Module in
`src/color` und `src/chart`. Die Browser-Kamera ist hinter einem dünnen Adapter in `src/camera`
gekapselt.

## Releases

Releases entstehen automatisch: [release-please](https://github.com/googleapis/release-please) liest
die Conventional Commits, pflegt `CHANGELOG.md` und öffnet einen Release-Pull-Request. Beim Mergen
entstehen Tag und GitHub-Release mit Build-Artefakt, und die App wird auf GitHub Pages veröffentlicht.

## Lizenz

[MIT](LICENSE). Die Lizenz gilt für den Quellcode. Herstellerdaten wie die Referenzwerte der Karten sind
davon ausgenommen und nicht im Repo enthalten.
