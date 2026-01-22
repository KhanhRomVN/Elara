import { Share2 } from 'lucide-react';

const MCPPage = () => {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Share2 className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">MCP</h1>
      </div>

      <div className="bg-muted/30 border border-border rounded-lg p-8 flex-1 flex flex-col items-center justify-center text-center">
        <Share2 className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-xl font-semibold mb-2">Model Context Protocol</h2>
        <p className="text-muted-foreground max-w-md">
          Connect to external data sources using the Model Context Protocol. Configure your GitHub,
          Slack, Linear, and other integrations here.
        </p>
      </div>
    </div>
  );
};

export default MCPPage;
