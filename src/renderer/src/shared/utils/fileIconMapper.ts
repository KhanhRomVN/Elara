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
