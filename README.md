# cam_gradr

[![CI](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml/badge.svg)](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)

**LUT-Generator für die Datacolor Spyder Checkr Photo.** Du hältst die Karten vor deine Webcam, die App
stellt mit dir die Raumhelligkeit ein und berechnet daraus eine 3D-LUT, die die Farbwiedergabe der Webcam
korrigiert. Die LUT lädst du als `.cube`-Datei herunter, zum Beispiel für einen Kameramonitor oder eine
Videosoftware.

**App öffnen: <https://avalax.github.io/cam_gradr/>**

Alles läuft in deinem Browser. Es gibt kein Backend: Bilder und Messwerte verlassen deinen Rechner nicht.

## Das brauchst du

- eine Webcam und die **Datacolor Spyder Checkr Photo** (die beiden Kartenpaare mit den Graufeldern und
  den 48 Farbfeldern)
- einen aktuellen Browser (Chrome oder Firefox); die Kamera funktioniert nur über HTTPS, die Seite oben
  erfüllt das
- gleichmäßiges Licht auf den Karten, ohne Spiegelungen und ohne Schatten

## So gehst du vor

1. **Kamera vorbereiten.** Stelle Auto-Belichtung und Auto-Weißabgleich der Kamera in ihrer Software fest.
   Die App kann das nicht selbst tun, automatische Anpassungen verfälschen die Messung. Danach schaltest du
   oben rechts die Kamera ein (grün „Kamera starten“, rot „Kamera stoppen“). Kamera und Auflösung wählst du
   im Zahnrad-Menü ⚙.
2. **Tab Graukarten: Licht einstellen.** Halte beide Graukarten ruhig in die gestrichelten Rahmen. Die App
   erkennt sie selbst, nimmt ein Standbild auf und schaltet die Kamera aus. Im Messfeld rechts zeigt ein
   Punkt Helligkeit (senkrecht) und Kontrast (waagerecht). Steht er im umrahmten Fenster in der Mitte, passt
   das Licht; sonst nennt das Feld, was du ändern sollst (Details beim Überfahren). Ändere das Licht oder
   die Kamera und schalte die Kamera wieder ein, bis der Punkt im Normalbereich steht.
3. **Tab Farbkarten: Korrektur berechnen.** Halte beide Farbkarten ruhig in die Rahmen. Die Korrektur wird
   automatisch berechnet. Der Wischer rechts zeigt links die Farben deiner Kamera und rechts die korrigierten
   (ziehe den Strich oder nutze die Pfeiltasten). Das Etikett darunter nennt die mittlere Abweichung vorher
   und nachher; wenn du es überfährst, erscheint das Ergebnis je Farbfeld.
4. **Tab Vorschau: Ergebnis prüfen.** Dein Kamerabild mit der Korrektur: links das Original, rechts das
   korrigierte Bild. Die Seitenspalte zeigt jedes Farbfeld als Soll, Kamera und korrigiert und nennt die
   Felder mit der größten Rest-Abweichung; ein Umschalter wechselt auf die Graustufen. Mit „Standbild
   aufnehmen“ prüfst du die Korrektur an einem ruhigen Bild.
5. **Tab Export: LUT herunterladen.** Wähle die Größe (17³, 33³ oder 65³) und lade die `.cube`-Datei
   herunter. Welche Größe dein Gerät annimmt, steht in dessen Handbuch; größere LUTs sind genauer, manche
   Geräte nehmen nur 17³ oder 33³. Die Korrektur wird immer voll eingerechnet.

Die vier Tabs lassen sich jederzeit frei anwählen. Unter jedem Tab-Namen steht kurz das Ergebnis, bei
Graukarten und Farbkarten dazu eine kleine Skala aus vier Strichen: leer = noch nichts, grün = gut (Licht
im Normalbereich bzw. mittlere Abweichung nach der Korrektur höchstens 2), gelb = Hinweis.

### Neu suchen und Eckpunkte anpassen

- Mit dem Papierkorb in der Bildecke („Eckpunkte löschen“) verwirfst du Standbild und Eckpunkte und die
  Suche beginnt von vorn.
- Ein Kamerastart beginnt ebenfalls eine neue Suche; endet die Kamera ohne neues Standbild, kehren das alte
  Bild und seine Eckpunkte zurück. Gemessen wird immer nur auf Standbildern.
- Die Eckpunkte auf dem Standbild lassen sich ziehen. Die Karten dürfen auch um 180° gedreht gehalten
  werden; die App erkennt das an den Streifenfeldern.

### Projekt speichern und laden

Im Tab Export sichern **Projekt speichern** und **Projekt laden** deinen Arbeitsstand als JSON-Datei
(Messwerte, Korrekturmodell, Einstellungen der Vorschau). Mit dem Haken „Standbilder mitspeichern“
(voreingestellt) liegen auch die Standbilder der Tabs und ihre Eckpunkte in der Datei. Dann kommen beim
Laden Bilder und Eckpunkte zurück und die Kamera wird ausgeschaltet. Ohne Standbilder werden auch keine
Eckpunkte gespeichert. Die Referenzwerte stehen nicht in der Datei, nur der Name des gewählten Satzes.

## Tipps für gute Ergebnisse

