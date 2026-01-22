export interface ShellAPI {
  execute: (command: string) => Promise<string>;
}

export interface CommandConfig {
  name: string;
  trigger: string;
  description: string;
  emoji: string;
  prompt: string;
  handler: (
    output: string,
    tools: { shell: ShellAPI; prompt: (msg: string) => Promise<string> },
  ) => Promise<string | void>;
}
