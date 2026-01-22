import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Provider } from './types';
import { createLogger } from '../utils/logger';
import { providerSyncService } from '../services/provider-sync';

// Statically import providers that are always available or need special handling
import Gemini from './gemini';
import Cerebras from './cerebras';
import Claude from './claude';

const logger = createLogger('ProviderRegistry');

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider) {
    if (this.providers.has(provider.name.toLowerCase())) {
      logger.warn(
        `Provider ${provider.name} is already registered. Overwriting.`,
      );
    }
    this.providers.set(provider.name.toLowerCase(), provider);
    logger.info(`Registered provider: ${provider.name}`);
  }

  getProvider(name: string): Provider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  getProviderForModel(model: string): Provider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.isModelSupported && provider.isModelSupported(model)) {
        return provider;
      }
    }
    return undefined;
  }

  // Load all providers from the current directory
  async loadProviders() {
    try {
      // Sync providers first (download if needed)
      await providerSyncService.syncProviders();

      // Register statically imported providers
      this.register(Gemini);
      this.register(Cerebras);
      this.register(Claude);

      const providerDir = __dirname;
      if (!fs.readdirSync) {
        logger.warn(
          'fs.readdirSync is not available. Skipping automatic provider loading.',
        );
        return;
      }
      const entries = fs.readdirSync(providerDir, { withFileTypes: true });

      for (const entry of entries) {
        try {
          let modulePath = '';

          if (entry.isDirectory()) {
            // Check for index.ts or index.js in subdirectory
            const indexTs = path.join(providerDir, entry.name, 'index.ts');
            const indexJs = path.join(providerDir, entry.name, 'index.js');
            if (fs.existsSync(indexTs)) {
              // ES modules require explicit file extension
              modulePath = path.join(providerDir, entry.name, 'index.ts');
            } else if (fs.existsSync(indexJs)) {
              modulePath = path.join(providerDir, entry.name, 'index.js');
            }
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
            !entry.name.endsWith('.d.ts') &&
            entry.name !== 'index.ts' &&
            entry.name !== 'types.ts' &&
            entry.name !== 'registry.ts' &&
            // Exclude statically imported providers from dynamic loading
            entry.name !== 'gemini.ts' &&
            entry.name !== 'cerebras.ts' &&
            entry.name !== 'claude.ts'
          ) {
            modulePath = path.join(providerDir, entry.name);
          }

          if (modulePath) {
            // Use require for ts-node compatibility
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const module = require(modulePath);

            if (module.default && module.default.name) {
              this.register(module.default);
            } else {
              // logger.warn is noisy if it picks up non-provider files, but valid for provider folders
              // We can check if it looks like a provider.
              if (entry.isDirectory()) {
                logger.warn(
                  `Directory ${entry.name} does not export a default provider.`,
                );
              }
            }
          }
        } catch (error) {
          logger.error(`Failed to load provider from ${entry.name}`, error);
        }
      }
    } catch (error) {
      logger.warn('Failed to load providers from directory:', error);
    }
  }

  registerAllRoutes(router: Router) {
    this.providers.forEach((provider) => {
      if (provider.registerRoutes) {
        const providerRouter = Router();
        provider.registerRoutes(providerRouter);
        router.use(`/${provider.name.toLowerCase()}`, providerRouter);
        logger.info(`Mounted routes for ${provider.name}`);
      }
    });
  }
}

export const providerRegistry = new ProviderRegistry();
