import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Check } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';

import { ComboboxProps, ComboboxOption, ComboboxItemProps } from './Combobox.types';
import { getComboboxSizeStyles, filterOptions } from './Combobox.utils';

const Combobox: React.FC<ComboboxProps> = ({
  options: optionsProp,
  value,
  searchQuery = '',
  size = 'md',
  className = '',
  onChange,
  emptyMessage = 'No options found',
  searchable = true,
  creatable = false,
  creatableMessage = 'Create "%s"',
  creatableClassName, // New prop
  creatableIcon, // New prop
  children,
  onCreate,
  renderOption,
  maxHeight = '240px',
}) => {
  // Parse children into options if provided
  const childrenOptions: ComboboxOption[] = React.useMemo(() => {
    if (!children) return [];

    const items: ComboboxOption[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement<ComboboxItemProps>(child)) {
        items.push({
          value: child.props.value,
          label: child.props.label || child.props.value,
          disabled: child.props.disabled,
          icon: child.props.icon,
          className: child.props.className,
        });
      }
    });
    return items;
  }, [children]);

  // Use options from props or from children
  const options = optionsProp || childrenOptions;

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<ComboboxOption | null>(
    options.find((opt) => opt.value === value) || null,
  );

  const listboxRef = useRef<HTMLUListElement>(null);

  // Update selected option when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      const option = options.find((opt) => opt.value === value);
      setSelectedOption(option || null);
    }
  }, [value, options]);

  // Filter options based on search
  const filteredOptions = filterOptions(options, searchQuery, searchable);

  // Check if we should show create option
  const showCreateOption =
    creatable &&
    searchQuery.trim() !== '' &&
    !filteredOptions.some((opt) => opt.label.toLowerCase() === searchQuery.toLowerCase());

  // Handle option selection
  const handleSelect = useCallback(
    (option: ComboboxOption) => {
      if (option.disabled) return;

      setSelectedOption(option);
      setHighlightedIndex(0);

      if (onChange) {
        onChange(option.value, option);
      }
    },
    [onChange],
  );

  // Handle creating new option
  const handleCreate = useCallback(() => {
    const newValue = searchQuery.trim();
    if (!newValue) return;

    const newOption: ComboboxOption = {
      value: newValue,
      label: newValue,
    };

    setSelectedOption(newOption);
    setHighlightedIndex(0);

    if (onCreate) {
      onCreate(newValue);
    }

    if (onChange) {
      onChange(newValue, newOption);
    }
  }, [searchQuery, onChange, onCreate]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (listboxRef.current) {
      const highlightedElement = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const sizeStyles = getComboboxSizeStyles(size);

  return (
    <div
      className={cn(
        'w-full rounded-md border border-dropdown-border bg-dropdown-background overflow-hidden',
        className,
      )}
    >
      {/* Options List */}
      <ul ref={listboxRef} className="overflow-auto" style={{ maxHeight }} role="listbox">
        {filteredOptions.length === 0 && !showCreateOption ? (
          <li className="px-4 py-2 text-gray-500 text-sm italic">{emptyMessage}</li>
        ) : (
          <>
            {filteredOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={selectedOption?.value === option.value}
                className={cn(
                  'px-4 py-2 cursor-pointer transition-colors flex items-center justify-between',
                  'hover:bg-dropdown-itemHover',
                  option.className,
                  index === highlightedIndex && 'bg-dropdown-itemHover',
                )}
                onClick={() => !option.disabled && handleSelect(option)}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
              >
                <div className="flex items-center gap-2">
                  {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                  {renderOption ? (
                    renderOption(option)
                  ) : (
                    <span
                      className={
                        selectedOption?.value === option.value ? 'text-primary font-bold' : ''
                      }
                    >
                      {option.label}
                    </span>
                  )}
                </div>
                {selectedOption?.value === option.value && (
                  <Check size={sizeStyles.iconSize} className="text-primary flex-shrink-0" />
                )}
              </li>
            ))}
            {showCreateOption && (
              <li
                role="option"
                className={cn(
                  'px-4 py-2 cursor-pointer transition-colors flex items-center gap-2',
                  'border-t border-dropdown-border hover:bg-dropdown-itemHover',
                  highlightedIndex === filteredOptions.length && 'bg-dropdown-itemHover',
                  creatableClassName,
                )}
                onClick={handleCreate}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
              >
                {creatableIcon || (
                  <Plus size={sizeStyles.iconSize} className="flex-shrink-0 text-primary" />
                )}
                <span
                  className={cn(
                    'italic font-medium',
                    !creatableClassName && 'text-primary',
                    creatableClassName,
                  )}
                >
                  {creatableMessage.replace('%s', searchQuery)}
                </span>
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
};

export default Combobox;
