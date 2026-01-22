import { ipcMain } from 'electron';
import { getProxyConfig, updateProxyConfig, getConfigManager } from '../server/config';
import { getCertificateManager } from '../server/utils/cert-manager';
import { getServerInfo } from '../server';

/**
 * Register IPC handlers for proxy configuration
 */
export const registerProxyIpcHandlers = (): void => {
  // Get proxy configuration
  ipcMain.handle('proxy:get-config', async () => {
    try {
      return { success: true, config: getProxyConfig() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Update proxy configuration
  ipcMain.handle('proxy:update-config', async (_event, updates) => {
    try {
      updateProxyConfig(updates);
      return { success: true, config: getProxyConfig() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Reset configuration to defaults
  ipcMain.handle('proxy:reset-config', async () => {
    try {
      getConfigManager().resetConfig();
      return { success: true, config: getProxyConfig() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get server info
  ipcMain.handle('proxy:get-server-info', async () => {
    try {
      return { success: true, info: getServerInfo() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get certificate info
  ipcMain.handle('proxy:get-certificate-info', async () => {
    try {
      const certManager = getCertificateManager();
      return {
        success: true,
        info: {
          certPath: certManager.getCertificatePath(),
          keyPath: certManager.getKeyPath(),
          certDir: certManager.getCertificateDir(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Export certificate
  ipcMain.handle('proxy:export-certificate', async () => {
    try {
      const certManager = getCertificateManager();
      const cert = certManager.exportCertificate();
      return { success: true, certificate: cert };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Delete certificates
  ipcMain.handle('proxy:delete-certificates', async () => {
    try {
      const certManager = getCertificateManager();
      certManager.deleteCertificates();
      return { success: true, message: 'Certificates deleted' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Regenerate certificates
  ipcMain.handle('proxy:regenerate-certificates', async () => {
    try {
      const certManager = getCertificateManager();
      certManager.deleteCertificates();
      const certs = await certManager.ensureCertificates();
      return {
        success: true,
        certificates: {
          cert: certs.cert,
          key: certs.key,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Proxy handlers registered');
};
