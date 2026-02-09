import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Tab, TabItem } from '../tab';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../dropdown';
import { useCodeBlock } from './CodeBlockContext';
import { getFileIcon } from './fileIconMapper';
import { CodeBlockItem } from './CodeBlock.types';
import { copyToClipboard } from './CodeBlock.utils';

const CodeBlockHeader: React.FC = () => {
  const { activeItem, setActiveItem, items, props, copied, setCopied, theme } = useCodeBlock();
  const {
    showToolbar,
    headerStyle = 'tab',
    showCopyButton,
    toolbarActions = [],
    showFileIcon = true,
    toolbarBackgroundColor,
  } = props;

  const { themeColors } = useCodeBlock();

  // Determine if we should show header logic
  // If only 1 item and no title, and not tabs => only show if we want copy button or actions
  // But usually we always render header if showToolbar is true
  if (!showToolbar) return null;

  const handleCopy = async () => {
    const success = await copyToClipboard(activeItem.code);
    if (success) {
      setCopied(true);
      props.onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderIcon = (item: CodeBlockItem) => {
    if (!showFileIcon) return null;
    if (item.icon) return item.icon;
    if (item.filename) {
      const iconSrc = getFileIcon(item.filename);
      return <img src={iconSrc} alt="file icon" className="w-4 h-4 mr-2" />;
    }
    return null;
  };

  const isDark = theme?.includes('dark');
  const textColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? 'rgba(128, 128, 128, 0.2)' : '#e5e7eb';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: items.length > 1 ? '0 0.5rem' : '0.5rem',
        backgroundColor:
          toolbarBackgroundColor ||
          themeColors?.['editor.background'] ||
          (isDark ? '#1e1e1e' : '#ffffff'),
      }}
    >
      {/* Left Side: Navigation or Title */}
      <div className="flex items-center gap-3 overflow-hidden">
        {items.length > 1 ? (
          headerStyle === 'tab' ? (
            <Tab
              active={activeItem.id}
              onActiveChange={(id: string) => setActiveItem(id)}
              className="border-none p-0 gap-4"
            >
              {items.map((item) => (
                <TabItem
                  key={item.id}
                  id={item.id!}
                  title={item.title}
                  className="px-1 py-2 border-b-2 border-transparent transition-colors duration-200"
                  activeClassName="border-blue-500 text-blue-500 font-medium"
                  hoverClassName="hover:text-blue-400"
                >
                  <div className="flex items-center gap-2">
                    {renderIcon(item)}
                    <span>{item.title || item.filename || 'Untitled'}</span>
                  </div>
                </TabItem>
              ))}
            </Tab>
          ) : (
            <Dropdown>
              <DropdownTrigger className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-white/10 transition-colors">
                {renderIcon(activeItem)}
                <span style={{ color: textColor }}>
                  {activeItem.title || activeItem.filename || 'Select File'}
                </span>
              </DropdownTrigger>
              <DropdownContent>
                {items.map((item) => (
                  <DropdownItem key={item.id} onClick={() => setActiveItem(item.id!)}>
                    <div className="flex items-center gap-2">
                      {renderIcon(item)}
                      <span>{item.title || item.filename || 'Untitled'}</span>
                    </div>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          )
        ) : (
          /* Single Item Title */
          <div className="flex items-center">
            {renderIcon(activeItem)}
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: textColor,
                fontFamily: activeItem.filename ? 'monospace' : 'inherit',
              }}
            >
              {activeItem.title || activeItem.filename}
            </span>
          </div>
        )}
      </div>

      {/* Right Side: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {showCopyButton && (
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
            style={{
              padding: '0.375rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} color={textColor} />}
          </button>
        )}

        {toolbarActions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
            style={{
              padding: '0.375rem',
              border: 'none',
              background: 'transparent',
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              opacity: action.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!action.disabled) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {action.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CodeBlockHeader;
