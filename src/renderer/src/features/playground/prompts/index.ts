import { buildCorePrompt } from './core';
import { TOOLS } from './tools';
import { buildRulesPrompt } from './rules';
import { buildSystemPrompt, SystemInfo } from './system';

// Export individual modules
export { buildCorePrompt } from './core';
export { TOOLS } from './tools';
export { buildRulesPrompt } from './rules';
export { buildSystemPrompt } from './system';

interface PromptConfig {
  language: string;
  systemInfo: SystemInfo;
}

export const combinePrompts = (config: PromptConfig): string => {
  const { language, systemInfo } = config;

  const core = buildCorePrompt(language);
  const rules = buildRulesPrompt(language);
  const system = buildSystemPrompt(systemInfo);

  return [core, TOOLS, rules, system].join('\n\n');
};

/**
 * This is primarily for fallback.
 * Real values should be passed from usePlaygroundLogic using window.api.app.getSystemInfo()
 */
export const getDefaultPrompt = (language: string = 'English'): string => {
  return combinePrompts({
    language,
    systemInfo: {
      os: 'Unknown OS',
      ide: 'Elara IDE',
      shell: 'unknown',
      homeDir: '~',
      cwd: '.',
      language,
    },
  });
};
