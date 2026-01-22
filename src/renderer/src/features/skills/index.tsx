import { Cpu } from 'lucide-react';

const SkillsPage = () => {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Cpu className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
      </div>

      <div className="bg-muted/30 border border-border rounded-lg p-8 flex-1 flex flex-col items-center justify-center text-center">
        <Cpu className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-xl font-semibold mb-2">Manage your Skills</h2>
        <p className="text-muted-foreground max-w-md">
          Skills are custom toolsets that extend the capabilities of the Elara agent. Manage and
          configure your custom toolsets here.
        </p>
      </div>
    </div>
  );
};

export default SkillsPage;
