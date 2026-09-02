/**
 * ------------------------------------------------------------------
 * Cookie Jar
 * ------------------------------------------------------------------
 * Wrapper cho tough-cookie để quản lý cookies trong các request.
 *
 * Main functions:
 * - setCookie()      : Thêm cookie từ Set-Cookie header
 * - getCookieString(): Lấy cookies dạng string cho Cookie header
 * - getCookies()     : Lấy danh sách cookies
 * - clear()          : Xóa tất cả cookies
 * - toJSON()         : Serialize cookies thành JSON
 * - fromJSON()       : Deserialize từ JSON
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Cookie, CookieJar as ToughCookieJar } from 'tough-cookie';

// ─── Class ──────────────────────────────────────────────────────────────

export class CookieJar {
  private jar: ToughCookieJar;

  constructor() {
    this.jar = new ToughCookieJar();
  }

  // ─── Set Cookie ──────────────────────────────────────────────────────

  setCookie(cookieStr: string, url: string): void {
    try {
      this.jar.setCookieSync(cookieStr, url);
    } catch (error) {
      // Ignore invalid cookies
    }
  }

  // ─── Get Cookies ─────────────────────────────────────────────────────

  getCookieString(url: string): string {
    try {
      return this.jar.getCookieStringSync(url);
    } catch (error) {
      return '';
    }
  }

  getCookies(url: string): Cookie[] {
    try {
      return this.jar.getCookiesSync(url);
    } catch (error) {
      return [];
    }
  }

  // ─── Clear ───────────────────────────────────────────────────────────

  clear(): void {
    this.jar.removeAllCookiesSync();
  }

  // ─── Serialization ──────────────────────────────────────────────────

  toJSON(): any {
    return this.jar.toJSON();
  }

  static fromJSON(json: any): CookieJar {
    const jar = new CookieJar();
    jar.jar = ToughCookieJar.fromJSON(json);
    return jar;
  }
}