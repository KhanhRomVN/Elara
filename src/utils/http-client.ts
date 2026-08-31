/**
 * ------------------------------------------------------------------
 * HTTP Client
 * ------------------------------------------------------------------
 * HTTP client wrapper xung quanh node-fetch với cookie support.
 * Hỗ trợ GET, POST, và SSE streaming.
 *
 * Main functions:
 * - request()   : Thực hiện HTTP request
 * - get()       : GET request
 * - post()      : POST request với JSON body
 * - streamSSE() : Stream Server-Sent Events
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import fetch, { RequestInit, Response } from 'node-fetch';

// ── Utils ──
import { CookieJar } from './cookie-jar';

// ─── Types ──────────────────────────────────────────────────────────────

export interface HttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  cookieJar?: CookieJar;
}

export interface RequestOptions extends RequestInit {
  url: string;
  params?: Record<string, string>;
}

// ─── Class ──────────────────────────────────────────────────────────────

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private cookieJar?: CookieJar;

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL || '';
    this.defaultHeaders = options.headers || {};
    this.cookieJar = options.cookieJar;
  }

  // ─── Request ─────────────────────────────────────────────────────────

  async request(options: RequestOptions): Promise<Response> {
    const { url, params, headers, ...fetchOptions } = options;

    let fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    if (params) {
      const queryString = new URLSearchParams(params).toString();
      fullURL += `?${queryString}`;
    }

    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(headers as Record<string, string>),
    };

    if (this.cookieJar) {
      const cookies = this.cookieJar.getCookieString(fullURL);
      if (cookies) {
        mergedHeaders['Cookie'] = cookies;
      }
    }

    const response = await fetch(fullURL, {
      ...fetchOptions,
      headers: mergedHeaders,
    });

    if (this.cookieJar) {
      const setCookie = response.headers.raw()['set-cookie'];
      if (setCookie) {
        setCookie.forEach((cookie) => {
          this.cookieJar!.setCookie(cookie, fullURL);
        });
      }
    }

    return response;
  }

  // ─── GET ─────────────────────────────────────────────────────────────

  async get(
    url: string,
    options: Omit<RequestOptions, 'url' | 'method'> = {},
  ): Promise<Response> {
    return this.request({ ...options, url, method: 'GET' });
  }

  // ─── POST ────────────────────────────────────────────────────────────

  async post(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'url' | 'method' | 'body'> = {},
  ): Promise<Response> {
    return this.request({
      ...options,
      url,
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  // ─── SSE Stream ─────────────────────────────────────────────────────

  async *streamSSE(
    url: string,
    options: Omit<RequestOptions, 'url'> = {},
  ): AsyncGenerator<string, void, unknown> {
    const response = await this.request({
      ...options,
      url,
      headers: {
        Accept: 'text/event-stream',
        ...options.headers,
      },
    });

    if (!response.body) {
      throw new Error('No response body for SSE stream');
    }

    let buffer = '';

    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield line.substring(6);
        } else if (line.trim()) {
          yield line;
        }
      }
    }

    if (buffer.trim()) {
      yield buffer;
    }
  }
}