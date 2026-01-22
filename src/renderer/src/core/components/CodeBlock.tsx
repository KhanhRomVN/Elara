import React, { useEffect, useRef, useState } from 'react';

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

export interface CodeBlockDecoration {
  startLine: number;
  endLine: number;
  className: string;
  isWholeLine?: boolean;
  glyphMarginClassName?: string;
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
  disableClick?: boolean; // New prop to disable interaction
  decorations?: CodeBlockDecoration[];
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
  disableClick = false,
  decorations,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<any>(null);
  const [currentHeight, setCurrentHeight] = useState<number>(0);
  const [editorReady, setEditorReady] = useState(false);
  const decorationIds_ = useRef<string[]>([]);

  // Initial estimate to avoid huge layout shift before Monaco loads
  useEffect(() => {
    if (!currentHeight) {
      const lines = code.split('\n').length;
      const estimatedLines = Math.min(lines, maxLines);
      const topPadding = editorOptions?.padding?.top ?? 16;
      const bottomPadding = editorOptions?.padding?.bottom ?? 16;
      const verticalPadding = topPadding + bottomPadding;
      setCurrentHeight(estimatedLines * 19 + verticalPadding);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initMonaco = () => {
      if (!editorRef.current) return;

      try {
        if (editorInstance.current) {
          editorInstance.current.dispose();
        }

        const themeName = 'systema-dark';

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

        const options = {
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
        };

        // If click disabled, add specific options to hide cursor/selection look
        if (disableClick) {
          options.matchBrackets = 'never';
          options.renderLineHighlight = 'none';
          options.occurrencesHighlight = false;
          options.selectionHighlight = false;
          options.hideCursorInOverviewRuler = true;
          options.domReadOnly = true;
        }

        editorInstance.current = window.monaco.editor.create(editorRef.current, options);

        if (mounted) {
          setEditorReady(true);
        }

        // Dynamic height adjustment
        editorInstance.current.onDidContentSizeChange((e: any) => {
          if (!mounted) return;
          const topPadding = editorOptions?.padding?.top ?? 16;
          const bottomPadding = editorOptions?.padding?.bottom ?? 16;
          const verticalPadding = topPadding + bottomPadding;

          // Calculate max height in pixels = maxLines * lineHeight + padding
          const lineHeight = editorInstance.current.getOption(
            window.monaco.editor.EditorOption.lineHeight,
          );
          const maxHeight = maxLines * lineHeight + verticalPadding;

          const contentHeight = e.contentHeight;
          const newHeight = Math.min(contentHeight, maxHeight);

          // Only update if difference > 1px to avoid loops
          if (Math.abs(newHeight - currentHeight) > 1) {
            setCurrentHeight(newHeight);
            editorInstance.current.layout();
          }
        });

        // Initialize height immediately
        const contentHeight = editorInstance.current.getContentHeight();
        const topPadding = editorOptions?.padding?.top ?? 16;
        const bottomPadding = editorOptions?.padding?.bottom ?? 16;
        const verticalPadding = topPadding + bottomPadding;
        const lineHeight = 19; // Default guess
        const maxHeight = maxLines * lineHeight + verticalPadding;
        setCurrentHeight(Math.min(contentHeight, maxHeight));

        // Expose editor instance
        if (onEditorMounted) {
          onEditorMounted(editorInstance.current);
        }

        if (onChange) {
          editorInstance.current.onDidChangeModelContent(() => {
            if (mounted) onChange(editorInstance.current.getValue());
          });
        }
      } catch (error) {
        console.error('Failed to create monaco editor instance:', error);
      }
    };

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

  // Handle decorations
  useEffect(() => {
    if (!editorReady || !editorInstance.current || !decorations) return;

    // Map props to Monaco decorations
    const newDecorations = decorations.map((d) => ({
      range: new window.monaco.Range(d.startLine, 1, d.endLine, 1),
      options: {
        isWholeLine: d.isWholeLine !== false,
        className: d.className,
        glyphMarginClassName: d.glyphMarginClassName,
      },
    }));

    // Apply decorations
    decorationIds_.current = editorInstance.current.deltaDecorations(
      decorationIds_.current,
      newDecorations,
    );
  }, [decorations, editorReady]);

  return (
    <div
      ref={editorRef}
      className={className}
      style={{
        height: `${currentHeight}px`,
        minHeight: '20px',
        opacity: currentHeight ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
      }}
    />
  );
};

export { CodeBlock };