- Halte die Karten ruhig und parallel zur Kamera; verwackelte Aufnahmen erkennt die App nicht.
- Beleuchte beide Kartenpaare gleich. Eine Lampe von der Seite oder Spiegelungen auf den Karten verfälschen
  die Farben.
- Die hellsten Graufelder dürfen nicht ausbrennen und die dunkelsten nicht absaufen. Zeigt das Messfeld
  „Helligkeit zu hoch“ oder „zu niedrig“, ändere zuerst die Helligkeit, danach den Kontrast.
- Verändere nach den Graukarten weder Licht noch Kameraeinstellungen, bevor du die Farbkarten aufnimmst.
- Die voreingestellte Auflösung von 1280 × 720 ist ein guter Start.

## Häufige Fragen

**Die Kamera startet nicht.** Erlaube den Zugriff auf die Kamera im Browser und schließe andere Programme,
die sie benutzen. Lokal funktioniert sie nur über `localhost` oder HTTPS.

**Die Karten werden nicht erkannt.** Halte sie komplett in die Rahmen, ruhig und gut beleuchtet. Die App
sucht jede Sekunde und nimmt auf, sobald sie die Karten zweimal hintereinander an derselben Stelle findet.

**Die Abweichung ist nach der Korrektur noch hoch.** Meist liegt es an der Aufnahme: ausgebrannte oder
abgesoffene Felder, ungleichmäßiges Licht oder Automatiken der Kamera. Prüfe zuerst die Hinweise im Ergebnis
und nimm die Karten bei besserem Licht neu auf.

**Welche Referenzwerte nutzt die App?** Sie bringt einen inoffiziellen Satz mit (siehe unten). Eigene
Werte importierst du im Zahnrad-Menü.

**Wo landen meine Daten?** Nur in deinem Browser. Importierte Referenzsätze liegen lokal in IndexedDB,
nichts wird gesendet. Eine Projektdatei mit Standbildern enthält Kamerabilder; gib sie nur weiter, wenn
das in Ordnung ist.

## Referenzwerte der Karten

Die App bringt einen Referenzsatz mit den Lab-Werten der 48 Farbfelder mit. Er ist **keine
Herstellerdatei**: Datacolor veröffentlicht die Werte nicht maschinenlesbar. Der Satz ist eine inoffizielle
Transkription aus dem Blogbeitrag
[Patch color definitions for Datacolor SpyderCheckr 48](https://www.bartneck.de/2017/10/24/patch-color-definitions-for-datacolor-spydercheckr-48/)
(bartneck.de). Der Beitrag nennt selbst Tippfehler bei einigen Feldern, sie sind in der Datei korrigiert.
Ob die Werte genau zu deiner Karte passen (Charge, Alterung), ist nicht belegt.

Im Zahnrad-Menü ⚙ unter „Referenzwerte“ wechselst du den Satz oder importierst eine eigene Datei. Mit
**Satz herunterladen** sicherst du den aktiven Satz als JSON-Datei, die sich wieder importieren lässt.

Unterstützte Formate (Lab-Werte mit Weißpunkt D50, je Feld-ID wie `1A` bis `6H`; Ziffer = Reihe,
Buchstabe = Spalte, Karte 1 = Spalten A–D, Karte 2 = Spalten E–H):

- **JSON:** `{ "format": "cam_gradr-reference/1", "name": "Mein Satz", "illuminant": "D50",
"patches": [{ "id": "1A", "lab": [L, a, b] }, …] }`
- **CSV:** Spalten `id; L; a; b` (Trennzeichen Semikolon, Tabulator oder Komma, optionale Kopfzeile,
  bei Semikolon auch Dezimalkomma).

Es müssen mindestens 12 Felder enthalten sein, davon mindestens 4 Neutralfelder (Grauleitern, Spalten D
und E). Gespeicherte Sätze lassen sich in der App auswählen und löschen.

## Bekannte Grenzen

- Die Feldpositionen im Layout und die Schwellen der Helligkeitsbewertung stammen aus Fotos der Karten
  und sind nicht an jeder Karte geprüft.
- Das Korrekturmodell (Kurven je Kanal plus 3×3-Matrix) gleicht eine stark verfälschende Webcam nur zum
  Teil aus; eine gute Aufnahme ist wichtiger als ein stärkeres Modell.
- Ohne WebGL2 zeichnet die Vorschau in einer verkleinerten Software-Darstellung.

## Für Entwickler

Voraussetzung ist Node.js 22 (siehe `.nvmrc`).

```bash
npm ci               # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver starten
npm run build        # Produktions-Build
npm run verify       # alle Prüfungen (Lint, Typecheck, knip, Tests mit Coverage)
npm run e2e:install  # einmalig: Firefox für die Akzeptanztests installieren (Chrome muss vorhanden sein)
npm run e2e          # Playwright-Akzeptanztests (baut die App und startet sie)
npm run verify:all   # verify und e2e zusammen
```

Arbeitsablauf, Qualitätsanforderungen, Technik und Releases stehen in [CONTRIBUTING.md](CONTRIBUTING.md),
der Plan und die Entscheidungen in [PLAN.md](PLAN.md), die Änderungen in [CHANGELOG.md](CHANGELOG.md).

## Lizenz

[MIT](LICENSE). Die Lizenz gilt für den Quellcode. Der mitgelieferte Referenzsatz stammt aus einer
fremden, inoffiziellen Quelle (siehe oben) und fällt nicht unter diese Lizenz.
