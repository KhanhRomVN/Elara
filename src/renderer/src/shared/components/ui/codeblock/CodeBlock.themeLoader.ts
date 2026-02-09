import { CodeBlockThemeData } from './CodeBlock.types';

/**
 * Simple Theme Loader - Chỉ load theme từ folder path
 */
export class CodeBlockThemeLoader {
  private static loadedThemes: Map<string, CodeBlockThemeData> = new Map();

  /**
   * Load theme từ folder path
   * @param folderPath - Path đến folder chứa themes (e.g., "/themes")
   * @param themeName - Tên theme = tên file (không có .json)
   */
  static async loadTheme(folderPath: string, themeName: string): Promise<CodeBlockThemeData> {
    // Check cache first
    const cacheKey = `${folderPath}/${themeName}`;
    if (this.loadedThemes.has(cacheKey)) {
      return this.loadedThemes.get(cacheKey)!;
    }

    try {
      // Normalize path (remove trailing slash)
      const normalizedPath = folderPath.replace(/\/$/, '');
      const themeUrl = `${normalizedPath}/${themeName}.json`;

      const response = await fetch(themeUrl);
      if (!response.ok) {
        throw new Error(`Failed to load theme: ${response.statusText}`);
      }

      const themeData: CodeBlockThemeData = await response.json();

      // Validate theme
      if (!this.validateTheme(themeData, themeName)) {
        throw new Error('Invalid theme structure');
      }

      // Cache theme
      this.loadedThemes.set(cacheKey, themeData);

      return themeData;
    } catch (error) {
      console.error(`Failed to load theme "${themeName}":`, error);
      throw error;
    }
  }

  /**
   * Validate theme structure
   * @param themeData - Theme data object
   * @param expectedName - Expected theme name (must match filename)
   */
  static validateTheme(themeData: CodeBlockThemeData, expectedName: string): boolean {
    // Check required fields
    if (!themeData.name || !themeData.type) {
      console.error('Theme missing required fields: name, type');
      return false;
    }

    // Check name matches filename (no spaces allowed)
    if (themeData.name !== expectedName) {
      console.error(`Theme name mismatch: expected "${expectedName}", got "${themeData.name}"`);
      return false;
    }

    // Check no spaces in theme name
    if (themeData.name.includes(' ')) {
      console.error(
        `Theme name cannot contain spaces: "${themeData.name}". Use camelCase or PascalCase instead.`,
      );
      return false;
    }

    if (!themeData.colors || typeof themeData.colors !== 'object') {
      console.error('Theme missing colors object');
      return false;
    }

    if (!Array.isArray(themeData.tokenColors)) {
      console.error('Theme missing tokenColors array');
      return false;
    }

    return true;
  }

  /**
   * Clear cache
   */
  static clearCache() {
    this.loadedThemes.clear();
  }

  /**
   * Get all loaded themes
   */
  static getLoadedThemes(): string[] {
    return Array.from(this.loadedThemes.keys());
  }
}
