import { useEffect } from 'react';

// Import commands from the commands page
const commands = [
  {
    name: 'Commit Message Generator',
    trigger: 'commit-message',
    description: 'Generate a conventional commit message from staged changes',
    emoji: '📝',
    prompt: `
You are an expert developer. Please analyze the following git diff and generate a concise, conventional commit message.

Format:
<commit-message>
[emoji] [type]: [concise title]
- [bullet point 1]
- [bullet point 2]
</commit-message>

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

        // 2. Start Server
        const serverStatus = await window.api.server.start();
        if (!serverStatus.success) {
          return '⚠️  Failed to start local server.';
        }
        const port = serverStatus.port;

        // 3. Fetch any available account
        const accountsResponse = await fetch(`http://localhost:${port}/v1/accounts?limit=1`);
        const accountsData = await accountsResponse.json();
        const accounts = accountsData.data?.accounts || [];

        if (accounts.length === 0) {
          return '⚠️  No accounts found. Please add an account first.';
        }

        const selectedAccount = accounts[0];

        // 5. Get model ID (dynamically fetching or using a reasonable default per provider)
        let modelId = '';
        try {
          const modelsRes = await fetch(
            `http://localhost:${port}/v1/chat/accounts/${selectedAccount.id}/models`,
          );
          const modelsData = await modelsRes.json();
          const models = modelsData.data || [];
          if (models.length > 0) {
            // Pick a reasonable default model (prefer non-vision, chat-optimized if possible)
            // For now, just pick the first one
            modelId = models[0].id;
          }
        } catch (e) {
          console.warn('Failed to fetch models for account, using fallback', e);
        }

        if (!modelId) {
          modelId = 'default';
        }

        // 6. Generate AI Message
        const diffContent = status.substring(0, 6000); // Limit to 6000 chars
        const promptText = `
You are an expert developer. Please analyze the following git diff and generate a concise, conventional commit message.

Format:
<commit-message>
[emoji] [type]: [concise title]
- [bullet point 1]
- [bullet point 2]
</commit-message>

Diff:
${diffContent}
`;

        const response = await fetch(
          `http://localhost:${port}/v1/chat/accounts/${selectedAccount.id}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelId,
              messages: [{ role: 'user', content: promptText }],
              stream: false,
              thinking: false,
            }),
          },
        );

        if (!response.ok) {
          return `⚠️  AI API request failed: ${response.status} ${response.statusText}`;
        }

        // Parse JSON response
        const data = await response.json();

        if (!data.success) {
          return `⚠️  API request failed: ${data.message || 'Unknown error'}`;
        }

        const aiContent = data.message?.content || '';

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

export function useCommandRegistration() {
  useEffect(() => {
    // Register commands metadata with the main process (without handlers)
    const commandsMetadata = commands.map(({ name, trigger, description, emoji, prompt }) => ({
      name,
      trigger,
      description,
      emoji,
      prompt,
    }));

    window.api.send('commands:register', commandsMetadata);

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

            const result = await command.handler('', tools);

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
}
