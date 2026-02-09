import React, { useRef, useMemo } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useCodeBlock } from './CodeBlockContext';
import { countLines, getMonacoLanguage, getDefaultMonacoOptions } from './CodeBlock.utils';

const CodeBlockBody: React.FC = () => {
  const { activeItem, props, theme } = useCodeBlock();
  const {
    showMinimap,
    showLineNumbers,
    showGutter,
    showLineHighlight,
    wordWrap,
    fontSize,
    fontFamily,
    tabSize,
    insertSpaces,
    readOnly,
    editable,
    highlightActiveLine,
    monacoOptions = {},
    lineDecorations = [],
    scrollToLine,
    highlightedLines = [],
    loading,
    loadingComponent,
    autoFocus,
    onChange,
    // debug = false, // unused
  } = props;

  // Use theme and colors from context
  const { customTheme, themeColors } = useCodeBlock();

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  // const monaco = useMonaco(); // unused
  // Determine language and code
  const currentLanguage = activeItem.language;
  const currentCode = activeItem.code;

  // Calculate height
  const lineCount = countLines(currentCode);
  const maxLines = 20;
  const lineHeight = 19;
  const editorTopPadding = 4;
  const editorBottomPadding = 4;
  const displayLines = Math.min(lineCount, maxLines);
  const minHeight = lineHeight + editorTopPadding + editorBottomPadding;
  const calculatedHeight = displayLines * lineHeight + editorTopPadding + editorBottomPadding;
  const finalHeight = `${Math.ceil(Math.max(minHeight, calculatedHeight))}px`;

  // Handle Editor Mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (autoFocus) editor.focus();
    if (scrollToLine) {
      editor.revealLineInCenter(scrollToLine);
      editor.setPosition({ lineNumber: scrollToLine, column: 1 });
    }

    // Apply decorations
    if (lineDecorations.length > 0) {
      const decorations = lineDecorations.map((dec) => ({
        range: new monaco.Range(dec.line, 1, dec.line, 1),
        options: {
          isWholeLine: true,
          className: dec.className || 'line-decoration',
          linesDecorationsClassName: dec.className || 'line-decoration',
          ...(dec.backgroundColor && {
            backgroundColor: dec.backgroundColor,
          }),
        },
      }));
      editor.deltaDecorations([], decorations);
    }

    // Highlight lines
    if (highlightedLines.length > 0) {
      const decorations = highlightedLines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'highlighted-line',
          linesDecorationsClassName: 'highlighted-line-decoration',
        },
      }));
      editor.deltaDecorations([], decorations);
    }
  };

  const handleEditorChange: OnChange = (value) => {
    onChange?.(value || '');
  };

  // Build options
  const editorOptions = useMemo(
    () => ({
      ...getDefaultMonacoOptions({
        showMinimap,
        showLineNumbers,
        showGutter,
        showLineHighlight,
        wordWrap,
        fontSize,
        fontFamily,
        tabSize,
        insertSpaces,
        readOnly,
        editable,
        highlightActiveLine,
        theme: customTheme || theme,
      }),
      ...monacoOptions,
    }),
    [
      showMinimap,
      showLineNumbers,
      showGutter,
      showLineHighlight,
      wordWrap,
      fontSize,
      fontFamily,
      tabSize,
      insertSpaces,
      readOnly,
      editable,
      highlightActiveLine,
      theme,
      customTheme,
      monacoOptions,
    ],
  );

  return (
    <div
      style={{
        height: finalHeight,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {loading ? (
        <div
          className="flex items-center justify-center h-full"
          style={{
            backgroundColor:
              themeColors?.['editor.background'] || (theme === 'vs-dark' ? '#1e1e1e' : '#ffffff'),
            color: themeColors?.['editor.foreground'] || '#888',
          }}
        >
          {loadingComponent || 'Loading...'}
        </div>
      ) : (
        <Editor
          height="100%"
          defaultLanguage={getMonacoLanguage(currentLanguage)}
          language={getMonacoLanguage(currentLanguage)}
          value={currentCode}
          theme={customTheme || theme || 'vs-dark'}
          options={editorOptions}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          loading={<div style={{ color: '#888', padding: '1rem' }}>Loading Editor...</div>}
        />
      )}
      <style>{`
        .highlighted-line {
          background-color: rgba(255, 255, 0, 0.1) !important;
        }
        .highlighted-line-decoration {
          background-color: rgba(255, 255, 0, 0.3) !important;
          width: 3px !important;
        }
        .line-decoration {
          background-color: rgba(255, 0, 0, 0.1) !important;
        }
        .monaco-editor .margin {
          padding-left: 8px !important;
        }
        .monaco-editor .margin .line-numbers {
          padding-right: 8px !important;
        }
        .monaco-editor .lines-content {
          padding-left: 16px !important;
        }
      `}</style>
    </div>
  );
};

export default CodeBlockBody;
