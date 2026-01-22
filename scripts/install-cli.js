#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI_SOURCE = path.join(__dirname, '..', 'bin', 'cli.js');
const CLI_DEST =
  process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'elara.cmd')
    : '/usr/local/bin/elara';

function install() {
  console.log('Installing Elara CLI...');

  // Check if source file exists
  if (!fs.existsSync(CLI_SOURCE)) {
    console.error(`Error: CLI source file not found at ${CLI_SOURCE}`);
    process.exit(1);
  }

  // Make CLI script executable on Unix systems
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(CLI_SOURCE, 0o755);
      console.log(`✓ Made ${CLI_SOURCE} executable`);
    } catch (error) {
      console.error(`Error: Failed to make CLI script executable: ${error.message}`);
      process.exit(1);
    }
  }

  // Create symlink or batch file
  try {
    if (process.platform === 'win32') {
      // On Windows, create a batch file that calls Node with the CLI script
      const batchContent = `@echo off\nnode "${CLI_SOURCE}" %*`;
      fs.writeFileSync(CLI_DEST, batchContent);
      console.log(`✓ Created batch file at ${CLI_DEST}`);
    } else {
      // On Unix, create symlink
      // Remove existing symlink if it exists
      if (fs.existsSync(CLI_DEST)) {
        fs.unlinkSync(CLI_DEST);
        console.log(`✓ Removed existing symlink at ${CLI_DEST}`);
      }

      fs.symlinkSync(CLI_SOURCE, CLI_DEST);
      console.log(`✓ Created symlink at ${CLI_DEST}`);
    }

    console.log('');
    console.log('✓ Elara CLI installed successfully!');
    console.log('');
    console.log('You can now use the "elara" command in your terminal.');
    console.log(
      'Note: You may need to restart your terminal or run "hash -r" for the command to be recognized.',
    );
    console.log('');
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.error('');
      console.error('Error: Permission denied. Please run this command with sudo:');
      console.error('  sudo npm run install-cli');
      console.error('');
    } else {
      console.error(`Error: Failed to create symlink: ${error.message}`);
    }
    process.exit(1);
  }
}

install();
