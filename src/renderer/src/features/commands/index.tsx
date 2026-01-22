import { useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { CommandConfig } from './types';
import { getCachedModels } from '../../utils/model-cache';

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

        // 2. Start Local Server
        const serverStatus = await window.api.server.start();
        if (!serverStatus.success) {
          return `⚠️  Failed to start local proxy server: ${serverStatus.error}`;
        }
        const port = serverStatus.port;

        // 3. Fetch any available account via API
        console.log('[commit-message] Fetching available accounts from API...');
        const accountsResponse = await fetch(`http://localhost:${port}/v1/accounts?limit=1`);
        const accountsData = await accountsResponse.json();
        const accounts = accountsData.data?.accounts || [];

        if (accounts.length === 0) {
          return '⚠️  No accounts found. Please add an account in the app first.';
        }

        const selectedAccount = accounts[0];
        console.log('[commit-message] Selected account:', selectedAccount);

        // 5. Get model ID from cache
        const getProviderModel = (providerId: string): string => {
          const cached = getCachedModels(providerId);
          return cached && cached.length > 0 ? cached[0].id : '';
        };

        const providerId = selectedAccount.provider_id;
        const modelId = providerId ? getProviderModel(providerId) : '';

        if (!modelId) {
          return `⚠️  No model available for ${providerId}. Please load models first.`;
        }

        // 6. Generate AI Message
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
          `http://localhost:${port}/v1/chat/accounts/${selectedAccount.id}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelId,
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

        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          const value = result.value;
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
        let commitMsg = '';

        if (match) {
          commitMsg = match[1].trim();
        } else {
          // Fallback: Check if the content looks like a commit message (starts with typical conventional commit patterns)
          const conventionalCommitRegex =
            /^(?:[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|\w+)(\([^)]+\))?: .+/u;
          const lines = aiContent.trim().split('\n');
          if (conventionalCommitRegex.test(lines[0])) {
            commitMsg = aiContent.trim();
          } else {
            return `⚠️  Could not parse commit message from AI response.\nResponse:\n${aiContent}`;
          }
        }

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
    <div className="h-full flex flex-col bg-background p-4 gap-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">CLI Commands</h2>
        <p className="text-muted-foreground">Manage custom commands for the Elara CLI</p>
      </div>

      {/* Main Content Box */}
      <div className="flex-1 flex overflow-hidden border border-dashed border-zinc-500/25 rounded-lg bg-card">
        <div className="flex-1 overflow-y-auto p-6">
          {commands.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {commands.map((command, index) => (
                <div
                  key={index}
                  className="group relative bg-gradient-to-br from-card to-card/50 border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Emoji/Icon */}
                  <div className="flex items-center justify-center w-14 h-14 mb-4 rounded-xl bg-primary/10 text-3xl group-hover:scale-110 transition-transform duration-300">
                    {command.emoji || <Terminal className="w-7 h-7 text-primary" />}
                  </div>

                  {/* Command Name */}
                  <h3 className="font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">
                    {command.name}
                  </h3>

                  {/* Command Trigger */}
                  <code className="inline-block text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-md mb-3 font-mono">
                    elara {command.trigger}
                  </code>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {command.description}
                  </p>

                  {/* Decorative gradient overlay */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                  <Terminal className="w-10 h-10 text-primary/50" />
                </div>
                <p className="text-lg text-muted-foreground">No commands found.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Commands will appear here once registered.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandsPage;
