import { TreeNode } from './Tree.types';

/**
 * Recursively collect all node IDs from tree data
 */
export const getAllNodeIds = (nodes: TreeNode[]): string[] => {
  const ids: string[] = [];

  const traverse = (node: TreeNode) => {
    ids.push(node.id);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };

  nodes.forEach(traverse);
  return ids;
};

/**
 * Find a node by ID in the tree
 */
export const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Check if a node has children
 */
export const hasChildren = (node: TreeNode): boolean => {
  return !!node.children && node.children.length > 0;
};

/**
 * Get default folder/file icons
 */
export const getDefaultIcon = (node: TreeNode, isExpanded: boolean): string => {
  if (hasChildren(node)) {
    return isExpanded ? '📂' : '📁';
  }
  return '📄';
};

/**
 * Get tree node styles
 */
export const getTreeNodeStyles = (
  indentLevel: number,
  indentSize: number,
  isSelected: boolean,
  disabled: boolean,
) => ({
  paddingLeft: `${indentLevel * indentSize}px`,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  backgroundColor: isSelected ? 'var(--sidebar-item-focus)' : 'transparent',
  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
  fontWeight: isSelected ? 500 : 400,
});
