import React, { useState, useEffect } from 'react';
import { Plus, Folder, Trash2, ExternalLink, Search, Clock } from 'lucide-react';
import { Project } from './types';
import { cn } from '../../shared/lib/utils';
import { toast } from 'sonner';

const IDEManagementPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const savedProjects = localStorage.getItem('elara-ide-projects');
    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    }
  }, []);

  const saveProjects = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('elara-ide-projects', JSON.stringify(updatedProjects));
  };

  const handleAddProject = async () => {
    try {
      const result = await window.api.dialog.openDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        const projectName = folderPath.split(/[\\/]/).pop() || folderPath;

        // Check if already exists
        if (projects.some((p) => p.path === folderPath)) {
          toast.error('Project already exists');
          return;
        }

        const newProject: Project = {
          id: crypto.randomUUID(),
          name: projectName,
          path: folderPath,
          lastOpened: Date.now(),
        };

        const updatedProjects = [newProject, ...projects];
        saveProjects(updatedProjects);
        toast.success(`Project ${projectName} added`);
      }
    } catch (error) {
      console.error('Failed to add project:', error);
      toast.error('Failed to add project');
    }
  };

  const handleRemoveProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedProjects = projects.filter((p) => p.id !== id);
    saveProjects(updatedProjects);
    toast.success('Project removed');
  };

  const handleOpenProject = async (project: Project) => {
    try {
      // Update last opened
      const updatedProjects = projects
        .map((p) => (p.id === project.id ? { ...p, lastOpened: Date.now() } : p))
        .sort((a, b) => b.lastOpened - a.lastOpened);

      saveProjects(updatedProjects);

      await window.api.ide.openWindow(project.path);
    } catch (error) {
      console.error('Failed to open project:', error);
      toast.error('Failed to open project');
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-100 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">IDE Projects</h1>
          <p className="text-zinc-400">Manage your project workspaces and open them in Elara IDE</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                // Get absolute path to temp/zed
                const projectPath = '/home/khanhromvn/Documents/Coding/Elara/temp/zed';
                await window.api.ide.openWindow(projectPath);
              } catch (error) {
                console.error('Failed to open temp/zed:', error);
                toast.error('Failed to open temp/zed');
              }
            }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-all font-medium border border-zinc-700"
          >
            <ExternalLink size={20} />
            Open temp/zed
          </button>
          <button
            onClick={handleAddProject}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20 font-medium"
          >
            <Plus size={20} />
            Add Project
          </button>
        </div>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          type="text"
          placeholder="Search projects by name or path..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-light"
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl p-12 text-center">
          <div className="bg-zinc-900 p-4 rounded-full mb-4">
            <Folder size={48} className="text-zinc-700" />
          </div>
          <h3 className="text-xl font-medium text-zinc-300 mb-2">No projects found</h3>
          <p className="text-zinc-500 max-w-sm">
            {searchQuery
              ? 'Try a different search term or add a new project.'
              : 'Add your first project to get started with Elara IDE.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleAddProject}
              className="mt-6 text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Add Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleOpenProject(project)}
              className="group relative bg-zinc-900/40 border border-zinc-800 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:bg-zinc-900/60 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-indigo-500/10 p-2.5 rounded-xl">
                  <Folder className="text-indigo-400" size={24} />
                </div>
                <button
                  onClick={(e) => handleRemoveProject(project.id, e)}
                  className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove Project"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors truncate">
                {project.name}
              </h3>

              <div className="text-zinc-500 text-sm font-light mb-4 truncate" title={project.path}>
                {project.path}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-light">
                  <Clock size={12} />
                  {new Date(project.lastOpened).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                  Open in IDE
                  <ExternalLink size={12} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IDEManagementPage;
