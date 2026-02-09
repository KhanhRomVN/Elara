import React, { useState, useEffect } from 'react';
import { TreeProps, TreeNode } from './Tree.types';
import { getAllNodeIds, hasChildren, getDefaultIcon, getTreeNodeStyles } from './Tree.utils';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';

const Tree: React.FC<TreeProps> = ({
  data,
  onNodeClick,
  onNodeToggle,
  defaultExpandedIds = [],
  defaultExpandAll = false,
  showLines = true,
  showIcons = true,
  className = '',
  indentSize = 24,
  selectable = true,
  selectedId,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandAll ? getAllNodeIds(data) : defaultExpandedIds),
  );
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(selectedId);

  useEffect(() => {
    if (selectedId !== undefined) {
      setInternalSelectedId(selectedId);
    }
  }, [selectedId]);

  const toggleNode = (nodeId: string) => {
    const newExpandedIds = new Set(expandedIds);
    const isExpanded = newExpandedIds.has(nodeId);

    if (isExpanded) {
      newExpandedIds.delete(nodeId);
    } else {
      newExpandedIds.add(nodeId);
    }

    setExpandedIds(newExpandedIds);

    if (onNodeToggle) {
      onNodeToggle(nodeId, !isExpanded);
    }
  };

  const handleNodeClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();

    if (node.disabled) return;

    if (selectable) {
      setInternalSelectedId(node.id);
    }

    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const renderNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedIds.has(node.id);
    const hasChild = hasChildren(node);
    const isSelected = internalSelectedId === node.id;

    return (
      <div key={node.id} className={`tree-node ${node.className || ''}`.trim()}>
        {/* Node Content */}
        <div
          className="tree-node-content flex items-center p-1.5 px-2 transition-all duration-200 rounded relative"
          style={{
            ...getTreeNodeStyles(level, indentSize, isSelected, !!node.disabled),
          }}
          onClick={(e) => handleNodeClick(node, e)}
          onMouseEnter={(e) => {}}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Expand/Collapse Icon */}
          {hasChild ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="bg-transparent border-none p-0 mr-1 cursor-pointer flex items-center justify-center w-4 h-4"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Node Icon */}
          {showIcons && (
            <span className="mr-2 text-base flex items-center">
              {node.icon || getDefaultIcon(node, isExpanded)}
            </span>
          )}

          {/* Node Label */}
          <span className="flex-1 text-sm select-none">{node.label}</span>
        </div>

        {/* Children */}
        {hasChild && isExpanded && (
          <div className="tree-node-children">
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('tree-container font-inherit relative', className)}>
      {data.map((node) => renderNode(node, 0))}
    </div>
  );
};

export default Tree;
