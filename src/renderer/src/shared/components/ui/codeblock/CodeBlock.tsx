import React, { useState, useMemo, useEffect } from 'react';

import { CodeBlockProps, CodeBlockContextValue, CodeBlockItem } from './CodeBlock.types';
import { CodeBlockContext } from './CodeBlockContext';
import CodeBlockHeader from './CodeBlockHeader';
import CodeBlockBody from './CodeBlockBody';
import {
  parseSize,
  getScaleFromSize,
  getContainerStyle,
  getBuiltInThemes,
} from './CodeBlock.utils';
import { useMonaco } from '@monaco-editor/react';

const CodeBlock: React.FC<CodeBlockProps> = (props) => {
  // Merge with defaults
  const mergedProps = {
    size: 100,
    borderRadius: 8,
    showToolbar: true,
    showCopyButton: true,
    showFileIcon: true,
    showDivider: true,
    showLineNumbers: true,
    showGutter: true,
    showLineHighlight: true,
    editable: false,
    readOnly: false,
    ...props,
  };

  const {
    code,
    language,
    title,
    filename,
    items: initialItems,
    width,
    size,
    className = '',
    padding,
    margin,
    border,
    shadow,
    borderRadius,
    opacity,
    onItemChange,
  } = mergedProps;

  // Normalize items
  const items: CodeBlockItem[] = useMemo(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item, index) => ({
        id: item.id || `code-item-${index}`,
        ...item,
        code: item.code || '',
      }));
    } else if (code) {
      // Legacy/Single mode
      return [
        {
          id: 'legacy-single-item',
          code: code || '',
          language,
          title,
          filename,
        } as CodeBlockItem,
      ];
    }
    return [];
  }, [initialItems, code, language, title, filename]);

  const [activeItemId, setActiveItemId] = useState<string>(items[0]?.id || '');

  const [copied, setCopied] = useState(false);

  // Ensure activeItem is valid
  const activeItem = useMemo(
    () =>
      items.find((item) => item.id === activeItemId) ||
      items[0] ||
      ({ code: '', language: 'plaintext' } as CodeBlockItem),
    [items, activeItemId],
  );

  useEffect(() => {
    if (items.length > 0 && !items.find((i) => i.id === activeItemId)) {
      setActiveItemId(items[0].id!);
    }
  }, [items, activeItemId]);

  const handleSetActiveItem = (id: string) => {
    setActiveItemId(id);
    const item = items.find((i) => i.id === id);
    if (item && onItemChange) {
      onItemChange(item);
    }
  };

  const scale = getScaleFromSize(size);
  const finalWidth = parseSize(width, '100%');

  const containerStyle = useMemo(
    () =>
      getContainerStyle({
        borderRadius,
        opacity,
        padding,
        margin,
        border,
        shadow,
      }),
    [borderRadius, opacity, padding, margin, border, shadow],
  );

  // --- Theme Loading Logic ---
  const [customTheme, setCustomTheme] = useState<string | null>(null);
  const [themeColors, setThemeColors] = useState<any>(null);
  const monaco = useMonaco();

  const getPresetThemeName = (): string | null => {
    try {
      const savedPreset = localStorage.getItem('vite-ui-theme-preset');
      if (savedPreset) {
        const preset = JSON.parse(savedPreset);
        return preset.name || null;
      }
    } catch (e) {
      console.error('Failed to get preset theme', e);
    }
    return null;
  };

  useEffect(() => {
    if (!monaco) return;

    const loadCustomTheme = async () => {
      try {
        let themeData;
        let themeName: string;
        const presetName = getPresetThemeName();
        const builtInThemes = getBuiltInThemes();

        // Correct path lookup as per recent fix
        const themeLoader = presetName
          ? builtInThemes[`../../../../constants/themes/${presetName}.json`]
          : null;

        if (themeLoader && presetName) {
          themeData = await themeLoader();
          themeName = presetName;
        } else {
          // Fallback
          const availableThemes = Object.keys(builtInThemes);
          if (availableThemes.length > 0) {
            const firstThemePath = availableThemes[0];
            const firstThemeLoader = builtInThemes[firstThemePath];
            themeData = await firstThemeLoader();
            themeName = firstThemePath.split('/').pop()?.replace('.json', '') || 'default-theme';
          } else {
            setCustomTheme(props.theme || 'vs-dark');
            return;
          }
        }

        monaco.editor.defineTheme(themeName, themeData.default.monaco as any);
        setCustomTheme(themeName);
        setThemeColors(themeData.default.monaco.colors);

        // We don't set theme on editor here, Body component will handle it via customTheme prop
      } catch (error) {
        console.error('Error loading theme:', error);
        setCustomTheme(props.theme || 'vs-dark');
      }
    };

    let isMounted = true;
    loadCustomTheme();

    const handleThemeChange = (_event: Event) => {
      if (!isMounted) return;
      loadCustomTheme();
    };

    window.addEventListener('theme-preset-changed', handleThemeChange);
    return () => {
      isMounted = false;
      window.removeEventListener('theme-preset-changed', handleThemeChange);
    };
  }, [monaco, props.theme]);

  const contextValue: CodeBlockContextValue = {
    activeItem,
    setActiveItem: handleSetActiveItem,
    items,
    theme: props.theme || 'vs-dark',
    customTheme,
    themeColors,
    copied,
    setCopied,
    props: mergedProps,
  };

  if (!activeItem.code && items.length === 0) {
    // Debug log
    console.warn('CodeBlock: No code or items to display');
    return null;
  }

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <div
        className={className}
        style={{
          ...containerStyle,
          width: finalWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {props.children ? (
          props.children
        ) : (
          <>
            {mergedProps.showToolbar && <CodeBlockHeader />}
            {mergedProps.showToolbar && mergedProps.showDivider && (
              <div
                style={{
                  height: '1px',
                  width: '100%',
                  backgroundColor:
                    themeColors?.['editorGroup.border'] ||
                    (props.theme === 'vs-dark' || customTheme === 'vs-dark'
                      ? 'rgba(128, 128, 128, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)'),
                }}
              />
            )}
            <CodeBlockBody />
          </>
        )}
      </div>
    </CodeBlockContext.Provider>
  );
};

export default CodeBlock;
