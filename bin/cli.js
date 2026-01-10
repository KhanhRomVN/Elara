#!/usr/bin/env node

const net = require('net');
const os = require('os');

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

function connectToApp() {
  const client = new net.Socket();
  let responseData = '';
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
    responseData += data.toString();
  });

  client.on('end', () => {
    try {
      const info = JSON.parse(responseData);

      if (info.error) {
        console.error(`${colors.red}Error: ${info.error}${colors.reset}`);
        process.exit(1);
      } else if (info.type === 'execution-result') {
        console.log(info.output);
      } else {
        displayAppInfo(info);
      }
    } catch (error) {
      // If not JSON, just print it (might be raw output)
      if (responseData.trim()) {
        console.log(responseData);
      } else {
        console.error(`${colors.red}Failed to parse response from app${colors.reset}`);
        process.exit(1);
      }
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
