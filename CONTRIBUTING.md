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
5. Mit **„Squash and merge“** zusammenführen. Der **Titel des Pull Requests** wird zur Commit-Nachricht
   auf `main` und steuert Changelog und Version (release-please). Er muss deshalb ein gültiger
   Conventional-Commit-Titel sein, zum Beispiel `feat(ui): neue Helligkeitsskala`; der Workflow
   `pr-title` prüft das. Ein normaler Merge-Commit würde im Changelog doppelte Einträge erzeugen
   (der Merge-Commit trägt den Titel des Pull Requests zusätzlich zu den Commits des Branches).

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
