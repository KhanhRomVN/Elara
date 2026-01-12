import { WebContents } from 'electron';
import * as crypto from 'crypto';

export interface RendererCommand {
  name: string;
  trigger: string;
  description: string;
}

class CommandRegistry {
  private commands: Map<string, RendererCommand> = new Map();
  private renderer: WebContents | null = null;
  private pendingRequests: Map<string, (response: any) => void> = new Map();

  register(commands: RendererCommand[], sender: WebContents) {
    this.renderer = sender;
    this.commands.clear();
    commands.forEach((cmd) => {
      this.commands.set(cmd.trigger, cmd);
    });
  }

  getCommand(trigger: string): RendererCommand | undefined {
    return this.commands.get(trigger);
  }

  async executeCommand(trigger: string, args: any = {}): Promise<any> {
    if (!this.renderer) {
      throw new Error('No renderer registered to handle commands.');
    }

    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Command execution timed out'));
      }, 300000); // 5m timeout for AI generation & interaction

      this.pendingRequests.set(requestId, (response) => {
        clearTimeout(timeout);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.output);
        }
      });

      this.renderer!.send('command:execute-request', {
        requestId,
        trigger,
        args,
        cwd: args.cwd, // Forward cwd from CLI request
      });
    });
  }

  handleResponse(requestId: string, response: any) {
    const resolver = this.pendingRequests.get(requestId);
    if (resolver) {
      resolver(response);
      this.pendingRequests.delete(requestId);
    }
  }
}

export const commandRegistry = new CommandRegistry();
