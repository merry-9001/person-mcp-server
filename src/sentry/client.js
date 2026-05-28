export class SentryClient {
  constructor(config) {
    this.baseUrl = config.sentryUrl;
    this.token = config.sentryToken;
    this.org = config.sentryOrg;
  }

  get enabled() {
    return Boolean(this.token && this.org);
  }

  orgPath(suffix = '') {
    return `/api/0/organizations/${encodeURIComponent(this.org)}${suffix}`;
  }

  async get(path, params = {}) {
    return this.request('GET', path, params);
  }

  async request(method, path, params = {}) {
    if (!this.enabled) {
      throw new Error(
        'Sentry is not configured. Set SENTRY_AUTH_TOKEN and SENTRY_ORG (and optionally SENTRY_URL).'
      );
    }

    const url = new URL(`${this.baseUrl}${path}`);
    const init = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json'
      }
    };

    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    for (const [key, value] of Object.entries(cleanParams)) {
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }

    const response = await fetch(url, init);
    const text = await response.text();
    const body = parseBody(text);

    if (!response.ok) {
      const detail = body?.detail || body?.error || response.statusText;
      throw new Error(`Sentry ${method} ${path} failed: ${response.status} ${detail}`);
    }

    return body;
  }
}

function parseBody(text) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
