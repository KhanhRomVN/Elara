const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distBinDir = path.join(rootDir, 'dist-bin');

function runCommand(command, env = {}) {
  console.log(`\n> Running: ${command}`);
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...env },
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

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = (targetUrl) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download ${targetUrl}, status code: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function extractSqliteAddon(tarFileName, destDir) {
  const downloadUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v9.6.0/${tarFileName}`;
  const tmpTarPath = path.join(destDir, tarFileName);
  console.log(`Downloading ${tarFileName}...`);
  await downloadFile(downloadUrl, tmpTarPath);

  try {
    execSync(`tar -xzf "${tmpTarPath}" -C "${destDir}"`, { stdio: 'ignore' });
    const extractedBinding = path.join(destDir, 'build', 'Release', 'better_sqlite3.node');
    if (fs.existsSync(extractedBinding)) {
      fs.copyFileSync(extractedBinding, path.join(destDir, 'better_sqlite3.node'));
      fs.rmSync(path.join(destDir, 'build'), { recursive: true, force: true });
    }
    fs.rmSync(tmpTarPath, { force: true });
    console.log(`Extracted better_sqlite3.node into ${destDir}`);
  } catch (e) {
    console.warn(`Failed to extract ${tarFileName}:`, e.message);
  }
}

async function build() {
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

    // 5. Package application for all platforms with pkg (Node 18)
    const targets = [
      {
        pkgTarget: 'node18-win-x64',
        outName: 'AIWeb2API.exe',
        pkgOutFile: 'index-win-x64.exe',
        folder: 'AIWeb2API-windows-x64',
        tar: 'better-sqlite3-v9.6.0-node-v108-win32-x64.tar.gz',
      },
      {
        pkgTarget: 'node18-linux-x64',
        outName: 'AIWeb2API',
        pkgOutFile: 'index-linux-x64',
        folder: 'AIWeb2API-linux-x64',
        tar: 'better-sqlite3-v9.6.0-node-v108-linux-x64.tar.gz',
      },
      {
        pkgTarget: 'node18-linux-arm64',
        outName: 'AIWeb2API',
        pkgOutFile: 'index-linux-arm64',
        folder: 'AIWeb2API-linux-arm64',
        tar: 'better-sqlite3-v9.6.0-node-v108-linux-arm64.tar.gz',
      },
      {
        pkgTarget: 'node18-macos-x64',
        outName: 'AIWeb2API',
        pkgOutFile: 'index-macos-x64',
        folder: 'AIWeb2API-macos-x64',
        tar: 'better-sqlite3-v9.6.0-node-v108-darwin-x64.tar.gz',
      },
      {
        pkgTarget: 'node18-macos-arm64',
        outName: 'AIWeb2API',
        pkgOutFile: 'index-macos-arm64',
        folder: 'AIWeb2API-macos-arm64',
        tar: 'better-sqlite3-v9.6.0-node-v108-darwin-arm64.tar.gz',
      },
    ];

    const targetList = targets.map((t) => t.pkgTarget).join(',');
    console.log(`Packaging multi-platform binaries with pkg (${targetList})...`);
    runCommand(`npx pkg dist/index.js --targets ${targetList} --public --public-packages "*" --no-bytecode --out-path dist-bin`);

    // 6. Assemble platform packages
    const wasmSrc = path.join(rootDir, 'src', 'provider', 'deepseek', 'sha3_wasm_bg.7b9ca65ddd.wasm');

    for (const t of targets) {
      console.log(`\nAssembling package for ${t.folder}...`);
      const targetDir = path.join(distBinDir, t.folder);
      fs.mkdirSync(targetDir, { recursive: true });

      // Move / copy binary
      const generatedBin = path.join(distBinDir, t.pkgOutFile);
      const destBin = path.join(targetDir, t.outName);
      if (fs.existsSync(generatedBin)) {
        fs.renameSync(generatedBin, destBin);
        console.log(`Placed binary: ${t.pkgOutFile} -> ${t.folder}/${t.outName}`);
      }

      // Extract SQLite addon
      await extractSqliteAddon(t.tar, targetDir);

      // Copy WASM
      if (fs.existsSync(wasmSrc)) {
        const targetResDir = path.join(targetDir, 'resources');
        fs.mkdirSync(targetResDir, { recursive: true });
        fs.copyFileSync(wasmSrc, path.join(targetResDir, 'sha3_wasm_bg.7b9ca65ddd.wasm'));
      }
    }

    // 7. Place Windows default binary & addon in root dist-bin for convenience
    const winFolder = path.join(distBinDir, 'AIWeb2API-windows-x64');
    if (fs.existsSync(path.join(winFolder, 'AIWeb2API.exe'))) {
      fs.copyFileSync(path.join(winFolder, 'AIWeb2API.exe'), path.join(distBinDir, 'AIWeb2API.exe'));
    }
    if (fs.existsSync(path.join(winFolder, 'better_sqlite3.node'))) {
      fs.copyFileSync(path.join(winFolder, 'better_sqlite3.node'), path.join(distBinDir, 'better_sqlite3.node'));
    }
    const rootResDir = path.join(distBinDir, 'resources');
    fs.mkdirSync(rootResDir, { recursive: true });
    if (fs.existsSync(wasmSrc)) {
      fs.copyFileSync(wasmSrc, path.join(rootResDir, 'sha3_wasm_bg.7b9ca65ddd.wasm'));
    }

    console.log('\n=========================================');
    console.log('✅ Multi-platform build completed successfully!');
    console.log('Output directories in dist-bin:');
    console.log(' - dist-bin/AIWeb2API-windows-x64/ (Windows x64)');
    console.log(' - dist-bin/AIWeb2API-linux-x64/   (Linux x64: Ubuntu/Debian/Fedora/Arch)');
    console.log(' - dist-bin/AIWeb2API-linux-arm64/ (Linux ARM64: Raspberry Pi/Graviton)');
    console.log(' - dist-bin/AIWeb2API-macos-x64/   (macOS Intel)');
    console.log(' - dist-bin/AIWeb2API-macos-arm64/ (macOS Apple Silicon M1/M2/M3/M4)');
    console.log('=========================================');
  } catch (error) {
    console.error('\nBuild failed with error:', error);
    process.exit(1);
  }
}

build();
