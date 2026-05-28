export function getConfig() {
  const sentryToken = process.env.SENTRY_AUTH_TOKEN || '';
  const sentryOrg = process.env.SENTRY_ORG || '';

  return {
    sonarUrl: normalizeUrl(process.env.SONARQUBE_URL || 'http://localhost:9000'),
    sonarToken: process.env.SONARQUBE_TOKEN || '',
    sentryUrl: normalizeUrl(process.env.SENTRY_URL || 'https://sentry.io'),
    sentryToken,
    sentryOrg,
    sentryProject: process.env.SENTRY_PROJECT || '',
    sentryDefaultQuery: process.env.SENTRY_DEFAULT_QUERY || 'is:unresolved',
    sentryEnabled: Boolean(sentryToken && sentryOrg),
    transport: process.env.MCP_TRANSPORT || 'stdio',
    httpPort: Number(process.env.HTTP_PORT || 3030),
    defaultPageSize: Number(process.env.DEFAULT_PAGE_SIZE || 50),
    sourceContextLines: Number(process.env.SOURCE_CONTEXT_LINES || 8)
  };
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, '');
}
