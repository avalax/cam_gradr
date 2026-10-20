export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot writes "Bump …" capitalized and with long release notes; the messages
  // cannot be customized and are not checked here.
  ignores: [(message) => message.includes('Signed-off-by: dependabot[bot]')],
};
