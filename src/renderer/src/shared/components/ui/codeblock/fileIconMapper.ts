import { getIconForFile } from 'vscode-icons-js';

// Helper to get icon URL from local assets
const getIconPath = (iconName: string): string => {
  // Assuming icons are served from /src/images/icons/
  // In a Vite app, we might need to import them dynamically or use a public URL.
  // For now, let's assume dynamic import or direct path if possible.
  // Given the extensive list, dynamic import using Vite's glob is best or just construction if assets are public.
  // However, the user environment shows them in src/images/icons.
  // Let's trying strictly mapping the name to the file in that directory.

  // Note: vscode-icons-js returns names like "typescript", "javascript", etc.
  // The files are named "file_type_typescript.svg".

  return new URL(`../../../../../images/icons/${iconName}`, import.meta.url).href;
};

export const getFileIcon = (filename: string): string => {
  const iconName = getIconForFile(filename);
  // vscode-icons-js returns the icon filename usually, e.g. "default_file.svg" or "file_type_typescript.svg"

  return getIconPath(iconName || 'default_file.svg');
};
