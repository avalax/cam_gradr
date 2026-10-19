# cam_gradr

[![CI](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml/badge.svg)](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

LUT-Generator für die **Datacolor Spyder Checkr Photo**. Die Single-Page-Webapp nimmt die Karten
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
| M6          | Automatische Kartenerkennung, Feinschliff                   | läuft  |

Noch nicht an der echten Karte geprüft sind die Feldpositionen im Layout und die Schwellen der Ampel.
Beides ist aus Fotos geschätzt und lässt sich in `src/data/layouts/` bzw. `src/chart/exposure.ts`
anpassen.

## So funktioniert es

Der Schalter rechts oben neben dem Zahnrad schaltet die Kamera an oder aus (grün „Kamera starten“, rot „Kamera stoppen“), ohne den Tab zu wechseln. Unter den Tab-Namen steht kurz das Ergebnis, bei Graukarten und Farbkarten dazu eine Mini-Skala aus vier Strichen: leer = noch nichts, grün = gut (Licht im Normalbereich bzw. mittlere Abweichung nach der Korrektur höchstens 2), gelb = Hinweis. Die Kameraauswahl,
die Auflösung und der Hinweis zur Kamera-Automatik stehen im Zahnrad-Menü ⚙ oben rechts, dort als aufklappbare Abschnitte „Kamera“ und „Referenzwerte“ (zugeklappt mit Kurzfassung des Stands). Die App hat vier Tabs,
die jederzeit frei anwählbar sind: **Graukarten**, **Farbkarten**, **Vorschau** und **Export**.

1. **Tab Graukarten: Raumhelligkeit.** Beide Graukarten ruhig vor die Kamera halten.
   Im Livebild zeigen gestrichelte Rahmen, wo die Karten hingehalten werden sollen. Werden sie ruhig gehalten und erkannt, nimmt die App das Standbild selbst auf, setzt die Eckpunkte und schaltet die Kamera aus. Die Eckpunkte lassen sich ziehen; Zwei Symbole in der Bildecke: Kamera („Zurück zum Livebild“) und Papierkorb („Eckpunkte löschen“, beginnt die Suche von vorn und schaltet die Kamera wieder ein). Bei ausgeschalteter Kamera steht dort ein Platzhalter. Die Karten dürfen auch um 180° gedreht gehalten werden; die App erkennt das an den Streifenfeldern und ordnet die Felder entsprechend zu. Ein Messfeld neben dem Bild zeigt Helligkeit (senkrecht) und Kontrast (waagerecht): Der Punkt steht im umrahmten Fenster in der Mitte, wenn beides im Normalbereich liegt; darunter steht, was an Kamera oder Licht zu ändern ist. Das Licht so einstellen, dass der Punkt im Normalbereich steht (Details beim Überfahren des Felds). Im Livebild misst die App
   laufend mit denselben Eckpunkten weiter, solange die Karten nicht bewegt werden.
2. **Tab Farbkarten: Farbkorrektur.** Referenzwerte der Karten laden (mitgelieferter Satz oder eigene JSON-/CSV-Datei, bleiben lokal im
   Browser), beide Farbkarten ruhig in die Rahmen halten (die App erkennt sie und nimmt selbst auf). Die Korrektur wird automatisch berechnet und bei jeder Änderung der Eckpunkte neu. Ein Wischer neben dem Bild zeigt die beiden Karten untereinander: links vom Strich stehen die Farben der Kamera, rechts die korrigierten (den Strich kannst du ziehen oder mit den Pfeiltasten verschieben); darunter steht die mittlere Abweichung vorher und nachher. Ohne Messung stehen dort die Sollfarben des Referenzsatzes, ohne Referenz ein neutrales Grau. Der Bericht zeigt
   den Farbfehler (ΔE2000) je Feld vorher und nachher; er erscheint als Popup, wenn du das Etikett unter dem Wischer überfährst oder fokussierst.
3. **Tab Vorschau.** Das Kamerabild mit der berechneten Korrektur ansehen (dort gibt es auch einen Knopf „Standbild aufnehmen“, das Bild gehört nur zu diesem Tab; danach schaltet die App die Kamera aus, ein neuer Kamerastart zeigt wieder das Livebild): derselbe Wischer wie in Schritt 2 (Strich im Bild ziehen oder mit den Pfeiltasten verschieben) zeigt links das Original und rechts das korrigierte Bild. Neben dem Bild zeigt eine Spalte zuerst die 36 bunten Felder (jedes Feld in drei Streifen: Soll, Kamera, korrigiert) mit den drei Feldern der größten Rest-Abweichung; ein Umschalter wechselt auf die Graustufen (Graukeil aus den Neutralfeldern, darunter je Tonbereich, wie viel heller die Korrektur macht und welche Farbe sie stärker oder schwächer macht). Unten steht die mittlere Abweichung vorher und nachher.
4. **Tab Export.** Die Korrektur als 3D-LUT im Format `.cube` herunterladen (Größe 17³, 33³ oder 65³). Die
   Korrektur wird immer voll eingerechnet. Welche Größe dein Gerät annimmt, steht in
   dessen Handbuch.

Ohne WebGL2 zeichnet die Vorschau in einer verkleinerten Software-Darstellung; im Tab steht, welche Darstellung aktiv ist.

Im Tab Export sichern **Projekt speichern** und **Projekt laden** den Arbeitsstand als JSON-Datei
(Eckpunkte, Messwerte, Korrekturmodell, Vorschau-Einstellungen). Mit dem Haken „Standbilder mitspeichern“
(voreingestellt) liegen auch die Standbilder der Tabs in der Datei; die Datei enthält dann Kamerabilder.
Beim Laden kommen Eckpunkte und Standbilder zurück und die Kamera wird ausgeschaltet. Referenzwerte stehen
nicht in der Datei, nur der Name des gewählten Satzes.

Wichtig für brauchbare Ergebnisse: Auto-Belichtung und Auto-Weißabgleich der Kamera vorher in der
Kamera-Software festsetzen. Die App kann das nicht selbst tun und zeigt dazu einen Hinweis.

## Referenzwerte der Karten

Das Repo enthält neben dem Layout (Position der Felder) einen Referenzsatz mit den Lab-Werten der 48
Farbfelder (`src/data/reference/`). Er ist **keine Herstellerdatei**: Datacolor veröffentlicht die Werte
nicht in maschinenlesbarer Form. Der Satz ist eine inoffizielle Transkription aus dem Blogbeitrag
[Patch color definitions for Datacolor SpyderCheckr 48](https://www.bartneck.de/2017/10/24/patch-color-definitions-for-datacolor-spydercheckr-48/)
(bartneck.de). Der Beitrag nennt selbst Tippfehler bei einigen Feldern, sie sind in der Datei
korrigiert. Ob die Werte genau zur eigenen Karte passen (Charge, Alterung), ist nicht belegt.

Der mitgelieferte Satz wird beim Start immer geladen und ist vorgewählt. Im Zahnrad-Menü ⚙ oben rechts wechselst du den Satz oder importierst eine eigene Datei. Die App
speichert den Satz ausschließlich lokal im Browser (IndexedDB) und sendet nie etwas irgendwohin. Mit
**Satz herunterladen** sicherst du den aktiven Satz als JSON-Datei, die sich später wieder importieren
lässt. Der Ordner `local-data/` ist in der `.gitignore` ausgeschlossen, falls du eigene Dateien
ablegen willst.

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

### Arbeitsablauf

`main` ist geschützt: Änderungen kommen über Pull Requests, die CI (`verify` und `acceptance`) muss grün
sein, und der Titel des Pull Requests ist ein Conventional-Commit-Titel (Squash-Merge). Details stehen in
[CONTRIBUTING.md](CONTRIBUTING.md).

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

[MIT](LICENSE). Die Lizenz gilt für den Quellcode. Der mitgelieferte Referenzsatz stammt aus einer fremden, inoffiziellen
Quelle (siehe oben) und fällt nicht unter diese Lizenz.
