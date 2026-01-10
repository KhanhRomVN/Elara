#!/usr/bin/env node

const net = require('net');
const readline = require('readline');

const SOCKET_PATH = process.platform === 'win32' ? '\\\\.\\pipe\\elara-cli' : '/tmp/elara.sock';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

function displayAppInfo(info) {
  console.log('');
  console.log(
    `${colors.bright}${colors.cyan}╭─────────────────────────────────────────╮${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.cyan}│${colors.reset}           ${colors.bright}ElaraCC Application${colors.reset}           ${colors.bright}${colors.cyan}│${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.cyan}╰─────────────────────────────────────────╯${colors.reset}`,
  );
  console.log('');

  console.log(
    `  ${colors.bright}${colors.green}●${colors.reset} ${colors.bright}Status:${colors.reset} Running`,
  );
  console.log('');

  console.log(`  ${colors.bright}Application${colors.reset}`);
  console.log(`    Name:       ${colors.cyan}${info.name}${colors.reset}`);
  console.log(`    Version:    ${colors.cyan}${info.version}${colors.reset}`);
  console.log('');

  console.log(`  ${colors.bright}Process${colors.reset}`);
  console.log(`    PID:        ${colors.yellow}${info.pid}${colors.reset}`);
  console.log(`    Uptime:     ${colors.yellow}${formatUptime(info.uptime)}${colors.reset}`);
  console.log('');

  console.log(`  ${colors.bright}System${colors.reset}`);
  console.log(`    Platform:   ${colors.blue}${info.platform}${colors.reset}`);
  console.log(`    Arch:       ${colors.blue}${info.arch}${colors.reset}`);
  console.log(`    Node:       ${colors.blue}v${info.nodeVersion}${colors.reset}`);
  console.log(`    Electron:   ${colors.blue}v${info.electronVersion}${colors.reset}`);
  console.log('');

  console.log(`  ${colors.bright}Memory Usage${colors.reset}`);
  console.log(`    RSS:        ${colors.magenta}${info.memory.rss} MB${colors.reset}`);
  console.log(`    Heap Total: ${colors.magenta}${info.memory.heapTotal} MB${colors.reset}`);
  console.log(`    Heap Used:  ${colors.magenta}${info.memory.heapUsed} MB${colors.reset}`);
  console.log('');
}

function processMessage(client, message) {
  try {
    const info = JSON.parse(message);

    if (info.error) {
      console.error(`${colors.red}Error: ${info.error}${colors.reset}`);
      // Don't exit immediately on error if it's part of a stream, but typically error ends it.
      // For now, let's allow server to close connection.
    } else if (info.type === 'execution-result') {
      process.stdout.write(info.output); // Use write to avoid extra newlines if output has them
    } else if (info.type === 'prompt') {
      // Interactive Prompt
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`${colors.yellow}${info.query} (y/n):${colors.reset} `, (answer) => {
        rl.close();
        client.write(
          JSON.stringify({
            type: 'input',
            content: answer.trim(),
          }),
        );
      });
    } else if (info.type === 'info') {
      displayAppInfo(info);
    } else {
      // Fallback
      console.log(message);
    }
  } catch (error) {
    // If not JSON, print as raw text
    if (message.trim()) {
      console.log(message);
    }
  }
}

function connectToApp() {
  const client = new net.Socket();
  let buffer = '';
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);
  const cwd = process.cwd();

  client.connect(SOCKET_PATH, () => {
    // Send request based on arguments
    if (!command) {
      client.write(JSON.stringify({ type: 'info' }));
    } else {
      client.write(
        JSON.stringify({
          type: 'execute',
          trigger: command,
          args: commandArgs,
          cwd,
        }),
      );
    }
  });

  client.on('data', (data) => {
    buffer += data.toString();

    // Process newlines as message delimiters
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      const message = buffer.substring(0, boundary).trim();
      buffer = buffer.substring(boundary + 1);

      if (message) {
        processMessage(client, message);
      }

      boundary = buffer.indexOf('\n');
    }

    // Attempt to parse remainder if it looks like complete JSON (optimization/fallback)
    // But standard protocol will be newline delimited JSON.
    // Ideally server sends \n after every JSON.
  });

  client.on('end', () => {
    // Process remaining buffer
    if (buffer.trim()) {
      processMessage(client, buffer.trim());
    }
  });

  client.on('error', (error) => {
    if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
      console.log('');
      console.log(
        `${colors.bright}${colors.red}╭─────────────────────────────────────────╮${colors.reset}`,
      );
      console.log(
        `${colors.bright}${colors.red}│${colors.reset}           ${colors.bright}Elara Application${colors.reset}           ${colors.bright}${colors.red}│${colors.reset}`,
      );
      console.log(
        `${colors.bright}${colors.red}╰─────────────────────────────────────────╯${colors.reset}`,
      );
      console.log('');
      console.log(
        `  ${colors.bright}${colors.red}✖${colors.reset} ${colors.bright}Status:${colors.reset} Not Running`,
      );
      console.log('');
      console.log(`  ${colors.yellow}The Elara app is currently not running.${colors.reset}`);
      console.log(`  ${colors.yellow}Please start the application first.${colors.reset}`);
      console.log('');
    } else {
      console.error(`${colors.red}Connection error: ${error.message}${colors.reset}`);
    }
    process.exit(1);
  });
}

// Main execution
connectToApp();
