import { CSSProperties } from 'react';
import {
  CodeBlockSpacing,
  CodeBlockBorder,
  CodeBlockShadow,
  CodeBlockLanguage,
} from './CodeBlock.types';

/**
 * Convert size value to CSS value
 */
export const parseSize = (size: string | number | undefined, defaultValue: string): string => {
  if (!size) return defaultValue;

  if (typeof size === 'number') {
    return `${size}px`;
  }

  // Handle fractions like "1/2", "1/3", "1/4"
  if (size.includes('/')) {
    const [numerator, denominator] = size.split('/').map(Number);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return `${(numerator / denominator) * 100}%`;
    }
  }

  // Handle special values
  if (size === 'full') return '100%';
  if (size === 'screen') return '100vh';
  if (size === 'auto') return 'auto';

  return size;
};

/**
 * Parse spacing values (padding, margin)
 */
export const parseSpacing = (spacing: CodeBlockSpacing | undefined): string => {
  if (!spacing) return '';

  if (spacing.all !== undefined) {
    return parseSize(spacing.all, '');
  }

  const top = spacing.top ? parseSize(spacing.top, '0') : '0';
  const right = spacing.right ? parseSize(spacing.right, '0') : '0';
  const bottom = spacing.bottom ? parseSize(spacing.bottom, '0') : '0';
  const left = spacing.left ? parseSize(spacing.left, '0') : '0';

  return `${top} ${right} ${bottom} ${left}`;
};

/**
 * Parse border properties
 */
export const parseBorder = (border: CodeBlockBorder | undefined): CSSProperties => {
  if (!border) return {};

  const styles: CSSProperties = {};

  if (border.width) {
    (styles as any).borderWidth = parseSpacing(border.width);
  }

  if (border.style) {
    (styles as any).borderStyle = border.style;
  }

  if (border.color) {
    (styles as any).borderColor = border.color;
  }

  if (border.radius) {
    (styles as any).borderRadius = parseSpacing(border.radius);
  }

  return styles;
};

/**
 * Parse shadow properties
 */
export const parseShadow = (shadow: CodeBlockShadow | CodeBlockShadow[] | undefined): string => {
  if (!shadow) return '';

  if (Array.isArray(shadow)) {
    return shadow.map((s) => parseSingleShadow(s)).join(', ');
  }

  return parseSingleShadow(shadow);
};

const parseSingleShadow = (shadow: CodeBlockShadow): string => {
  const offsetX = parseSize(shadow.offsetX, '0');
  const offsetY = parseSize(shadow.offsetY, '0');
  const blur = parseSize(shadow.blur, '0');
  const spread = parseSize(shadow.spread, '0');
  const color = shadow.color || 'rgba(0, 0, 0, 0.1)';
  const inset = shadow.inset ? 'inset ' : '';

  return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
};

/**
 * Get scale value from size percentage
 */
export const getScaleFromSize = (size: number = 100): number => {
  return size / 100;
};

/**
 * Get Monaco language from CodeBlockLanguage
 */
export const getMonacoLanguage = (language: CodeBlockLanguage): string => {
  const languageMap: Record<CodeBlockLanguage, string> = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    java: 'java',
    csharp: 'csharp',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rust: 'rust',
    php: 'php',
    ruby: 'ruby',
    swift: 'swift',
    kotlin: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    markdown: 'markdown',
    sql: 'sql',
    shell: 'shell',
    bash: 'bash',
    powershell: 'powershell',
    dockerfile: 'dockerfile',
    plaintext: 'plaintext',
  };

  return languageMap[language] || 'plaintext';
};

/**
 * Get display name for language
 */
export const getLanguageDisplayName = (language: CodeBlockLanguage): string => {
  const displayNames: Record<CodeBlockLanguage, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    csharp: 'C#',
    cpp: 'C++',
    c: 'C',
    go: 'Go',
    rust: 'Rust',
    php: 'PHP',
    ruby: 'Ruby',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    markdown: 'Markdown',
    sql: 'SQL',
    shell: 'Shell',
    bash: 'Bash',
    powershell: 'PowerShell',
    dockerfile: 'Dockerfile',
    plaintext: 'Plain Text',
  };

  return displayNames[language] || language.toUpperCase();
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

