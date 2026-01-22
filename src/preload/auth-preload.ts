import { contextBridge } from 'electron';

Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
});

contextBridge.exposeInMainWorld('electronAPI', {});

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
  } catch {}
}

// Monkey-patch window.fetch to capture conversation streams
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  return response;
};

if (!(window as any).chrome) {
  (window as any).chrome = {};
}
(window as any).chrome.runtime = {};
