import http from 'http';
import https from 'https';
import url from 'url';

// Use dynamic import for node-fetch to support ESM in CJS context
const fetch = async (url: any, init?: any) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, init);
};

export const CLIENT_ID =
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
export const CLIENT_SECRET = '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';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
// Updated to Production environment as per Antigravity-Manager
export const BASE_URL = 'https://cloudcode-pa.googleapis.com';

// Force IPv4 to avoid EHOSTUNREACH on IPv6
export const httpsAgent = new https.Agent({ family: 4 });

export class AntigravityAuthServer {
  private server: http.Server | null = null;
  private port = 0;

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((_req, res) => {
        // We'll handle callbacks elsewhere or here if needed,
        // but for now this is just to reserve a port and show success.
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<h1>Login Successful!</h1><p>You can close this window and return to the app.</p>',
        );
      });

      this.server.on('error', (err) => reject(err));

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          const redirectUri = `http://127.0.0.1:${this.port}/callback`;

          const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: [
              'https://www.googleapis.com/auth/cloud-platform',
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
              'https://www.googleapis.com/auth/cclog',
              'https://www.googleapis.com/auth/experimentsandconfigs',
            ].join(' '),
            access_type: 'offline',
            prompt: 'consent',
          });

          resolve(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  async waitForCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return reject(new Error('Server not started'));
      }

      const requestListener = (req: http.IncomingMessage, _res: http.ServerResponse) => {
        if (req.url?.startsWith('/callback')) {
          const query = url.parse(req.url, true).query;
          if (query.code) {
            resolve(query.code as string);
          } else {
            reject(new Error('No code found in callback'));
          }
        }
      };

      this.server.on('request', requestListener);
    });
  }

  async exchangeCode(code: string): Promise<any> {
    const redirectUri = `http://127.0.0.1:${this.port}/callback`;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      agent: httpsAgent,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    return await res.json();
  }

  async getUserInfo(accessToken: string): Promise<any> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      agent: httpsAgent,
    });
    if (!res.ok) throw new Error('Failed to fetch user info');
    return await res.json();
  }

  static async refreshAccessToken(refreshToken: string): Promise<any> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      agent: httpsAgent,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed: ${text}`);
    }
    return await res.json();
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
