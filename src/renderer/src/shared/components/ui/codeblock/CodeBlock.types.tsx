import { ReactNode } from 'react';

export type CodeBlockLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'c'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'html'
  | 'css'
  | 'scss'
  | 'less'
  | 'json'
  | 'xml'
  | 'yaml'
  | 'markdown'
  | 'sql'
  | 'shell'
  | 'bash'
  | 'powershell'
  | 'dockerfile'
  | 'plaintext';

export interface CodeBlockItem {
  id?: string;
  code: string;
  language: CodeBlockLanguage;
  title?: ReactNode;
  filename?: string;
  icon?: ReactNode; // Custom icon if needed, otherwise inferred from filename
}

export type CodeBlockHeaderStyle = 'tab' | 'dropdown';

export interface CodeBlockToolbarAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface CodeBlockProps {
  /**
   * Code content to display (Simplified for single file)
   */
  code?: string;
  /**
   * Language of the code (Simplified for single file)
   */
  language?: CodeBlockLanguage;
  /**
   * Title/Filename to display (Simplified for single file)
   */
  title?: ReactNode;
  /**
   * Filename for icon detection (Simplified for single file)
   */
  filename?: string;

  /**
   * List of code items to display (For multi-file support)
   */
  items?: CodeBlockItem[];
  /**
   * Style of the header navigation when multiple items are present
   * @default "tab"
   */
  headerStyle?: CodeBlockHeaderStyle;

  /**
   * Theme for the editor
   * @default "vs-dark"
   */
  theme?: string;
  /**
   * Width of the code block
   * @default "100%"
   */
  width?: string | number;
  /**
   * Scale size of the code block (percentage)
   * @default 100
   */
  size?: number;

  /**
   * Additional class name for container
   */
  className?: string;

  /**
   * Whether to allow editing
   * @default false
   */
  editable?: boolean;

  // Display Options
  showLineNumbers?: boolean;
  showGutter?: boolean;
  showLineHighlight?: boolean;
  showMinimap?: boolean;
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';

  // Font Options
  fontSize?: number;
  fontFamily?: string;

  // Format Options
  tabSize?: number;
  insertSpaces?: boolean;

  // Behavior Options
  readOnly?: boolean;
  autoFocus?: boolean;
  highlightActiveLine?: boolean;

  // Header/Toolbar Options
  showToolbar?: boolean;
  showCopyButton?: boolean;
  showLanguageTag?: boolean;
  showFileIcon?: boolean;
  showDivider?: boolean; // New prop for divider
  toolbarActions?: CodeBlockToolbarAction[];

  // Events
  onCopy?: () => void;
  onChange?: (value: string) => void;
  onItemChange?: (item: CodeBlockItem) => void;

  // Styles
  padding?: CodeBlockSpacing;
  margin?: CodeBlockSpacing;
  border?: CodeBlockBorder;
  shadow?: CodeBlockShadow | CodeBlockShadow[];
  backgroundColor?: string;
  toolbarBackgroundColor?: string;
  borderRadius?: string | number;
  opacity?: number;

  // Advanced
  monacoOptions?: any;
  lineDecorations?: any[];
  scrollToLine?: number;
  highlightedLines?: number[];

  // Loading
  loading?: boolean;
  loadingComponent?: ReactNode;

  // Debug
  debug?: boolean;

  // Deprecated props that might be still used internally or by consumers during migration
  headerMode?: any;
  headerIcon?: any;
  filePath?: any;
  tabs?: any;
  activeTabId?: any;
  onTabChange?: any;
  children?: ReactNode;
}

export interface CodeBlockContextValue {
  activeItem: CodeBlockItem;
  setActiveItem: (id: string) => void;
  items: CodeBlockItem[];
  theme: string;
  customTheme: string | null;
  themeColors: any | null;
  copied: boolean;
  setCopied: (copied: boolean) => void;
  props: CodeBlockProps;
}

export type CodeBlockSpacing = {
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  all?: string | number;
};

export type CodeBlockBorder = {
  width?: CodeBlockSpacing;
  style?:
    | 'solid'
    | 'dashed'
    | 'dotted'
    | 'double'
    | 'groove'
    | 'ridge'
    | 'inset'
    | 'outset'
    | 'none'
    | 'hidden';
  color?: string;
  radius?: CodeBlockSpacing;
};

export type CodeBlockShadow = {
  offsetX?: string | number;
  offsetY?: string | number;
  blur?: string | number;
  spread?: string | number;
  color?: string;
  inset?: boolean;
};

export interface CodeBlockThemeData {
  name: string;
  type: 'light' | 'dark' | 'hc';
  colors: Record<string, string>;
  tokenColors: any[];
  semanticHighlighting?: boolean;
  semanticTokenColors?: any;
}
