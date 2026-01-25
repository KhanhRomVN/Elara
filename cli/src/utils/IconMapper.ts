export const getIconForFile = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    // JavaScript / TypeScript
    case 'js':
      return '';
    case 'mjs':
      return '';
    case 'cjs':
      return '';
    case 'ts':
      return '';
    case 'tsx':
      return '';
    case 'jsx':
      return '';

    // Web
    case 'html':
      return '';
    case 'css':
      return '';
    case 'scss':
      return '';
    case 'less':
      return '';
    case 'json':
      return '';
    case 'xml':
      return '';
    case 'yaml':
      return '';
    case 'yml':
      return '';

    // Backend / Systems
    case 'py':
      return '';
    case 'rs':
      return '';
    case 'go':
      return '';
    case 'java':
      return '';
    case 'c':
      return '';
    case 'cpp':
      return '';
    case 'cs':
      return ''; // C#
    case 'php':
      return '';
    case 'rb':
      return ''; // Ruby

    // Shell / Config
    case 'sh':
      return '';
    case 'bash':
      return '';
    case 'zsh':
      return '';
    case 'env':
      return '';
    case 'ini':
      return '';
    case 'toml':
      return '';
    case 'dockerfile':
      return '';

    // Markdown / Docs
    case 'md':
      return '';
    case 'txt':
      return '';
    case 'pdf':
      return '';

    // Images
    case 'png':
      return '';
    case 'jpg':
      return '';
    case 'jpeg':
      return '';
    case 'svg':
      return '';
    case 'gif':
      return '';

    // Database
    case 'sql':
      return '';
    case 'db':
      return '';
    case 'sqlite':
      return '';

    // Git
    case 'gitignore':
      return '';
    case 'gitattributes':
      return '';

    default:
      return ''; // Default file icon
  }
};
