/**
 * File Extension to Icon Mapper
 * Maps file extensions and filenames to vscode-icons SVG files
 * using vscode-icons-js package
 */
import {
  getIconForFile,
  DEFAULT_FILE,
  DEFAULT_FOLDER,
  DEFAULT_FOLDER_OPENED,
} from 'vscode-icons-js';

/**
 * Get icon filename for a given file
 * @param filename - The filename (with or without path)
 * @returns SVG icon filename
 */
export function getFileIcon(filename: string): string {
  // Extract just the filename without path
  const name = filename.split('/').pop() || filename;
  const icon = getIconForFile(name);
  return icon || DEFAULT_FILE;
}

/**
 * Get full icon path for use in img src
 * @param filename - The filename
 * @returns Full path to icon SVG
 */
export function getFileIconPath(filename: string): string {
  const iconName = getFileIcon(filename);
  return new URL(`../../assets/icons/${iconName}`, import.meta.url).href;
}

/**
 * Get folder icon
 * @param isOpen - Whether folder is open
 * @returns SVG icon filename
 */
export function getFolderIcon(isOpen: boolean = false): string {
  return isOpen ? DEFAULT_FOLDER_OPENED : DEFAULT_FOLDER;
}

/**
 * Get full folder icon path
 * @param isOpen - Whether folder is open
 * @returns Full path to folder icon SVG
 */
export function getFolderIconPath(isOpen: boolean = false): string {
  const iconName = getFolderIcon(isOpen);
  return new URL(`../../assets/icons/${iconName}`, import.meta.url).href;
}

/**
 * Get provider icon path
 * @param provider - The provider name (e.g. openai, anthropic, google)
 * @returns Full path to provider icon SVG
 */
export function getProviderIconPath(provider: string): string {
  const normalized = provider.toLowerCase();

  let iconName = 'openai.svg'; // Default fallback

  if (normalized.includes('claude') || normalized.includes('anthropic')) {
    iconName = 'claude.svg';
  } else if (normalized.includes('gemini') || normalized.includes('google')) {
    iconName = 'gemini.svg';
  } else if (normalized.includes('deepseek')) {
    iconName = 'deepseek.svg';
  } else if (normalized.includes('grok') || normalized.includes('xai')) {
    iconName = 'grok.svg';
  } else if (normalized.includes('openai') || normalized.includes('gpt')) {
    iconName = 'openai.svg';
  }

  // Provider icons seem to be in a subfolder 'provider_icons' based on original code,
  // but let's assume they are structured similarly or I need to check `provider_icons` folder?
  // The Sidebar imported them from `../../../assets/provider_icons/`.
  // So they are in `src/renderer/src/assets/provider_icons`.
  // My relative path from `utils` (shared/utils) to assets is `../../assets`.
  return new URL(`../../assets/provider_icons/${iconName}`, import.meta.url).href;
}
