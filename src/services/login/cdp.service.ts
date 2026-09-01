/**
 * ------------------------------------------------------------------
 * CDP Service
 * ------------------------------------------------------------------
 * Service quản lý Chrome DevTools Protocol (CDP) connection.
 * Hỗ trợ launch browser, connect WebSocket, và intercept network events.
 *
 * Main functions:
 * - launchBrowser()   : Khởi động browser với debug port
 * - connect()         : Kết nối CDP tới browser
 * - send()            : Gửi command qua CDP
 * - evaluate()        : Evaluate JavaScript trong page
 * - navigate()        : Điều hướng tới URL
 * - close()           : Đóng browser và WebSocket
 * - getResponseBody() : Lấy response body của request
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { findAvailablePort } from '../../utils/net';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CDPService');

// ─── Helpers ────────────────────────────────────────────────────────────

function findBrowserExecutable(): string {
  if (process.platform === 'win32') {
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const progFilesX86 =
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData =
      process.env['LocalAppData'] ||
      (process.env['USERPROFILE']
        ? path.join(process.env['USERPROFILE'], 'AppData', 'Local')
        : '');

    const candidates = [
      path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(
        progFiles,
        'BraveSoftware',
        'Brave-Browser',
        'Application',
        'brave.exe',
      ),
      path.join(
        progFilesX86,
        'BraveSoftware',
        'Brave-Browser',
        'Application',
        'brave.exe',
      ),
      path.join(
        localAppData,
        'BraveSoftware',
        'Brave-Browser',
        'Application',
        'brave.exe',
      ),
      path.join(progFiles, 'Chromium', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];

    for (const cand of candidates) {
      if (cand && fs.existsSync(cand)) {
        return cand;
      }
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
  }

  const browsers = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'microsoft-edge',
    'brave-browser',
  ];
  for (const b of browsers) {
    try {
      execSync(`which ${b}`, { stdio: 'ignore' });
      return b;
    } catch {
      continue;
    }
  }

  return '';
}

// ─── Types ──────────────────────────────────────────────────────────────

interface CdpRequest {
  id: number;
  method: string;
  params?: any;
  sessionId?: string;
}

// ─── Class ──────────────────────────────────────────────────────────────

export class CDPService extends EventEmitter {
  private ws: WebSocket | null = null;
  private browserProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();
  private isConnected = false;
  private debugPort = 0;
  private sessionId: string | null = null;
  private profileName: string;

  constructor(profileName: string = 'elara-cdp') {
    super();
    this.profileName = profileName;
  }

  // ─── Launch ───────────────────────────────────────────────────────────

  async launchBrowser(
    url: string,
    customUserDataDir?: string,
    extensionPath?: string,
  ): Promise<boolean> {
    const debugPort = await findAvailablePort(9222);
    this.debugPort = debugPort;

    const executable = findBrowserExecutable();
    if (!executable) {
      logger.error('[CDP] No browser found on system');
      return false;
    }

    let userDataDir = customUserDataDir;
    if (!userDataDir) {
      userDataDir = path.join(
        os.tmpdir(),
        `elara-cdp-${this.profileName}-${Date.now()}`,
      );
    }

    fs.mkdirSync(userDataDir, { recursive: true });

    const args = [
      `--remote-debugging-port=${debugPort}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`,
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--ignore-certificate-errors',
    ];

    if (extensionPath) {
      args.push(`--disable-extensions-except=${extensionPath}`);
      args.push(`--load-extension=${extensionPath}`);
    }

    args.push(url);

    this.browserProcess = spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
    });

    this.browserProcess.on('exit', (code) => {
      this.isConnected = false;
      this.ws = null;
      this.emit('browser-exit');
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await this.connect(debugPort);
  }

  // ─── Connect ─────────────────────────────────────────────────────────

  async connect(port: number, retries = 5, delay = 1000): Promise<boolean> {
    try {
      const targetsResponse = await fetch(`http://127.0.0.1:${port}/json`);
      if (!targetsResponse.ok)
        throw new Error(`HTTP ${targetsResponse.status}`);

      const targets = (await targetsResponse.json()) as any[];

      let pageTarget = targets.find(
        (t: any) =>
          t.type === 'page' && t.url && !t.url.startsWith('devtools://'),
      );

      if (!pageTarget) {
        pageTarget = targets.find((t: any) => t.type === 'page');
      }

      if (!pageTarget) {
        const versionResponse = await fetch(
          `http://127.0.0.1:${port}/json/version`,
        );
        if (!versionResponse.ok)
          throw new Error(`HTTP ${versionResponse.status}`);
        const versionData = (await versionResponse.json()) as any;
        const browserWsUrl = versionData.webSocketDebuggerUrl;
        if (!browserWsUrl) throw new Error('No webSocketDebuggerUrl found');
        return await this.connectToBrowserAndCreatePage(browserWsUrl);
      }

      const wsUrl = pageTarget.webSocketDebuggerUrl;
      return await this.connectToPage(wsUrl);
    } catch (error) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        return this.connect(port, retries - 1, delay);
      }
      logger.error('[CDP] Connection failed after retries:', error);
      return false;
    }
  }

  private async connectToPage(wsUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', async () => {
        this.isConnected = true;
        try {
          await this.send('Network.enable', {
            maxTotalBufferSize: 10000000,
            maxResourceBufferSize: 5000000,
            maxPostDataSize: 5000000,
          });
          await this.send('Runtime.enable');
        } catch (e: any) {
          logger.error('[CDP] Failed to initialize domains:', e?.message || e);
        }
        resolve(true);
      });

      this.ws.on('message', (data: { toString: () => string }) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (err: any) => {
        logger.error('[CDP] WebSocket error:', err);
        if (!this.isConnected) resolve(false);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.ws = null;
      });
    });
  }

  private async connectToBrowserAndCreatePage(
    browserWsUrl: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const browserWs = new WebSocket(browserWsUrl);

      browserWs.on('open', () => {
        const createTargetMsg = JSON.stringify({
          id: 1,
          method: 'Target.createTarget',
          params: { url: 'about:blank' },
        });
        browserWs.send(createTargetMsg);
      });

      browserWs.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id === 1 && msg.result?.targetId) {
            const attachMsg = JSON.stringify({
              id: 2,
              method: 'Target.attachToTarget',
              params: { targetId: msg.result.targetId, flatten: true },
            });
            browserWs.send(attachMsg);
          } else if (msg.id === 2 && msg.result?.sessionId) {
            this.sessionId = msg.result.sessionId;
            this.ws = browserWs;
            this.isConnected = true;
            const enableMsg = JSON.stringify({
              id: 3,
              method: 'Network.enable',
              sessionId: this.sessionId,
            });
            browserWs.send(enableMsg);
            resolve(true);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      browserWs.on('error', (err: any) => {
        logger.error('[CDP] Browser WebSocket error:', err);
        resolve(false);
      });

      browserWs.on('close', () => {
        this.isConnected = false;
        if (this.ws === browserWs) this.ws = null;
        resolve(false);
      });
    });
  }

  // ─── Send Command ────────────────────────────────────────────────────

  private send(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      const request: CdpRequest = { id, method, params };
      if (this.sessionId) {
        request.sessionId = this.sessionId;
      }
      this.ws.send(JSON.stringify(request));
    });
  }

  // ─── Message Handler ─────────────────────────────────────────────────

  private handleMessage(message: string) {
    try {
      const data = JSON.parse(message);

      if (data.id && this.pendingRequests.has(data.id)) {
        const { resolve, reject } = this.pendingRequests.get(data.id)!;
        this.pendingRequests.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
        return;
      }

      if (data.method) {
        this.emit(data.method, data.params);
        this.handleNetworkEvent(data.method, data.params);
      }
    } catch (e) {
      logger.error('[CDP] Error handling message:', e);
    }
  }

  private handleNetworkEvent(method: string, params: any) {
    switch (method) {
      case 'Network.requestWillBeSent':
        this.emit('request', {
          id: params.requestId,
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers,
          postData: params.request.postData,
        });
        break;
      case 'Network.responseReceived':
        this.emit('response', {
          id: params.requestId,
          statusCode: params.response.status,
          headers: params.response.headers,
          mimeType: params.response.mimeType,
        });
        break;
      case 'Network.loadingFinished':
        this.getResponseBody(params.requestId);
        break;
    }
  }

  private async getResponseBody(requestId: string) {
    try {
      const result = await this.send('Network.getResponseBody', { requestId });
      this.emit('response-body', {
        id: requestId,
        body: result.body,
        isBinary: result.base64Encoded,
      });
    } catch (e: any) {}
  }

  // ─── Public Methods ──────────────────────────────────────────────────

  async evaluate(expression: string): Promise<any> {
    const result = await this.send('Runtime.evaluate', { expression });
    return result.result?.value;
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  async close(): Promise<void> {
    if (this.browserProcess) {
      this.browserProcess.kill();
      this.browserProcess = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isConnectedToBrowser(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const createCDPService = (profileName: string) =>
  new CDPService(profileName);
