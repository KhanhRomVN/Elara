#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectRoot = path.join(__dirname, '..');
const binDir = path.join(projectRoot, 'bin');
const localBinDir = path.join(projectRoot, 'node_modules', '.bin');
const cliSource = path.join(binDir, 'cli.js');
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
  // Ensure node_modules/.bin exists
  if (!fs.existsSync(localBinDir)) {
    fs.mkdirSync(localBinDir, { recursive: true });
    console.log(`✓ Created missing directory: ${localBinDir}`);
  }

  // Remove existing file/symlink if present
  try {
    const stats = fs.lstatSync(localCliLink);
    if (stats.isSymbolicLink() || stats.isFile() || stats.isDirectory()) {
      fs.rmSync(localCliLink, { recursive: true, force: true });
    }
  } catch (err) {
    // If it doesn't exist, lstatSync will throw - we can ignore this
  }

  const isWindows = process.platform === 'win32';

  // On Windows, symlinkSync needs a type argument ('file', 'dir', or 'junction')
  // 'file' is correct for cli.js
  fs.symlinkSync(cliSource, localCliLink, isWindows ? 'file' : undefined);
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

  // Fallback for Windows if symlinking fails due to permissions
  if (process.platform === 'win32') {
    try {
      fs.copyFileSync(cliSource, localCliLink);
      console.log(
        '✓ Fallback: Copied CLI script instead of symlinking (preferred for Windows environments with limited symlink permissions)',
      );
    } catch (copyError) {
      console.error(`✗ Fallback copy failed: ${copyError.message}`);
    }
  }

  console.log('You can still use: node bin/cli.js');
}

console.log('✓ Setup complete');
