import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export interface CertificatePair {
  cert: string;
  key: string;
}

const getUserDataPath = () => {
  try {
    // Try to get electron app path if available
    const { app } = require('electron');
    return app.getPath('userData');
  } catch (e) {
    // Fallback for standalone mode
    return path.join(os.homedir(), '.elara');
  }
};

export class CertificateManager {
  private certDir: string;
  private certPath: string;
  private keyPath: string;
  private caPath: string;

  constructor() {
    this.certDir = path.join(getUserDataPath(), 'certs');
    this.certPath = path.join(this.certDir, 'server.crt');
    this.keyPath = path.join(this.certDir, 'server.key');
    this.caPath = path.join(this.certDir, 'ca.crt');

    // Ensure cert directory exists
    if (!fs.existsSync(this.certDir)) {
      fs.mkdirSync(this.certDir, { recursive: true });
    }
  }

  async ensureCertificates(): Promise<CertificatePair> {
    if (await this.certificatesExist()) {
      console.log('[CertManager] Loading existing certificates');
      return this.loadCertificates();
    }

    console.log('[CertManager] Generating new self-signed certificates');
    return this.generateCertificates();
  }

  private async certificatesExist(): Promise<boolean> {
    return fs.existsSync(this.certPath) && fs.existsSync(this.keyPath);
  }

  private loadCertificates(): CertificatePair {
    return {
      cert: this.certPath,
      key: this.keyPath,
    };
  }

  private async generateCertificates(): Promise<CertificatePair> {
    try {
      // Generate private key
      await execAsync(`openssl genrsa -out "${this.keyPath}" 2048`, {
        cwd: this.certDir,
      });

      // Generate certificate signing request
      const csrPath = path.join(this.certDir, 'server.csr');
      await execAsync(
        `openssl req -new -key "${this.keyPath}" -out "${csrPath}" -subj "/C=US/ST=Local/L=Local/O=Elara/CN=localhost"`,
        { cwd: this.certDir },
      );

      // Generate self-signed certificate (valid for 10 years)
      await execAsync(
        `openssl x509 -req -days 3650 -in "${csrPath}" -signkey "${this.keyPath}" -out "${this.certPath}" -extensions v3_req`,
        { cwd: this.certDir },
      );

      // Clean up CSR
      fs.unlinkSync(csrPath);

      console.log('[CertManager] Certificates generated successfully');
      console.log(`[CertManager] Certificate: ${this.certPath}`);
      console.log(`[CertManager] Key: ${this.keyPath}`);

      return {
        cert: this.certPath,
        key: this.keyPath,
      };
    } catch (error) {
      console.error('[CertManager] Failed to generate certificates:', error);

      // Fallback: Create simple self-signed cert using Node.js if OpenSSL fails
      return this.generateCertificatesWithNodeForge();
    }
  }

  private async generateCertificatesWithNodeForge(): Promise<CertificatePair> {
    try {
      const forge = require('node-forge');

      console.log('[CertManager] Generating certificates with node-forge');

      // Generate key pair
      const keys = forge.pki.rsa.generateKeyPair(2048);

      // Create certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(
        cert.validity.notBefore.getFullYear() + 10,
      );

      const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'countryName', value: 'US' },
        { shortName: 'ST', value: 'Local' },
        { name: 'localityName', value: 'Local' },
        { name: 'organizationName', value: 'Elara' },
      ];

      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      // Add extensions for localhost
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: true,
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true,
        },
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: 2, // DNS
              value: 'localhost',
            },
            {
              type: 7, // IP
              ip: '127.0.0.1',
            },
          ],
        },
      ]);

      // Sign certificate
      cert.sign(keys.privateKey, forge.md.sha256.create());

      // Convert to PEM format
      const certPem = forge.pki.certificateToPem(cert);
      const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

      // Save to files
      fs.writeFileSync(this.certPath, certPem);
      fs.writeFileSync(this.keyPath, keyPem);

      console.log('[CertManager] Certificates generated with node-forge');
      console.log(`[CertManager] Certificate: ${this.certPath}`);
      console.log(`[CertManager] Key: ${this.keyPath}`);

      return {
        cert: this.certPath,
        key: this.keyPath,
      };
    } catch (error) {
      console.error(
        '[CertManager] Failed to generate certificates with node-forge:',
        error,
      );
      throw new Error('Certificate generation failed');
    }
  }

  getCertificatePath(): string {
    return this.certPath;
  }

  getKeyPath(): string {
    return this.keyPath;
  }

  getCertificateDir(): string {
    return this.certDir;
  }

  exportCertificate(): string {
    if (fs.existsSync(this.certPath)) {
      return fs.readFileSync(this.certPath, 'utf-8');
    }
    throw new Error('Certificate not found');
  }

  deleteCertificates(): void {
    try {
      if (fs.existsSync(this.certPath)) fs.unlinkSync(this.certPath);
      if (fs.existsSync(this.keyPath)) fs.unlinkSync(this.keyPath);
      console.log('[CertManager] Certificates deleted');
    } catch (error) {
      console.error('[CertManager] Failed to delete certificates:', error);
    }
  }
}

// Singleton instance
let certManager: CertificateManager | null = null;

export const getCertificateManager = (): CertificateManager => {
  if (!certManager) {
    certManager = new CertificateManager();
  }
  return certManager;
};
