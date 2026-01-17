import { Cookie, CookieJar as ToughCookieJar } from 'tough-cookie';

/**
 * Simple cookie jar for managing cookies across requests
 */
export class CookieJar {
  private jar: ToughCookieJar;

  constructor() {
    this.jar = new ToughCookieJar();
  }

  /**
   * Set a cookie from Set-Cookie header
   */
  setCookie(cookieStr: string, url: string): void {
    try {
      this.jar.setCookieSync(cookieStr, url);
    } catch (error) {
      console.error('[CookieJar] Failed to set cookie:', error);
    }
  }

  /**
   * Get cookies as a string for Cookie header
   */
  getCookieString(url: string): string {
    try {
      return this.jar.getCookieStringSync(url);
    } catch (error) {
      console.error('[CookieJar] Failed to get cookies:', error);
      return '';
    }
  }

  /**
   * Get all cookies for a URL
   */
  getCookies(url: string): Cookie[] {
    try {
      return this.jar.getCookiesSync(url);
    } catch (error) {
      console.error('[CookieJar] Failed to get cookies:', error);
      return [];
    }
  }

  /**
   * Clear all cookies
   */
  clear(): void {
    this.jar.removeAllCookiesSync();
  }

  /**
   * Serialize cookies to JSON
   */
  toJSON(): any {
    return this.jar.toJSON();
  }

  /**
   * Load cookies from JSON
   */
  static fromJSON(json: any): CookieJar {
    const jar = new CookieJar();
    jar.jar = ToughCookieJar.fromJSON(json);
    return jar;
  }
}
