import { contextBridge, ipcRenderer } from 'electron';

Object.defineProperty(navigator, 'webdriver', {
  get: () => undefined,
});

contextBridge.exposeInMainWorld('electronAPI', {
  streamChunk: (payload: any) => ipcRenderer.send('chatgpt:stream-chunk', payload),
  streamError: (payload: any) => ipcRenderer.send('chatgpt:stream-error', payload),
  streamEnd: (payload: any) => ipcRenderer.send('chatgpt:stream-end', payload),
  log: (payload: any) => ipcRenderer.send('chatgpt:log', payload),
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
  } catch {}
}

// Monkey-patch window.fetch to capture ChatGPT conversation streams
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = resource.toString();

  const response = await originalFetch(...args);

  if (url.includes('/backend-api/conversation')) {
    console.log(`[Preload] Fetch response: ${url} Status: ${response.status}`);
  }

  // Intercept conversation requests
  if (url.includes('/backend-api/conversation') && config?.method === 'POST') {
    const clone = response.clone();
    const reader = clone.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      // Find the requestId from the request body if possible, or use a heuristic
      // Since we can't easily link request ID here without passing it in headers (which we don't control from UI click),
      // we might need a mechanism.
      // For now, let's emit a specific event that the main process can correlate.
      // Actually, we can just emit 'chatgpt:stream-chunk' with a implicit ID or just broadcast.
      // The worker expects a requestId.
      // Let's assume there is only one active request at a time for this worker.

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.message?.content?.parts?.[0]) {
                    const text = data.message.content.parts[0];
                    // Send to main process. We use a special 'latest' ID or handle in main.
                    ipcRenderer.send('chatgpt:stream-chunk', { requestId: 'latest', text });
                  }
                } catch (e) {}
              }
            }
          }
          ipcRenderer.send('chatgpt:stream-end', { requestId: 'latest' });
        } catch (err: any) {
          ipcRenderer.send('chatgpt:stream-error', { requestId: 'latest', error: err.message });
        }
      })();
    }
  }

  return response;
};

if (!(window as any).chrome) {
  (window as any).chrome = {};
}
(window as any).chrome.runtime = {};
