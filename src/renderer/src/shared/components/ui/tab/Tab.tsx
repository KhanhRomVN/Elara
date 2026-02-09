import React, { useState, useEffect } from 'react';
import { TabProps, TabContextValue } from './Tab.types';
import { cn } from '../../../../shared/utils/cn';

import { TabContext } from './TabContext';

const Tab: React.FC<TabProps> = ({
  children,
  defaultActive = '',
  active: controlledActive,
  onActiveChange,
  width = 'full',
  align = 'left',
  className = '',
}) => {
  const [internalActive, setInternalActive] = useState(defaultActive);

  // Determine if component is controlled or uncontrolled
  const isControlled = controlledActive !== undefined;
  const activeTab = isControlled ? controlledActive : internalActive;

  const setActiveTab = (tabId: string) => {
    if (!isControlled) {
      setInternalActive(tabId);
    }

    if (onActiveChange) {
      onActiveChange(tabId);
    }
  };

  // Sync internal state with controlled prop
  useEffect(() => {
    if (isControlled) {
      setInternalActive(controlledActive);
    }
  }, [controlledActive, isControlled]);

  const contextValue: TabContextValue = {
    activeTab,
    setActiveTab,
  };

  const widthClasses = width === 'full' ? 'w-full' : 'w-fit';

  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    'space-between': 'justify-between',
  }[align];

  return (
    <TabContext.Provider value={contextValue}>
      <div className={cn('flex items-center', widthClasses, alignClasses, className)}>
        {children}
      </div>
    </TabContext.Provider>
  );
};

export default Tab;
