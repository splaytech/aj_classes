// A stand-in for Zoho's Australian sign-in and Zoho CRM APIs, for the local `leads` test only.
// The local edge runtime reaches it at host.docker.internal:55398 (supabase/config.toml).

import { createServer } from 'node:http';

export const FAKE_ZOHO_PORT = 55398;
export const FAKE_ACCESS_TOKEN = 'fake-access-token';

/** Starts the fake. `failLeads` makes lead writes fail the way Zoho CRM reports it (207). */
export async function startFakeZoho() {
  const requests = [];
  const state = { failLeads: false, nextId: 1 };

  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const json = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      raw,
      json,
    });

    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (request.url === '/oauth/v2/token') {
      const form = new URLSearchParams(raw);
      if (
        form.get('grant_type') !== 'refresh_token' ||
        form.get('refresh_token') !== 'local-refresh'
      ) {
        return send(200, { error: 'invalid_code' }); // Zoho answers this with 200
      }
      // A non-Zoho api_domain must be ignored by the function (it falls back to ZOHO_API_URL).
      return send(200, {
        access_token: FAKE_ACCESS_TOKEN,
        api_domain: 'https://evil.example',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }
    if (request.headers.authorization !== `Zoho-oauthtoken ${FAKE_ACCESS_TOKEN}`) {
      return send(401, { code: 'INVALID_TOKEN', status: 'error', message: 'invalid oauth token' });
    }
    if (request.url === '/crm/v8/Leads/upsert') {
      if (state.failLeads) {
        return send(207, {
          data: [{ code: 'INVALID_DATA', status: 'error', message: 'invalid data', details: {} }],
        });
      }
      const id = String(9000000000 + state.nextId++);
      return send(201, {
        data: [
          {
            code: 'SUCCESS',
            status: 'success',
            action: 'insert',
            message: 'record added',
            details: { id },
          },
        ],
      });
    }
    return send(404, { code: 'NOT_FOUND', status: 'error' });
  });

  await new Promise((resolve) => server.listen(FAKE_ZOHO_PORT, '0.0.0.0', resolve));
  return {
    requests,
    setFailLeads: (value) => {
      state.failLeads = value;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
