import { ReactNode } from 'react';

export interface TreeNode {
  /**
   * Unique identifier for the node
   */
  id: string;

  /**
   * Label to display for the node
   */
  label: string | ReactNode;

  /**
   * Children nodes
   */
  children?: TreeNode[];

  /**
   * Custom CSS class for this node
   */
  className?: string;

  /**
   * Custom icon for this node
   */
  icon?: ReactNode;

  /**
   * Whether this node is disabled
   */
  disabled?: boolean;

  /**
   * Additional data attached to the node
   */
  data?: any;
}

export interface TreeProps {
  /**
   * Tree data structure
   */
  data: TreeNode[];

  /**
   * Callback when a node is clicked
   */
  onNodeClick?: (node: TreeNode) => void;

  /**
   * Callback when a node is expanded/collapsed
   */
  onNodeToggle?: (nodeId: string, expanded: boolean) => void;

  /**
   * Initially expanded node IDs
   */
  defaultExpandedIds?: string[];

  /**
   * Expand all nodes by default
   * @default false
   */
  defaultExpandAll?: boolean;

  /**
   * Show lines connecting nodes
   * @default true
   */
  showLines?: boolean;

  /**
   * Show icons for nodes
   * @default true
   */
  showIcons?: boolean;

  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * Indent size in pixels
   * @default 24
   */
  indentSize?: number;

  /**
   * Allow selecting nodes
   * @default true
   */
  selectable?: boolean;

  /**
   * Selected node ID
   */
  selectedId?: string;
}
