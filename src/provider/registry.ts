import * as fs from 'fs';
import * as path from 'path';
import { Router } from 'express';
import { Provider } from '../types/index';
import { createLogger } from '../utils/logger';
import { proxyService } from '../services/proxy.service';

const logger = createLogger('ProviderRegistry');

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider) {
    const key = provider.name.toLowerCase();
    this.providers.set(key, provider);

    // Create aliases for common variations
    const aliases: string[] = [];

    if (key.includes('.')) {
      aliases.push(key.split('.')[0]);
    }

    // Special alias for Z.AI Browser
    if (key === 'z.ai browser') {
      aliases.push('zai-browser', 'zai');
    }

    // Special alias for Kimi
    if (key === 'kimi') {
      aliases.push('moonshot', 'moonshotai');
    }

    // General: remove dots, spaces, replace with dash
    const normalized = key.replace(/[.\s]/g, '-');
    if (normalized !== key) {
      aliases.push(normalized);
    }

    for (const alias of aliases) {
      if (!this.providers.has(alias)) {
        this.providers.set(alias, provider);
      }
    }

    if (provider.proxyHandler) {
      proxyService.registerHandler(provider.proxyHandler);
    }
  }

  getProvider(name: string): Provider | undefined {
    const key = name.toLowerCase();
    const provider = this.providers.get(key);
    return provider;
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

  async loadProviders() {
    try {
      const { default: ClaudeProvider } = require('./claude');
      const { default: HuggingChatProvider } = require('./huggingchat');
      const { default: MistralProvider } = require('./mistral');
      const { default: DeepSeekProvider } = require('./deepseek');
      const { default: GroqProvider } = require('./groq');
      const { default: QwenProvider } = require('./qwen');
      const { default: QwenCliProvider } = require('./qwen-cli');
      const { default: GeminiCliProvider } = require('./gemini-cli');

      const { default: CodexCliProvider } = require('./codex-cli');
      const { default: ZAIProvider } = require('./zai');
      const { default: ZaiBrowserProvider } = require('./zai-browser');
      const { default: CerebrasCloudProvider } = require('./cerebras-cloud');
      const { default: GeminiProvider } = require('./gemini');
      const { default: KimiProvider } = require('./kimi');

      const providers = [
        ClaudeProvider,
        HuggingChatProvider,
        MistralProvider,
        DeepSeekProvider,
        GroqProvider,
        QwenProvider,
        QwenCliProvider,
        GeminiCliProvider,
        CodexCliProvider,
        ZAIProvider,
        ZaiBrowserProvider,
        CerebrasCloudProvider,
        GeminiProvider,
        KimiProvider,
      ];
      for (const p of providers) {
        if (p && p.name) {
          this.register(p);
        } else {
          logger.warn(`[Registry] Invalid provider: ${p}`);
        }
      }

      // Aliases for Kimi / Moonshot
      for (const alias of ['moonshotai', 'moonshot', 'kimi']) {
        if (!this.providers.has(alias) && KimiProvider) {
          this.providers.set(alias, KimiProvider);
        }
      }
    } catch (error) {
      logger.error('Failed to load providers', error);
    }
  }

  registerAllRoutes(router: Router) {
    this.providers.forEach((provider) => {
      if (provider.registerRoutes) {
        const providerRouter = Router();
        provider.registerRoutes(providerRouter);
        router.use(`/${provider.name.toLowerCase()}`, providerRouter);
      }
    });
  }
}

export const providerRegistry = new ProviderRegistry();
