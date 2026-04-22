export function getConfig() {
  return {
    sonarUrl: normalizeUrl(process.env.SONARQUBE_URL || 'http://localhost:9000'),
    sonarToken: process.env.SONARQUBE_TOKEN || '',
    transport: process.env.MCP_TRANSPORT || 'stdio',
    httpPort: Number(process.env.HTTP_PORT || 3030),
    defaultPageSize: Number(process.env.DEFAULT_PAGE_SIZE || 50),
    sourceContextLines: Number(process.env.SOURCE_CONTEXT_LINES || 8)
  };
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, '');
}
