/**
 * Auth Preload Script
 * This script runs in the context of authentication windows to spoof
 * automation indicators and bypass bot detection.
 */

// Spoof navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
});

// Remove automation-related properties
const automationProps = [
  '__webdriver_script_fn',
  '__webdriver_evaluate',
  '__selenium_evaluate',
  '__fxdriver_evaluate',
  '__driver_evaluate',
  '__webdriver_unwrapped',
  '__selenium_unwrapped',
  '__fxdriver_unwrapped',
  '__driver_unwrapped',
  '_Selenium_IDE_Recorder',
  '_selenium',
  'calledSelenium',
  '$cdc_asdjflasutopfhvcZLmcfl_',
  '$chrome_asyncScriptInfo',
  '__$webdriverAsyncExecutor',
  'webdriver',
  '__webdriverFunc',
  'domAutomation',
  'domAutomationController',
];

for (const prop of automationProps) {
  try {
    delete (window as any)[prop];
  } catch {
    // Ignore deletion errors
  }
}

// Override navigator properties to appear more human
Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en', 'vi'],
});

Object.defineProperty(navigator, 'plugins', {
  get: () => [
    {
      0: {
        type: 'application/x-google-chrome-pdf',
        suffixes: 'pdf',
        description: 'Portable Document Format',
      },
      description: 'Portable Document Format',
      filename: 'internal-pdf-viewer',
      length: 1,
      name: 'Chrome PDF Plugin',
    },
    {
      0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
      description: '',
      filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
      length: 1,
      name: 'Chrome PDF Viewer',
    },
    {
      0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
      1: {
        type: 'application/x-pnacl',
        suffixes: '',
        description: 'Portable Native Client Executable',
      },
      description: '',
      filename: 'internal-nacl-plugin',
      length: 2,
      name: 'Native Client',
    },
  ],
});

// Spoof permissions API to avoid detection
const originalQuery = window.navigator.permissions?.query;
if (originalQuery) {
  (window.navigator.permissions as any).query = (parameters: any) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
      : originalQuery(parameters);
}

// Add missing chrome object properties
if (!(window as any).chrome) {
  (window as any).chrome = {};
}
(window as any).chrome.runtime = {};

// Console log for debugging (will be removed in production)
// console.log('[Auth Preload] Bot detection evasion applied');
