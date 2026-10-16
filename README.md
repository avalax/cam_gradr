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

| Meilenstein | Inhalt                                                       | Stand  |
| ----------- | ------------------------------------------------------------ | ------ |
| M0          | Repo, Lint, Tests mit 99-%-Coverage-Gate, CI, Releases       | fertig |
| M1          | Kamerawahl, Livebild, Standbild                              | fertig |
| M2          | Schritt 1: Graukarten, Eckpunkte, Helligkeits-Ampel          | fertig |
| M3          | Schritt 2: Farbkarten, Referenz-Import, Korrekturberechnung  | offen  |
| M4          | LUT-Erzeugung und Live-Vorschau mit Vorher/Nachher           | offen  |
| M5          | Export als `.cube` (optional `.3dl`, Hald-PNG), Projektdatei | offen  |
| M6          | Optionale automatische Kartenerkennung, Feinschliff          | offen  |

Noch nicht an der echten Karte geprüft sind die Feldpositionen im Layout und die Schwellen der Ampel.
Beides ist aus Fotos geschätzt und lässt sich in `src/data/layouts/` bzw. `src/chart/exposure.ts`
anpassen.

## So funktioniert es

1. **Schritt 1: Raumhelligkeit.** Beide Graukarten ruhig vor die Kamera halten und ein Standbild
   aufnehmen. Auf dem Standbild die Eckpunkte der Karten setzen. Eine Ampel zeigt, ob der Raum zu dunkel,
   zu hell oder passend ist. Das Licht so einstellen, dass die Ampel grün wird. Im Livebild misst die App
   laufend mit denselben Eckpunkten weiter, solange die Karten nicht bewegt werden.
2. **Schritt 2: Farbkorrektur.** Beide Farbkarten aufnehmen und daraus die Korrektur berechnen
   (in Arbeit).
3. **Live-Vorschau und Export.** Die Korrektur im Kamerabild prüfen und als LUT speichern (in Arbeit).

Wichtig für brauchbare Ergebnisse: Auto-Belichtung und Auto-Weißabgleich der Kamera vorher in der
Kamera-Software festsetzen. Die App kann das nicht selbst tun und zeigt dazu einen Hinweis.

## Referenzwerte der Karten

Die Farbwerte der Karten gehören dem Hersteller und sind **nicht Teil dieses Repos**. Das Repo enthält
nur das Layout (Position der Felder). Die Referenzwerte (Lab und sRGB je Feld) importierst du beim Start
selbst aus einer eigenen Datei. Die App speichert sie ausschließlich lokal im Browser und sendet sie nie
irgendwohin. Der Import ist für M3 vorgesehen. Ordner wie `local-data/` sind in der `.gitignore`
ausgeschlossen, damit solche Dateien nicht versehentlich eingecheckt werden.

## Entwicklung

Voraussetzung ist Node.js 22 (siehe `.nvmrc`).

```bash
npm ci            # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver starten
npm run build     # Produktions-Build
npm run verify    # alle Prüfungen (Lint, Typecheck, knip, Tests mit Coverage)
npm run e2e:install   # einmalig: Browser für die Akzeptanztests installieren
npm run e2e       # Playwright-Akzeptanztests (baut die App und startet sie)
npm run verify:all    # verify und e2e zusammen
```

Die Kamera funktioniert nur über `localhost` oder HTTPS.

### Qualitätssicherung

- **Tests:** Vitest mit mindestens **99 % Coverage** (Statements, Branches, Functions, Lines). Fällt die
  Coverage darunter, schlägt der Lauf fehl.
- **Akzeptanztests:** Playwright prüft die komplette User Story im echten Browser mit einer synthetischen Kamera (siehe `e2e/`). Sie wachsen mit jedem Meilenstein und laufen in der CI als eigener Job `acceptance`.
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
