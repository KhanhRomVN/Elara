import http from 'http';
import { net } from 'electron';
import { parse } from 'url';

// Constants extracted from Antigravity-Manager
const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const AUTH_URL_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  scope?: string;
}

interface UserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export class AntigravityAuthServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private codePromise: Promise<string> | null = null;
  private codeResolve: ((code: string) => void) | null = null;
  private codeReject: ((reason: any) => void) | null = null;

  async start(): Promise<{ url: string; port: number }> {
    // 1. Find a free port (handled by node http server getting 0)
    // Actually we need to explicitly know the port to construct redirect_uri BEFORE starting potentially?
    // Node's listen(0) picks a random port, which we can then read.

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url || '', true);

          if (parsedUrl.pathname === '/oauth-callback') {
            const code = parsedUrl.query.code as string;

            if (code) {
              if (this.codeResolve) this.codeResolve(code);

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <html>
                  <body style='font-family: sans-serif; text-align: center; padding: 50px;'>
                    <h1 style='color: green;'>✅ Authorization Successful!</h1>
                    <p>You can close this window and return to the application.</p>
                    <script>setTimeout(function() { window.close(); }, 2000);</script>
                  </body>
                </html>
              `);

              // Close server after success
              // setTimeout(() => this.stop(), 1000);
              // Don't close immediately, wait for the caller to done?
              // Usually fine to close after receiving code.
            } else {
              if (this.codeReject) this.codeReject('No code found in callback');
              res.writeHead(400);
              res.end('Authorization failed: No code provided.');
            }
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } catch (e) {
          console.error('[Antigravity] Server Error:', e);
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address !== 'string') {
          this.port = address.port;
          const redirectUri = `http://127.0.0.1:${this.port}/oauth-callback`;

          const scopes = [
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/cclog',
            'https://www.googleapis.com/auth/experimentsandconfigs',
          ].join(' ');

          const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scopes,
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          });

          const url = `${AUTH_URL_BASE}?${params.toString()}`;

          // Setup the code promise
          this.codePromise = new Promise((res, rej) => {
            this.codeResolve = res;
            this.codeReject = rej;
          });

          resolve({ url, port: this.port });
        } else {
          reject(new Error('Failed to get server port'));
        }
      });
    });
  }

  async waitForCode(): Promise<string> {
    if (!this.codePromise) throw new Error('Server not started');
    return this.codePromise;
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const redirectUri = `http://127.0.0.1:${this.port}/oauth-callback`;

    // Electron's net module or node-fetch. Since we are in Main process, we can use net.
    // However, net is callback based or mostly for requests.
    // Using native fetch if available (Node 18+)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    return await response.json();
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch(USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json();
  }

  static async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${text}`);
    }

    return await response.json();
  }
}
