export interface Skill {
  id: string;
  name: string;
  repo: string; // format: owner/repo
  description: string;
  version: string;
  installedAt: number;
  order: number;
}

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  author?: string;
  homepage?: string;
}
