#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CLI_DEST =
  process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'elara.cmd')
    : '/usr/local/bin/elara';

function uninstall() {
  console.log('Uninstalling Elara CLI...');

  try {
    if (fs.existsSync(CLI_DEST)) {
      fs.unlinkSync(CLI_DEST);
      console.log(`✓ Removed ${CLI_DEST}`);
      console.log('');
      console.log('✓ Elara CLI uninstalled successfully!');
      console.log('');
    } else {
      console.log('Elara CLI is not installed.');
    }
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.error('');
      console.error('Error: Permission denied. Please run this command with sudo:');
      console.error('  sudo npm run uninstall-cli');
      console.error('');
    } else {
      console.error(`Error: Failed to remove symlink: ${error.message}`);
    }
    process.exit(1);
  }
}

uninstall();
