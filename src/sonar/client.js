export class SonarClient {
  constructor(config) {
    this.baseUrl = config.sonarUrl;
    this.token = config.sonarToken;
  }

  async get(path, params = {}) {
    return this.request('GET', path, params);
  }

  async post(path, params = {}) {
    return this.request('POST', path, params);
  }

  async request(method, path, params = {}) {
    if (!this.token) {
      throw new Error('SONARQUBE_TOKEN is required.');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    const init = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    };

    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    if (method === 'GET') {
      for (const [key, value] of Object.entries(cleanParams)) {
        url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
      }
    } else {
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(
        Object.entries(cleanParams).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)])
      );
    }

    const response = await fetch(url, init);
    const text = await response.text();
    const body = parseBody(text);

    if (!response.ok) {
      const message = body?.errors?.map((error) => error.msg).join('; ') || response.statusText;
      throw new Error(`SonarQube ${method} ${path} failed: ${response.status} ${message}`);
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
