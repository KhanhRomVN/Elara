/**
 * ------------------------------------------------------------------
 * Certificate Manager
 * ------------------------------------------------------------------
 * Quản lý SSL certificates cho proxy server.
 * Tự động tạo self-signed certificate bằng OpenSSL hoặc node-forge.
 *
 * Main functions:
 * - ensureCertificates()    : Đảm bảo certificates tồn tại
 * - getCertificatePath()    : Lấy đường dẫn certificate
 * - getKeyPath()            : Lấy đường dẫn private key
 * - getCertificateDir()     : Lấy thư mục chứa certificates
 * - exportCertificate()     : Export certificate PEM
 * - deleteCertificates()    : Xóa certificates
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// ── Utils ──
import { createLogger } from './logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('cert-manager');
const execAsync = promisify(exec);

// ─── Types ──────────────────────────────────────────────────────────────

export interface CertificatePair {
  cert: string;
  key: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const getUserDataPath = () => {
  try {
    const { app } = require('electron');
    return app.getPath('userData');
  } catch (e) {
    return path.join(os.homedir(), '.elara');
  }
};

// ─── Class ──────────────────────────────────────────────────────────────

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

    if (!fs.existsSync(this.certDir)) {
      fs.mkdirSync(this.certDir, { recursive: true });
    }
  }

  // ─── Ensure Certificates ────────────────────────────────────────────

  async ensureCertificates(): Promise<CertificatePair> {
    if (await this.certificatesExist()) {
      return this.loadCertificates();
    }

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

  // ─── Generate Certificates ──────────────────────────────────────────

  private async generateCertificates(): Promise<CertificatePair> {
    try {
      await execAsync(`openssl genrsa -out "${this.keyPath}" 2048`, {
        cwd: this.certDir,
      });

      const csrPath = path.join(this.certDir, 'server.csr');
      await execAsync(
        `openssl req -new -key "${this.keyPath}" -out "${csrPath}" -subj "/C=US/ST=Local/L=Local/O=Elara/CN=localhost"`,
        { cwd: this.certDir },
      );

      await execAsync(
        `openssl x509 -req -days 3650 -in "${csrPath}" -signkey "${this.keyPath}" -out "${this.certPath}" -extensions v3_req`,
        { cwd: this.certDir },
      );

      fs.unlinkSync(csrPath);

      return {
        cert: this.certPath,
        key: this.keyPath,
      };
    } catch (error) {
      logger.error('Failed to generate certificates:', error);
      return this.generateCertificatesWithNodeForge();
    }
  }

  private async generateCertificatesWithNodeForge(): Promise<CertificatePair> {
    try {
      const forge = require('node-forge');

      const keys = forge.pki.rsa.generateKeyPair(2048);

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
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
          ],
        },
      ]);

      cert.sign(keys.privateKey, forge.md.sha256.create());

      const certPem = forge.pki.certificateToPem(cert);
      const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

      fs.writeFileSync(this.certPath, certPem);
      fs.writeFileSync(this.keyPath, keyPem);

      return {
        cert: this.certPath,
        key: this.keyPath,
      };
    } catch (error) {
      logger.error('Failed to generate certificates with node-forge:', error);
      throw new Error('Certificate generation failed');
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────────

  getCertificatePath(): string {
    return this.certPath;
  }

  getKeyPath(): string {
    return this.keyPath;
  }

  getCertificateDir(): string {
    return this.certDir;
  }

  // ─── Export ──────────────────────────────────────────────────────────

  exportCertificate(): string {
    if (fs.existsSync(this.certPath)) {
      return fs.readFileSync(this.certPath, 'utf-8');
    }
    throw new Error('Certificate not found');
  }

  // ─── Delete ──────────────────────────────────────────────────────────

  deleteCertificates(): void {
    try {
      if (fs.existsSync(this.certPath)) fs.unlinkSync(this.certPath);
      if (fs.existsSync(this.keyPath)) fs.unlinkSync(this.keyPath);
    } catch (error) {
      logger.error('Failed to delete certificates:', error);
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

let certManager: CertificateManager | null = null;

export const getCertificateManager = (): CertificateManager => {
  if (!certManager) {
    certManager = new CertificateManager();
  }
  return certManager;
};