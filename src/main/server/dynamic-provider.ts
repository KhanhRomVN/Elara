import { app, net } from 'electron';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import * as ProxyModule from './proxy';
// Import other common modules used by providers to inject them
import * as ChildProcess from 'child_process';
import * as Electron from 'electron';
import { getProxyConfig } from './config';

const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/src/main/server';
const PROVIDERS_DIR = path.join(app.getPath('userData'), 'providers');

// Ensure providers dir exists
if (!fs.existsSync(PROVIDERS_DIR)) {
  fs.mkdirSync(PROVIDERS_DIR, { recursive: true });
}

export class DynamicProviderManager {
  private static instance: DynamicProviderManager;
  private loadedProviders: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): DynamicProviderManager {
    if (!DynamicProviderManager.instance) {
      DynamicProviderManager.instance = new DynamicProviderManager();
    }
    return DynamicProviderManager.instance;
  }

  // Fallback map to built-in providers
  // We need a way to reference the original built-ins if dynamic load fails or isn't present.
  // We can pass them in or require them dynamically?
  // Circular dependency risk if we import them here.
  // Better approach: The caller (accounts.ts) calls getProvider.
  // If we return null, caller uses built-in.

  async fetchProvider(providerId: string): Promise<boolean> {
    const fileName = `${providerId.toLowerCase()}.ts`;
    const url = `${GITHUB_BASE_URL}/${fileName}`;

    try {
      const response = await net.fetch(url);
      if (response.ok) {
        const text = await response.text();
        const destPath = path.join(PROVIDERS_DIR, fileName);
        fs.writeFileSync(destPath, text);
        // Clear cache
        this.loadedProviders.delete(providerId);
        return true;
      }
    } catch (e) {
      console.error(`[DynamicProvider] Error fetching ${fileName}:`, e);
    }
    return false;
  }

  async updateAllProviders() {
    try {
      const config = getProxyConfig();
      const port = config.port || 11434;

      const response = await net.fetch(`http://localhost:${port}/v1/providers`);
      if (response.ok) {
        const json: any = await response.json();
        if (json.success && Array.isArray(json.data)) {
          console.log('[DynamicProvider] Fetching dynamic providers:', json.data.length);
          for (const p of json.data) {
            if (p.provider_id) {
              await this.fetchProvider(p.provider_id);
            }
          }
        }
      } else {
        console.error(`[DynamicProvider] Failed to fetch providers list: ${response.status}`);
      }
    } catch (error) {
      console.error('[DynamicProvider] Error updating providers:', error);
    }
  }

  getProvider(providerId: string, builtInProvider: any): any {
    // 1. Check if we have a loaded dynamic version
    if (this.loadedProviders.has(providerId)) {
      return this.loadedProviders.get(providerId);
    }

    // 2. Check if file exists in userData
    const fileName = `${providerId.toLowerCase()}.ts`;
    const filePath = path.join(PROVIDERS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const jsCode = this.stripTypes(code);

        const context = {
          require: (name: string) => {
            if (name === 'electron') return Electron;
            if (name === 'fs') return fs;
            if (name === 'path') return path;
            if (name === 'child_process') return ChildProcess;
            if (name === './proxy') return ProxyModule;
            // Add more as needed
            throw new Error(`Module '${name}' not allowed in dynamic provider`);
          },
          exports: {},
          console: console,
          module: { exports: {} },
          process: process,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          Buffer,
        };

        vm.runInNewContext(jsCode, context);

        // Assuming the provider exports functions directly on exports
        const moduleExports = (context.module.exports as any) || context.exports;

        this.loadedProviders.set(providerId, moduleExports);
        return moduleExports;
      } catch (e) {
        console.error(
          `[DynamicProvider] Failed to load dynamic ${providerId}, falling back to built-in. Error:`,
          e,
        );
      }
    }

    // 3. Return built-in
    return builtInProvider;
  }

  // Very basic type stripper - NOT ROBUST FOR ALL TS, but strict enough for our providers
  private stripTypes(tsCode: string): string {
    let js = tsCode;

    // Remove imports (we handle via require in VM, but if they use 'import', we need to transform to require or compile)
    // Actually, VM runs JS. If source has `import ...`, it fails in standard CJS node VM unless it's proper ESM.
    // Our providers use `import ...`. We must transform them to `const ... = require(...)`.

    // Transform imports: import { x } from 'y' -> const { x } = require('y')
    // import * as x from 'y' -> const x = require('y')
    // import x from 'y' -> const x = require('y')

    // Simple naive regex replacers

    // 1. Remove "/// <white space>"
    js = js.replace(/\/\/\/\s*<.*?>/g, '');

    // 2. Remove interfaces
    js = js.replace(/interface\s+\w+[\s\S]*?}/g, '');

    // 3. Remove type aliases
    js = js.replace(/type\s+\w+\s*=[\s\S]*?;/g, '');

    // Replace imports
    js = js.replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"](.+)['"];/g,
      'const $1 = require("$2");',
    );
    js = js.replace(/import\s+(\w+)\s+from\s+['"](.+)['"];/g, 'const $1 = require("$2");'); // Default import
    js = js.replace(
      /import\s+\{\s*(.+?)\s*\}\s+from\s+['"](.+)['"];/g,
      'const { $1 } = require("$2");',
    );

    // Replace exports
    js = js.replace(/export\s+const\s+(\w+)/g, 'exports.$1');
    js = js.replace(/export\s+function\s+(\w+)/g, 'exports.$1 = function $1');
    js = js.replace(/export\s+class\s+(\w+)/g, 'exports.$1 = class $1');
    js = js.replace(/export\s+default\s+/g, 'module.exports = ');

    // 1. Remove `as Type`
    js = js.replace(/\sas\s+[A-Za-z0-9_<>\[\]]+/g, '');

    // 2. Remove returns `: Type` at end of function sig
    js = js.replace(/\):\s*[A-Za-z0-9_<>\[\]]+\s*\{/g, ') {');
    js = js.replace(/\):\s*[A-Za-z0-9_<>\[\]]+\s*=>/g, ') =>');

    return js;
  }
}
