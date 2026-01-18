import { X, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CodeBlock } from '../../../core/components/CodeBlock';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';

interface FilePreviewModalProps {
  file: File | { name: string; type: string; url?: string; size?: number } | null;
  onClose: () => void;
}

export const FilePreviewModal = ({ file, onClose }: FilePreviewModalProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isImage = file?.type.startsWith('image/') || file?.type === 'image';

  useEffect(() => {
    if (!file) {
      setContent(null);
      return;
    }

    if (isImage) {
      if (file instanceof File) {
        const url = URL.createObjectURL(file);
        setContent(url);
        return () => URL.revokeObjectURL(url);
      } else if ('url' in file && file.url) {
        setContent(file.url);
      }
      return;
    }

    if (file instanceof File) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setContent(e.target?.result as string);
        setLoading(false);
      };
      reader.onerror = () => {
        setContent('Error reading file.');
        setLoading(false);
      };
      reader.readAsText(file);
    } else {
      setContent(null);
    }
    return undefined;
  }, [file, isImage]);

  if (!file) return null;

  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescript';
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'c':
        return 'c';
      case 'cpp':
        return 'cpp';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in-0">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-background border rounded-lg shadow-lg max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-muted/20">
          <div className="flex items-center gap-3 truncate">
            <img
              src={getFileIconPath(file.name)}
              alt="File Icon"
              className="w-6 h-6 shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                // Fallback handled by adjacent icon if needed, or just hide
              }}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {((file.size || 0) / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/10 min-h-[200px] flex flex-col relative">
          {isImage && content ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={content}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-md shadow-sm"
              />
            </div>
          ) : content && !loading ? (
            <div className="w-full h-full overflow-auto">
              <CodeBlock
                code={content}
                language={getLanguage(file.name)}
                readOnly={true}
                maxLines={5000}
                className="min-h-full"
                showLineNumbers={false}
                editorOptions={{
                  // Disable indentation guides (vertical lines)
                  guides: {
                    indentation: false,
                    bracketPairs: false,
                    highlightActiveIndentation: false,
                  },
                  // Disable line highlighting
                  renderLineHighlight: 'none',
                  // Disable cursor
                  cursorStyle: 'line-thin',
                  cursorBlinking: 'solid',
                  // Make completely non-interactive
                  domReadOnly: true,
                  // Disable selection decorations
                  selectionHighlight: false,
                  occurrencesHighlight: false,
                  // Disable hover
                  hover: { enabled: false },
                  // Hide minimap just in case (already disabled in component likely but explicit is safe)
                  minimap: { enabled: false },
                }}
              />
            </div>
          ) : loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading content...</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileText className="w-12 h-12 opacity-20" />
                <p>Preview not available for this file type.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