/**
 * Get default Monaco editor options
 */
export const getDefaultMonacoOptions = (props: any): any => {
  // Determine readOnly state: true if readOnly=true OR if editable=false
  const isReadOnly = props.readOnly === true || props.editable === false;

  // Calculate left padding: nếu không có line numbers thì tăng padding left
  const leftPadding = !props.showLineNumbers || !props.showGutter ? 20 : 12;

  return {
    automaticLayout: true,
    scrollBeyondLastLine: false,
    scrollBeyondLastColumn: 0,
    fixedOverflowWidgets: true,
    minimap: {
      enabled: props.showMinimap ?? false,
    },
    lineNumbers: props.showLineNumbers ? 'on' : 'off',
    lineNumbersMinChars: props.showLineNumbers ? 3 : 0,
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    renderValidationDecorations: 'off',
    renderLineHighlightOnlyWhenFocus: !props.showLineHighlight,
    wordWrap: props.wordWrap || 'off',
    fontSize: props.fontSize || 14,
    fontFamily: props.fontFamily || "Consolas, 'Courier New', monospace",
    tabSize: props.tabSize || 2,
    insertSpaces: props.insertSpaces ?? true,
    readOnly: isReadOnly,
    renderLineHighlight: props.showLineHighlight
      ? props.highlightActiveLine
        ? 'all'
        : 'line'
      : 'none',
    theme: props.theme || 'vs-dark',
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      handleMouseWheel: true,
      alwaysConsumeMouseWheel: true,
    },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    guides: {
      indentation: false,
      highlightActiveIndentation: false,
      bracketPairs: false,
      bracketPairsHorizontal: false,
    },
    padding: {
      top: 4,
      bottom: 4,
      left: leftPadding,
    },
    // Tắt validation và error markers
    validate: false,
    semanticHighlighting: {
      enabled: false,
    },
  };
};

/**
 * Build container style
 */
export const getContainerStyle = (props: any): CSSProperties => {
  const baseStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
  };

  // Apply borderRadius
  const borderRadiusValue = parseSize(props.borderRadius, '8px');
  if (borderRadiusValue) {
    (baseStyle as any).borderRadius = borderRadiusValue;
  }

  // Apply opacity
  if (props.opacity !== undefined) {
    (baseStyle as any).opacity = props.opacity;
  }

  // Apply padding
  const paddingValue = parseSpacing(props.padding);
  if (paddingValue) {
    (baseStyle as any).padding = paddingValue;
  }

  // Apply margin
  const marginValue = parseSpacing(props.margin);
  if (marginValue) {
    (baseStyle as any).margin = marginValue;
  }

  // Apply border
  const borderStyles = parseBorder(props.border);
  Object.assign(baseStyle, borderStyles);

  // Apply shadow
  const shadowValue = parseShadow(props.shadow);
  if (shadowValue) {
    (baseStyle as any).boxShadow = shadowValue;
  }

  return baseStyle;
};

/**
 * Count number of lines in code
 */
export const countLines = (code: string): number => {
  if (!code || code.trim() === '') return 1;

  const lines = code.split('\n');
  // Remove empty lines at the end for accurate height calculation
  let lastNonEmptyLine = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') {
      lastNonEmptyLine = i + 1;
      break;
    }
  }

  return Math.max(1, lastNonEmptyLine);
};

/**
 * Get all built-in theme loaders using Vite's glob import
 * Returns object with theme paths as keys and loader functions as values
 */
export const getBuiltInThemes = (): Record<string, () => Promise<any>> => {
  // Use Vite's glob import to load all JSON files in themes folder
  // This is evaluated at build time, so it's safe and efficient
  return import.meta.glob('../../../../constants/themes/*.json');
};
