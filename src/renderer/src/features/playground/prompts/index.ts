import { CORE } from './core';
import { TOOLS } from './tools';
import { RULES } from './rules';
import { SYSTEM } from './system';

// Export individual modules
export { CORE } from './core';
export { TOOLS } from './tools';
export { RULES } from './rules';
export { SYSTEM } from './system';

export const combinePrompts = (): string => {
  return [CORE, TOOLS, RULES, SYSTEM].join('\n\n');
};

export const DEFAULT_RULE_PROMPT = combinePrompts();
