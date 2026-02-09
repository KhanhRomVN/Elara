export { default as CodeBlock } from './CodeBlock';
export { default as CodeBlockHeader } from './CodeBlockHeader';
export { default as CodeBlockBody } from './CodeBlockBody';
export type {
  CodeBlockProps,
  CodeBlockLanguage,
  CodeBlockItem, // Replaces CodeBlockTheme, CodeBlockTab
  CodeBlockHeaderStyle, // Replaces CodeBlockHeaderMode
  CodeBlockToolbarAction, // Replaces CodeBlockToolbarConfig
  CodeBlockSpacing,
  CodeBlockBorder,
  CodeBlockShadow,
} from './CodeBlock.types';
export {
  parseSize,
  parseSpacing,
  parseBorder,
  parseShadow,
  getScaleFromSize,
  getMonacoLanguage,
  getLanguageDisplayName,
  copyToClipboard,
  getDefaultMonacoOptions,
  getContainerStyle,
  countLines,
  getBuiltInThemes,
} from './CodeBlock.utils';
