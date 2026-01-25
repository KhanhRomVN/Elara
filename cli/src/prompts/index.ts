import { CORE } from './core.js';
import { TOOLS } from './tools.js';
import { RULES } from './rules.js';
import { SYSTEM } from './system.js';

// Export individual modules
export { CORE } from './core.js';
export { TOOLS } from './tools.js';
export { RULES } from './rules.js';
export { SYSTEM } from './system.js';

export const combinePrompts = (): string => {
  return [CORE, TOOLS, RULES, SYSTEM].join('\n\n');
};

export const DEFAULT_RULE_PROMPT = combinePrompts();
