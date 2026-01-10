import { session } from 'electron';

export function setupSecurityHandlers() {
  const sessions = [session.defaultSession, session.fromPartition('persist:n8n_v2')];

  console.log('Setting up security handlers for: defaultSession, persist:n8n_v2');

  sessions.forEach((sess) => {
    sess.webRequest.onHeadersReceived(
      {
        urls: [
          'http://localhost:5678/*',
          'http://127.0.0.1:5678/*',
          'ws://localhost:5678/*',
          'ws://127.0.0.1:5678/*',
        ],
      },
      (details, callback) => {
        console.log(`[n8n Proxy] ${details.statusCode} ${details.url}`);

        const responseHeaders = { ...details.responseHeaders };

        // Aggressively remove all blocking headers
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['Content-Security-Policy'];
        delete responseHeaders['cross-origin-resource-policy'];
        delete responseHeaders['Cross-Origin-Resource-Policy'];

        callback({
          responseHeaders,
          statusLine: details.statusLine,
        });
      },
    );
  });
}
