import React, { useEffect, useRef } from 'react';

// Define Window interface to include require for AMD loader
declare global {
  interface Window {
    require: any;
    monaco: any;
    monacoLoadingPromise?: Promise<void>;
  }
}

export interface CodeBlockThemeRule {
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

export interface CodeBlockThemeConfig {
  background?: string;
  foreground?: string;
  rules?: CodeBlockThemeRule[];
  highlightLine?: number;
}

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  themeConfig?: CodeBlockThemeConfig;
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  showLineNumbers?: boolean;
  onEditorMounted?: (editor: any) => void;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  maxLines?: number; // Maximum number of lines to display
  editorOptions?: any; // Additional Monaco editor options
}

const SYSTEMA_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'string.key.json', foreground: 'a78bfa' }, // Light Purple for keys
    { token: 'string.value.json', foreground: '38bdf8' }, // Sky Blue for string values
    { token: 'number', foreground: 'f472b6' }, // Pink for numbers
    { token: 'keyword.json', foreground: '818cf8' }, // Indigo for keywords (true/false/null)
    { token: 'delimiter', foreground: '94a3b8' }, // Slate Grey for delimiters
    { token: 'comment', foreground: '64748b', fontStyle: 'italic' }, // Slate for comments
  ],
  colors: {
    'editor.background': '#020617', // Deep blue-black (slate-950)
    'editor.foreground': '#e2e8f0', // Slate-200
    'editorLineNumber.foreground': '#475569', // Slate-600
    'editor.lineHighlightBackground': '#1e293b', // Slate-800
    'editorCursor.foreground': '#38bdf8', // Sky blue cursor
    'editor.selectionBackground': '#3b82f640', // Blue selection
  },
};

const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'json',
  className,
  themeConfig,
  wordWrap = 'on',
  showLineNumbers = false,
  onEditorMounted,
  readOnly = true,
  onChange,
  maxLines = 50,
  editorOptions = {},
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<any>(null);

  // Calculate height based on number of lines
  const calculateHeight = (content: string, max: number) => {
    const lines = content.split('\n').length;
    const displayLines = Math.min(lines, max);
    const lineHeight = 19; // Monaco default line height
    const verticalPadding = 32; // Top + bottom padding (16px each)
    const scrollbarHeight = lines > max ? 14 : 0; // Add scrollbar height if content exceeds max
    return displayLines * lineHeight + verticalPadding + scrollbarHeight;
  };

  const editorHeight = calculateHeight(code, maxLines);

  useEffect(() => {
    let mounted = true;

    const initMonaco = () => {
      if (!editorRef.current) return;

      try {
        if (editorInstance.current) {
          editorInstance.current.dispose();
        }

        let themeName = 'systema-dark';

        // Always define our custom theme
        if (window.monaco) {
          const customRules =
            themeConfig?.rules?.map((r) => ({
              token: r.token,
              foreground: r.foreground?.replace('#', ''),
              background: r.background?.replace('#', ''),
              fontStyle: r.fontStyle,
            })) || [];

          window.monaco.editor.defineTheme(themeName, {
            ...SYSTEMA_THEME,
            rules: [...SYSTEMA_THEME.rules, ...customRules], // Allow overrides
            colors: {
              ...SYSTEMA_THEME.colors,
              ...(themeConfig?.background ? { 'editor.background': themeConfig.background } : {}),
              ...(themeConfig?.foreground ? { 'editor.foreground': themeConfig.foreground } : {}),
            },
          });
        }

        editorInstance.current = window.monaco.editor.create(editorRef.current, {
          value: code,
          language: language,
          theme: themeName,
          readOnly: readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          wordWrap: wordWrap,
          lineNumbers: showLineNumbers ? 'on' : 'off',
          ...editorOptions, // Allow custom options to override defaults
        });

        // Expose editor instance
        if (onEditorMounted) {
          onEditorMounted(editorInstance.current);
        }

        if (onChange) {
          editorInstance.current.onDidChangeModelContent(() => {
            onChange(editorInstance.current.getValue());
          });
        }
      } catch (error) {
        console.error('Failed to create monaco editor instance:', error);
      }
    };
    // ... loadMonaco logic ...
    // ... loadMonaco logic ...
    const loadMonaco = () => {
      if (window.monaco) {
        initMonaco();
        return;
      }

      // Check global loading state to prevent race conditions
      if (!window.monacoLoadingPromise) {
        window.monacoLoadingPromise = new Promise((resolve) => {
          // If loader script is already in DOM but we don't have the promise (e.g. from server-side or previous run), find it
          const existingScript = document.querySelector('script[src*="vscode/loader.js"]');
          if (existingScript || window.require) {
            // Wait for window.require if it's not ready, then config
            const waitForRequire = setInterval(() => {
              if (window.require) {
                clearInterval(waitForRequire);
                resolve();
              }
            }, 50);
            return;
          }

          const script = document.createElement('script');
          script.src = '/monaco/vs/loader.js';
          script.async = true;
          script.onload = () => resolve();
          document.body.appendChild(script);
        });
      }

      // Wait for loader to be ready
      window.monacoLoadingPromise
        .then(() => {
          if (window.require) {
            window.require.config({ paths: { vs: '/monaco/vs' } });
            window.require(
              ['vs/editor/editor.main'],
              () => {
                if (mounted) initMonaco();
              },
              (err: any) => {
                console.error('Failed to load monaco editor modules:', err);
              },
            );
          }
        })
        .catch((err) => {
          console.warn('Monaco loading promise failed or cancelled:', err);
        });
    };

    loadMonaco();

    return () => {
      mounted = false;
      if (editorInstance.current) {
        editorInstance.current.dispose();
      }
    };
    // Use JSON.stringify for deep comparison of themeConfig to avoid re-init on every render if object reference changes but content doesn't
  }, [JSON.stringify(themeConfig), wordWrap]); // Re-init if config/wrap changes

  // Update value
  useEffect(() => {
    if (editorInstance.current && editorInstance.current.getValue() !== code) {
      editorInstance.current.setValue(code);
    }
  }, [code]);

  // Update word wrap dynamically
  useEffect(() => {
    if (editorInstance.current) {
      editorInstance.current.updateOptions({ wordWrap });
    }
  }, [wordWrap]);

  // Handle line highlighting
  useEffect(() => {
    let decorations: string[] = [];

    if (
      editorInstance.current &&
      showLineNumbers &&
      typeof themeConfig?.highlightLine === 'number'
    ) {
      const line = themeConfig.highlightLine;
      const editor = editorInstance.current;

      // Clear previous decorations/collections if we stored them (simple version: just overwrite)
      decorations = editor.deltaDecorations(
        [],
        [
          {
            range: new window.monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: true,
              className: 'monaco-highlight-line bg-yellow-500/20', // Tailwind class might not work inside shadow DOM/iframe if Monaco isolates, but usually works in DOM mode
              inlineClassName: 'font-bold',
            },
          },
        ],
      );

      editor.revealLineInCenter(line);
    }

    // Always return cleanup function
    return () => {
      if (editorInstance.current && decorations.length > 0) {
        editorInstance.current.deltaDecorations(decorations, []);
      }
    };
  }, [themeConfig?.highlightLine, showLineNumbers]);

  return (
    <div
      ref={editorRef}
      className={`w-full ${className || ''}`}
      style={{ height: `${editorHeight}px` }}
    />
  );
};

export { CodeBlock };
