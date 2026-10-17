export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot schreibt "Bump …" großgeschrieben und mit langen Release-Notes; die Meldungen
  // lassen sich nicht anpassen und werden hier nicht geprüft.
  ignores: [(message) => message.includes('Signed-off-by: dependabot[bot]')],
};
