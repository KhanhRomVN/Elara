const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distBinDir = path.join(rootDir, 'dist-bin');

function runCommand(command, env = {}) {
  console.log(`\n> Running: ${command}`);
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
}

function copyWasmFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  const items = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);
    if (item.isDirectory()) {
      copyWasmFiles(srcPath, destPath);
    } else if (item.isFile() && item.name.endsWith('.wasm')) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied WASM: ${path.relative(rootDir, srcPath)} -> ${path.relative(rootDir, destPath)}`);
    }
  }
}

try {
  // 1. Clean directories
  console.log('Cleaning dist and dist-bin...');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.rmSync(distBinDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(distBinDir, { recursive: true });

  // 2. Build TypeScript
  console.log('Compiling TypeScript...');
  runCommand('npx tsc');
  runCommand('npx tsc-alias');

  // 3. Copy WASM files recursively from src to dist
  console.log('Copying WASM files...');
  copyWasmFiles(path.join(rootDir, 'src'), distDir);

  // 4. Run obfuscation
  console.log('Running obfuscation...');
  try {
    runCommand('npm run obfuscate');
  } catch (err) {
    console.log('Obfuscation failed, skipping (as per || true rule)');
  }

  // 5. Rebuild better-sqlite3 for target platform (Node 18)
  const targetPlatform = process.platform; // win32, linux, darwin etc.
  console.log(`Rebuilding better-sqlite3 for target platform: ${targetPlatform} (Node 18.0.0)...`);
  runCommand(`npm rebuild better-sqlite3 --target=18.0.0 --target_arch=x64 --target_platform=${targetPlatform} --update-binary`);

  // 6. Package application with pkg
  console.log('Packaging application with explicit entry point dist/index.js...');
  runCommand('npx pkg dist/index.js --target node18-win-x64 --out-path dist-bin');

  // Rename generated index.exe to AIWeb2API.exe
  const indexExePath = path.join(distBinDir, 'index.exe');
  const winExeDest = path.join(distBinDir, 'AIWeb2API.exe');
  if (fs.existsSync(indexExePath)) {
    fs.copyFileSync(indexExePath, winExeDest);
    console.log('Copied index.exe to AIWeb2API.exe');
  }

  // 7. Copy native binding & resources to dist-bin
  console.log('Copying native SQLite addon and WASM resources to dist-bin...');
  const addonSrc = path.join(rootDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  const addonDest = path.join(distBinDir, 'better_sqlite3.node');
  if (fs.existsSync(addonSrc)) {
    fs.copyFileSync(addonSrc, addonDest);
    console.log(`Copied better_sqlite3.node to dist-bin for platform: ${targetPlatform}`);
  } else {
    throw new Error(`SQLite addon not found at ${addonSrc}`);
  }

  // Copy WASM resources to dist-bin/resources
  const resourcesDestDir = path.join(distBinDir, 'resources');
  fs.mkdirSync(resourcesDestDir, { recursive: true });
  const wasmSrc = path.join(rootDir, 'src', 'provider', 'deepseek', 'sha3_wasm_bg.7b9ca65ddd.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, path.join(resourcesDestDir, 'sha3_wasm_bg.7b9ca65ddd.wasm'));
    console.log('Copied sha3_wasm_bg.7b9ca65ddd.wasm to dist-bin/resources');
  }

  // 8. Restore native binding for host Node version
  console.log('Restoring better-sqlite3 for host Node version...');
  runCommand('npm rebuild better-sqlite3');

  console.log('\nBuild completed successfully!');
} catch (error) {
  console.error('\nBuild failed with error:', error);
  process.exit(1);
}
