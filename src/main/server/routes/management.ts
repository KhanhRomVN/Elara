import express from 'express';
import { getProxyConfig, updateProxyConfig } from '../config';
import { getAccountSelector } from '../account-selector';
import { getCertificateManager } from '../utils/cert-manager';
import { statsManager } from '../../core/stats';

const router = express.Router();

/**
 * GET /v0/management/config
 * Get current proxy configuration
 */
router.get('/config', (_req, res) => {
  try {
    const config = getProxyConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /v0/management/config
 * Update proxy configuration
 */
router.put('/config', (req, res) => {
  try {
    const updates = req.body;
    updateProxyConfig(updates);
    res.json({ success: true, config: getProxyConfig() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v0/management/stats
 * Get proxy statistics
 */
router.get('/stats', (_req, res) => {
  try {
    const stats = statsManager.getStats();
    const selector = getAccountSelector();
    const activeAccounts = selector.getActiveAccounts();

    res.json({
      ...stats,
      activeAccounts: activeAccounts.length,
      accounts: activeAccounts.map((acc) => ({
        id: acc.id,
        email: acc.email,
        provider: acc.provider_id,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /v0/management/stats/reset
 * Reset statistics
 */
router.post('/stats/reset', (_req, res) => {
  try {
    statsManager.reset();
    getAccountSelector().resetCounts();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v0/management/certificate
 * Export certificate for installation
 */
router.get('/certificate', (_req, res) => {
  try {
    const certManager = getCertificateManager();
    const cert = certManager.exportCertificate();

    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="elara-ca.crt"');
    res.send(cert);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v0/management/certificate/info
 * Get certificate information
 */
router.get('/certificate/info', (_req, res) => {
  try {
    const certManager = getCertificateManager();
    res.json({
      certPath: certManager.getCertificatePath(),
      keyPath: certManager.getKeyPath(),
      certDir: certManager.getCertificateDir(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /v0/management/certificate
 * Delete certificates (will regenerate on next start)
 */
router.delete('/certificate', (_req, res) => {
  try {
    const certManager = getCertificateManager();
    certManager.deleteCertificates();
    res.json({
      success: true,
      message: 'Certificates deleted. New ones will be generated on next HTTPS start.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v0/management/accounts
 * Get all accounts with request counts
 */
router.get('/accounts', (_req, res) => {
  try {
    const selector = getAccountSelector();
    const accounts = selector.getActiveAccounts();

    res.json(
      accounts.map((acc) => ({
        id: acc.id,
        email: acc.email,
        provider: acc.provider_id,
        status: 'Active',
        requestCount: selector.getRequestCount(acc.id),
      })),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /v0/management/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
