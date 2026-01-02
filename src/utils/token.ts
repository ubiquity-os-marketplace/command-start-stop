export function isInstallationToken(token: string) {
  return token.startsWith("ghs_");
}
