#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectRoot = path.join(__dirname, '..');
const localBinDir = path.join(projectRoot, 'node_modules', '.bin');
const cliSource = path.join(projectRoot, 'bin', 'cli.js');
const localCliLink = path.join(localBinDir, 'elara');

console.log('🔧 Setting up local CLI...');

// Make CLI executable
try {
  fs.chmodSync(cliSource, 0o755);
  console.log('✓ Made CLI script executable');
} catch (error) {
  console.warn(`⚠ Could not chmod CLI script: ${error.message}`);
}

// Create symlink in node_modules/.bin (no sudo needed)
try {
  // Remove existing symlink if present
  if (fs.existsSync(localCliLink)) {
    fs.unlinkSync(localCliLink);
  }

  fs.symlinkSync(cliSource, localCliLink);
  console.log('✓ Created local CLI symlink in node_modules/.bin/elara');
  console.log('');
  console.log('You can now use CLI in this project:');
  console.log('  npx elara          (recommended)');
  console.log('  ./node_modules/.bin/elara');
  console.log('  node bin/cli.js');
  console.log('');
  console.log('Or install globally: sudo npm run install-cli');
} catch (error) {
  console.error(`✗ Failed to create local symlink: ${error.message}`);
  console.log('You can still use: node bin/cli.js');
}

console.log('✓ Setup complete');
