# Mitarbeit und Arbeitsablauf

Der Branch `main` ist geschützt: Änderungen kommen **nur über Pull Requests** hinein, und die beiden
Prüfungen `verify` und `acceptance` der CI müssen grün sein.

## Ablauf einer Änderung

1. Aktuellen Stand holen und einen Branch anlegen, zum Beispiel:

   ```bash
   git switch main
   git pull
   git switch -c feat/kurze-beschreibung
   ```

2. Ändern und committen. Die Commit-Nachrichten folgen
   [Conventional Commits](https://www.conventionalcommits.org/de/v1.0.0/) (`feat:`, `fix:`, `docs:`,
   `test:`, `chore:` …); die Zeilen der Nachricht sind höchstens 100 Zeichen lang. Die Hooks prüfen
   Format, Lint und Tests.
3. Den Branch pushen und einen Pull Request gegen `main` öffnen:

   ```bash
   git push -u origin feat/kurze-beschreibung
   ```

   GitHub zeigt in der Ausgabe einen Link zum Anlegen des Pull Requests.

4. Warten, bis die CI grün ist (`verify` und `acceptance`).
5. Zusammenführen: bisher mit **„Create a merge commit“**, **„Squash and merge“** ist ebenfalls erlaubt.
   Changelog und Version (release-please) lesen die Commits auf `main`. Bei einem Merge-Commit sind das
   die Commits des Branches, bei Squash der Titel des Pull Requests. In beiden Fällen müssen sie
   gültige Conventional Commits sein, zum Beispiel `feat(ui): neue Helligkeitsskala`.
   Zwischenstände vor dem Pull Request zu einem Commit zusammenfassen, damit der Changelog lesbar bleibt.

## Prüfungen lokal ausführen

```bash
npm run verify      # Lint, Typecheck, knip, Unit-Tests mit Coverage (mindestens 99 %)
npm run verify:all  # zusätzlich die Playwright-Akzeptanztests (Chrome und Firefox)
```

Der `pre-push`-Hook startet `npm run verify` und verhindert direkte Pushes auf `main`.

## Qualitätsanforderungen

- Neue Logik braucht Unit-Tests; die Coverage-Schwelle von 99 % gilt für alle Metriken.
- Neues Verhalten der Oberfläche braucht ein Akzeptanzszenario in `e2e/`.
- Lint und Typprüfung laufen ohne Warnungen.
- Die Referenzwerte der Karten (Herstellerdaten) gehören nie ins Repo. Testdaten sind erfunden.
- Bilddateien werden nicht eingecheckt.
