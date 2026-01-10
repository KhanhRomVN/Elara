import { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

const N8N_URL = 'http://127.0.0.1:5678';

const WorkflowEditor = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const webviewRef = useRef<Electron.WebviewTag>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        await fetch(N8N_URL, { mode: 'no-cors' });
        setServerReady(true);
      } catch (err) {
        setTimeout(checkServer, 1000);
      }
    };
    checkServer();
  }, []);

  useEffect(() => {
    const webview = webviewRef.current;
    if (webview && serverReady) {
      const handleDomReady = () => setIsLoading(false);
      webview.addEventListener('dom-ready', handleDomReady);
      // Also handle load-fail to potentially retry or show error
      const handleDidFailLoad = () => console.log('Webview failed to load');

      webview.addEventListener('did-fail-load', handleDidFailLoad);

      return () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('did-fail-load', handleDidFailLoad);
      };
    }
    return undefined;
  }, [serverReady]);

  const handleReload = () => {
    if (webviewRef.current) {
      setIsLoading(true);
      webviewRef.current.reload();
    }
  };

  return (
    <div className="h-full w-full relative bg-background flex flex-col">
      {/* Optional Toolbar/Status Bar if needed, but keeping it clean for now */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleReload}
          className="p-2 bg-background/80 backdrop-blur rounded-full shadow-sm hover:bg-muted transition-colors border border-border"
          title="Reload Workflow Engine"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => window.open(N8N_URL, '_blank')}
          className="p-2 bg-background/80 backdrop-blur rounded-full shadow-sm hover:bg-muted transition-colors border border-border mt-2"
          title="Open in Browser"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
          >
            <path
              d="M3 2C2.44772 2 2 2.44772 2 3V12C2 12.5523 2.44772 13 3 13H12C12.5523 13 13 12.5523 13 12V8.5C13 8.22386 13.2239 8 13.5 8C13.7761 8 14 8.22386 14 8.5V12C14 13.1046 13.1046 14 12 14H3C1.89543 14 1 13.1046 1 12V3C1 1.89543 1.89543 1 3 1H6.5C6.77614 1 7 1.22386 7 1.5C7 1.77614 6.77614 2 6.5 2H3ZM12.8536 2.14645C12.9015 2.19439 12.9377 2.24964 12.9621 2.30861C12.9861 2.36669 12.9996 2.4303 13 2.497V2.5V2.50002V5.5C13 5.77614 12.7761 6 12.5 6C12.2239 6 12 5.77614 12 5.5V3.20711L9.35355 5.85355C9.15829 6.04882 8.84171 6.04882 8.64645 5.85355C8.45118 5.65829 8.45118 5.34171 8.64645 5.14645L11.2929 2.5H9C8.72386 2.5 8.5 2.27614 8.5 2C8.5 1.72386 8.72386 1.5 9 1.5H12C12.0667 1.5 12.1303 1.51351 12.1884 1.53753C12.2473 1.56193 12.3026 1.5981 12.3505 1.64605C12.3516 1.6471 12.3526 1.64816 12.3536 1.64922L12.3564 1.65205L12.3636 1.65961L12.3708 1.66759L12.3787 1.67705L12.3854 1.6857L12.3929 1.69619L12.3996 1.70624L12.4069 1.71813C12.4082 1.72037 12.4095 1.72263 12.4107 1.72491L12.4191 1.74104L12.4262 1.75628L12.4332 1.77382L12.4332 1.77389C12.4374 1.78531 12.4411 1.79693 12.4443 1.80875C12.4485 1.82436 12.4519 1.8402 12.4546 1.85624L12.4546 1.85626L12.4578 1.88126L12.4593 1.8972L12.46 1.9135C12.46 1.91501 12.46 1.91652 12.46 1.91803V2.5V2.497C12.4604 2.4303 12.474 2.36669 12.498 2.30861C12.5224 2.24964 12.5585 2.19439 12.6064 2.14645C12.6075 2.14539 12.6085 2.14434 12.6096 2.14328L12.8536 2.14645Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            ></path>
          </svg>
        </button>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Connecting to local workflow engine...</p>
        </div>
      )}

      {serverReady && (
        // @ts-ignore
        <webview
          ref={webviewRef}
          src={N8N_URL}
          className={`w-full h-full border-none flex-1 transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          // @ts-ignore
          allowpopups="true"
          partition="persist:n8n_v2"
        />
      )}
    </div>
  );
};

export default WorkflowEditor;
