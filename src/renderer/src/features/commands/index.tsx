import { useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { CommandConfig } from './types';

// Hardcoded commands
const commands: CommandConfig[] = [
  {
    name: 'Commit Message Generator',
    trigger: 'commit-message',
    description: 'Generate a conventional commit message from staged changes',
    emoji: '📝',
    prompt: `
You are an expert developer. Please analyze the following git diff and generate a concise, conventional commit message.
Wrap the commit message in <commit-message> tags.

Format:
<commit-message>
<icon> <type>: <title>
- <sub title 1>
- <sub title 2>
- <sub title 3>
</commit-message>

Rules:
- Use appropriate emojis for icons (e.g., ✨ for feat, 🐛 for fix, 📝 for docs)
- Keep the title under 50 characters if possible
- Use bullet points for details if necessary

Diff:
{{diff}}
`,
    handler: async (_output: any, { shell, prompt }: any) => {
      try {
        // 1. Check for staged changes (excluding lockfiles to avoid huge diffs)
        const status = await shell.execute(
          "git diff --cached -- . ':(exclude)package-lock.json' ':(exclude)yarn.lock' ':(exclude)pnpm-lock.yaml'",
        );
        if (!status || !status.trim()) {
          return '⚠️  No staged changes found. Please stage your changes first using `git add`.';
        }

        // 2. Fetch Accounts
        // @ts-ignore
        const accounts = await window.api.accounts.getAll();
        if (!accounts || accounts.length === 0) {
          return '⚠️  No accounts found. Please add an account in the app first.';
        }

        // 3. Select Account (Prioritize DeepSeek, then Active)
        const deepseekAccount = accounts.find(
          (acc: any) => acc.provider === 'DeepSeek' && acc.status === 'Active',
        );
        const otherAccount = accounts.find((acc: any) => acc.status === 'Active');
        const selectedAccount = deepseekAccount || otherAccount || accounts[0];

        if (!selectedAccount) {
          return '⚠️  No active accounts found. Please check your account status.';
        }

        // 4. Start Local Server
        // @ts-ignore
        const serverStatus = await window.api.server.start();
        if (!serverStatus.success) {
          return `⚠️  Failed to start local proxy server: ${serverStatus.error}`;
        }
        const port = serverStatus.port;

        // 5. Generate AI Message
        const diff = status.slice(0, 6000); // Limit diff size
        const promptText = `
You are an expert developer. Please analyze the following git diff and generate a concise, conventional commit message.
Wrap the commit message in <commit-message> tags.

Format:
<commit-message>
<icon> <type>: <title>
- <sub title 1>
- <sub title 2>
</commit-message>

Rules:
- Use appropriate emojis for icons (e.g., ✨ for feat, 🐛 for fix, 📝 for docs)
- Keep the title under 50 characters if possible
- Use bullet points for details if necessary

Diff:
${diff}
`;

        const response = await fetch(
          `http://localhost:${port}/v1/chat/completions?email=${encodeURIComponent(
            selectedAccount.email,
          )}&provider=${selectedAccount.provider.toLowerCase()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model:
                selectedAccount.provider === 'Claude'
                  ? 'claude-3-5-sonnet-20241022'
                  : 'deepseek-chat',
              messages: [{ role: 'user', content: promptText }],
              stream: false, // Simple non-streaming request
              thinking: false, // Disable thinking for commit messages
            }),
          },
        );

        if (!response.ok) {
          return `⚠️  AI API request failed: ${response.status} ${response.statusText}`;
        }

        // Parse SSE stream response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let aiContent = '';

        if (!reader) {
          return '⚠️  No response body from AI.';
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  aiContent += content;
                }
              } catch (e) {
                // Ignore parse errors for non-JSON lines
              }
            }
          }
        }

        if (!aiContent) {
          return '⚠️  AI returned empty response.';
        }

        // 6. Extract Commit Message
        const match = aiContent.match(/<commit-message>([\s\S]*?)<\/commit-message>/);
        if (!match) {
          return `⚠️  Could not parse commit message from AI response.\nResponse:\n${aiContent}`;
        }

        const commitMsg = match[1].trim();

        // 7. Interactive Confirmation
        const answer = await prompt(
          `\n\nGenerated Message:\n------------------\n${commitMsg}\n------------------\n\nDo you want to commit with this message?`,
        );

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          return '❌ Commit cancelled by user.';
        }

        // 8. Execute Git Commit & Push
        const escapedMsg = commitMsg.replace(/"/g, '\\"');
        await shell.execute(`git commit -m "${escapedMsg}"`);
        await shell.execute('git push');

        return `✅ Commit & Push Successful!\n\nMessage: ${commitMsg}`;
      } catch (error: any) {
        return `❌ Error: ${error.message}`;
      }
    },
  },
];

const CommandsPage = () => {
  useEffect(() => {
    // Listen for execution requests from main process (CLI)
    const removeListener = window.api.on(
      'command:execute-request',
      async (_event: any, { requestId, trigger, cwd }: any) => {
        console.log(`Received execution request for: ${trigger}, cwd: ${cwd}`);

        // Find the command
        const command = commands.find((c) => c.trigger === trigger);

        if (command && command.handler) {
          try {
            // Mock tools - pass cwd to shell.execute
            const tools = {
              shell: {
                execute: async (cmd: string) => {
                  return await window.api.shell.execute(cmd, cwd);
                },
              },
              prompt: async (msg: string) => {
                return await window.api.commands.prompt(msg);
              },
            };

            // Execute handler
            // Providing empty string for output as CLI integration doesn't support pre-generation yet without new API.
            // Command handlers should be robust or we'll add AI support later.
            const result = await command.handler('', tools);

            // Send response
            window.api.send('command:execute-response', {
              requestId,
              response: { output: result || `Executed ${trigger} successfully` },
            });
          } catch (e: any) {
            console.error('Command execution failed:', e);
            window.api.send('command:execute-response', {
              requestId,
              response: { error: e.message },
            });
          }
        } else {
          window.api.send('command:execute-response', {
            requestId,
            response: { error: 'Command not found in renderer' },
          });
        }
      },
    );

    return () => {
      removeListener();
    };
  }, []);

  useEffect(() => {
    if (commands.length > 0) {
      // Register with main process
      const simpleCommands = commands.map((c) => ({
        name: c.name,
        trigger: c.trigger,
        description: c.description,
      }));
      window.api.send('commands:register', simpleCommands);
    }
  }, []); // commands is constant now

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CLI Commands</h1>
          <p className="text-muted-foreground mt-1">Manage custom commands for the Elara CLI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commands.map((command, index) => (
          <div
            key={index}
            className="group relative bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="text-2xl">{command.emoji || <Terminal className="w-6 h-6" />}</div>
                <div>
                  <h3 className="font-semibold text-foreground">{command.name}</h3>
                  <code className="text-xs text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                    elara {command.trigger}
                  </code>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
              {command.description}
            </p>
          </div>
        ))}

        {commands.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-border rounded-lg text-muted-foreground">
            <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No commands found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandsPage;
