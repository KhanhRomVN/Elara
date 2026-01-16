import { Copy } from 'lucide-react';
import { CodeBlock } from '@renderer/core/components/CodeBlock';
import { cn } from '@renderer/shared/lib/utils';
import { toast } from 'sonner';

interface ApiDocItemProps {
  method: string;
  endpoint: string;
  description: string;
  reqHeader?: string;
  reqBody?: string;
  resBody: string;
}

export const ApiDocItem = ({
  method,
  endpoint,
  description,
  reqHeader,
  reqBody,
  resBody,
}: ApiDocItemProps) => {
  const methodColors: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-500',
    POST: 'bg-green-500/10 text-green-500',
    PUT: 'bg-orange-500/10 text-orange-500',
    DELETE: 'bg-red-500/10 text-red-500',
    PATCH: 'bg-yellow-500/10 text-yellow-500',
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(endpoint);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="rounded-lg border bg-card p-6 scroll-mt-6" id={endpoint}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={cn(
              'px-3 py-1 rounded text-sm font-mono font-semibold',
              methodColors[method] || 'bg-gray-500/10 text-gray-500',
            )}
          >
            {method}
          </span>
          <code className="text-xl font-mono break-all">{endpoint}</code>
          <button
            onClick={copyUrl}
            className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {/* Code Blocks */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {reqHeader && (
          <div className="xl:col-span-2">
            <h4 className="text-sm font-semibold mb-2">Request Headers</h4>
            <CodeBlock
              code={reqHeader}
              language="yaml"
              maxLines={10}
              showLineNumbers={false}
              editorOptions={{
                guides: { indentation: false },
                renderLineHighlight: 'none',
                readOnly: true,
                minimap: { enabled: false },
              }}
            />
          </div>
        )}

        {reqBody && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Request Body</h4>
            <CodeBlock
              code={reqBody}
              language="json"
              maxLines={25}
              showLineNumbers={false}
              editorOptions={{
                guides: { indentation: false },
                renderLineHighlight: 'none',
                readOnly: true,
                minimap: { enabled: false },
              }}
            />
          </div>
        )}

        <div className={cn(!reqBody && !reqHeader ? 'xl:col-span-2' : '')}>
          <h4 className="text-sm font-semibold mb-2">Response Body</h4>
          <CodeBlock
            code={resBody}
            language="json"
            maxLines={25}
            showLineNumbers={false}
            editorOptions={{
              guides: { indentation: false },
              renderLineHighlight: 'none',
              readOnly: true,
              minimap: { enabled: false },
            }}
          />
        </div>
      </div>
    </div>
  );
};
