import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type CommandType = 'ai-completion' | 'shell';

export interface Command {
  id: string;
  trigger: string; // The CLI subcommand (e.g., 'auto-commit')
  name: string;
  description: string;
  type: CommandType;
  action: string; // Prompt for AI, or Script for Shell
}

class CommandStorage {
  private filePath: string;
  private commands: Command[] = [];

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'commands.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.commands = JSON.parse(data);

        // Cleanup legacy commands requested by user
        const legacyNames = ['Auto Commit Message', 'Explain Code'];
        const initialLength = this.commands.length;
        this.commands = this.commands.filter((c) => !legacyNames.includes(c.name));

        if (this.commands.length !== initialLength) {
          this.save();
        }
      } else {
        // Default commands
        this.commands = [];
        this.save();
      }
    } catch (error) {
      console.error('Failed to load commands:', error);
      this.commands = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.commands, null, 2));
    } catch (error) {
      console.error('Failed to save commands:', error);
    }
  }

  getAll(): Command[] {
    return this.commands;
  }

  get(id: string): Command | undefined {
    return this.commands.find((c) => c.id === id);
  }

  getByTrigger(trigger: string): Command | undefined {
    return this.commands.find((c) => c.trigger === trigger);
  }

  add(command: Command): void {
    this.commands.push(command);
    this.save();
  }

  update(id: string, updates: Partial<Command>): void {
    const index = this.commands.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.commands[index] = { ...this.commands[index], ...updates };
      this.save();
    }
  }

  delete(id: string): void {
    this.commands = this.commands.filter((c) => c.id !== id);
    this.save();
  }
}

export const commandStorage = new CommandStorage();
