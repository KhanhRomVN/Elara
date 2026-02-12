import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

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
  const { currentPreset } = useTheme();
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

        const themeName = currentPreset ? `elara-theme-${currentPreset.name}` : 'vs-dark';

        // Always define our custom theme
        if (window.monaco && currentPreset) {
          const customRules =
            themeConfig?.rules?.map((r) => ({
              token: r.token,
              foreground: r.foreground?.replace('#', ''),
              background: r.background?.replace('#', ''),
              fontStyle: r.fontStyle,
            })) || [];

          window.monaco.editor.defineTheme(themeName, {
            base: currentPreset.monaco.base as any,
            inherit: currentPreset.monaco.inherit,
            rules: [...currentPreset.monaco.rules, ...customRules],
            colors: {
              ...currentPreset.monaco.colors,
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
          if (!mounted || className?.includes('h-full')) return;
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
        if (!className?.includes('h-full')) {
          const contentHeight = editorInstance.current.getContentHeight();
          const topPadding = editorOptions?.padding?.top ?? 16;
          const bottomPadding = editorOptions?.padding?.bottom ?? 16;
          const verticalPadding = topPadding + bottomPadding;
          const lineHeight = 19; // Default guess
          const maxHeight = maxLines * lineHeight + verticalPadding;
          setCurrentHeight(Math.min(contentHeight, maxHeight));
        }

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
    // Use JSON.stringify for deep comparison of themeConfig/currentPreset to avoid re-init on every render
  }, [JSON.stringify(themeConfig), currentPreset?.name, language, wordWrap]); // Re-init if config/preset/wrap/language changes

  // Update value
  useEffect(() => {
    if (editorInstance.current && editorInstance.current.getValue() !== code) {
      editorInstance.current.setValue(code);
    }
  }, [code]);

  // Update language dynamically without re-creating editor
  useEffect(() => {
    if (editorReady && editorInstance.current && window.monaco) {
      const model = editorInstance.current.getModel();
      if (model && language) {
        window.monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language, editorReady]);

  // Update theme dynamically
  useEffect(() => {
    if (editorReady && editorInstance.current && window.monaco && currentPreset) {
      const themeName = `elara-theme-${currentPreset.name}`;
      window.monaco.editor.setTheme(themeName);
    }
  }, [currentPreset?.name, editorReady]);

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
        height: className?.includes('h-full') ? '100%' : `${currentHeight}px`,
        minHeight: '20px',
        opacity: currentHeight ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
      }}
    />
  );
};

export { CodeBlock };
