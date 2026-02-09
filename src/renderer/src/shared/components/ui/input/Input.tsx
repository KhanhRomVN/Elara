import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon, Loader2, Eye, EyeOff, X } from 'lucide-react';
import { InputProps } from './Input.types';
import {
  getInputSizeClasses,
  getIconSize,
  shouldShowLeftIcon,
  shouldShowRightIcons,
  normalizeRightIcons,
} from './Input.utils';
import { cn } from '../../../../shared/utils/cn';

const Input: React.FC<InputProps> = ({
  size = 'md',
  type = 'text',
  placeholder,
  value,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  popoverOpen: controlledPopoverOpen,
  onChange,
  popoverContent,
  onPopoverOpenChange,
  inlinePanel,
  multiValue = false,
  badges = [],
  onBadgeRemove,
  badgeColorMode = 'uniform',
  badgeColors = [
    '#3B82F6', // Blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#00f3ff', // neon blue
    '#39ff14', // neon green
    '#ff00f0', // neon pink
    '#ccff00', // neon yellow
    '#ff7e00', // neon orange
    '#b026ff', // neon purple
  ],
  badgeVariant = 'solid',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalPopoverOpen, setInternalPopoverOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const popoverOpen =
    controlledPopoverOpen !== undefined ? controlledPopoverOpen : internalPopoverOpen;

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isDisabled = disabled || loading;
  const showLeftIcon = shouldShowLeftIcon(leftIcon, loading);

  // Handle password eye icon
  const passwordEyeIcon =
    type === 'password' ? (
      showPassword ? (
        <EyeOff size={getIconSize(size)} onClick={() => !isDisabled && setShowPassword(false)} />
      ) : (
        <Eye size={getIconSize(size)} onClick={() => !isDisabled && setShowPassword(true)} />
      )
    ) : null;

  const combinedRightIcons = passwordEyeIcon
    ? [passwordEyeIcon, ...(Array.isArray(rightIcon) ? rightIcon : rightIcon ? [rightIcon] : [])]
    : rightIcon;

  const showRightIcons = shouldShowRightIcons(combinedRightIcons);
  const rightIcons = normalizeRightIcons(combinedRightIcons);
  const sizeClasses = getInputSizeClasses(size);
  const iconSize = getIconSize(size);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsideInput = inputRef.current && !inputRef.current.contains(target);
      const clickedOutsidePopover = popoverRef.current && !popoverRef.current.contains(target);

      if (clickedOutsideInput && clickedOutsidePopover) {
        if (controlledPopoverOpen === undefined) {
          setInternalPopoverOpen(false);
        }
        if (onPopoverOpenChange) {
          onPopoverOpenChange(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onPopoverOpenChange]);

  // Notify parent when popover state changes
  useEffect(() => {
    if (onPopoverOpenChange) {
      onPopoverOpenChange(popoverOpen);
    }
  }, [popoverOpen, onPopoverOpenChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDisabled && onChange) {
      onChange(e);
    }
  };

  // Handle popover open
  const handlePopoverOpen = () => {
    if (!disabled && !loading && (type === 'combobox' || type === 'calendar') && !popoverOpen) {
      if (controlledPopoverOpen === undefined) {
        setInternalPopoverOpen(true);
      }
      if (onPopoverOpenChange) {
        onPopoverOpenChange(true);
      }
    }
  };

  const renderLeftIcon = () => {
    if (loading) {
      return <Loader2 size={iconSize} className="animate-spin" />;
    }

    if (!leftIcon) return null;

    if (typeof leftIcon === 'function') {
      const IconComponent = leftIcon as LucideIcon;
      return <IconComponent size={iconSize} />;
    }

    return <span className="flex items-center justify-center">{leftIcon}</span>;
  };

  const renderRightIcons = () => {
    return rightIcons.map((icon, index) => {
      if (React.isValidElement(icon)) {
        return (
          <div key={index} className="cursor-pointer flex items-center justify-center">
            {icon}
          </div>
        );
      }

      if (typeof icon === 'function') {
        const IconComponent = icon as LucideIcon;
        return <IconComponent key={index} size={iconSize} className="cursor-pointer" />;
      }
      return (
        <span key={index} className="cursor-pointer flex items-center justify-center">
          {icon}
        </span>
      );
    });
  };

  // Render different input types
  const renderInputContent = () => {
    if (type === 'combobox' || type === 'calendar') {
      return (
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={isDisabled}
          readOnly={type === 'calendar'}
          onChange={(e) => {
            if (type === 'combobox') {
              handleChange(e);
              handlePopoverOpen();
            }
          }}
          onFocus={() => {
            setIsFocused(true);
            handlePopoverOpen();
          }}
          onClick={() => {
            if (!popoverOpen) handlePopoverOpen();
          }}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'flex-1 bg-transparent border-none outline-none',
            type === 'calendar' && 'cursor-pointer',
          )}
          {...props}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type={type === 'password' && showPassword ? 'text' : type}
        value={value}
        placeholder={placeholder}
        disabled={isDisabled}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="flex-1 bg-transparent border-none outline-none"
        {...props}
      />
    );
  };

  // Render badges
  const renderBadges = () => {
    if (!multiValue || badges.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {badges.map((badge, index) => {
          const bgColor =
            badgeColorMode === 'uniform' ? badgeColors[0] : badgeColors[index % badgeColors.length];

          const color = badge.color || bgColor;
          const isNeon = badgeVariant === 'neon';

          return (
            <div
              key={badge.id}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium',
                !isNeon && 'text-white',
              )}
              style={
                isNeon
                  ? {
                      backgroundColor: color.startsWith('#') ? color + '1a' : color, // Add 10% opacity if hex
                      color: color,
                    }
                  : { backgroundColor: color }
              }
            >
              <span>{badge.label}</span>
              {onBadgeRemove && (
                <X
                  size={14}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => onBadgeRemove(badge.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const badgesPosition = inlinePanel ? 'top' : 'bottom';

  return (
    <div className="w-full">
      {/* Badges on top (if inlinePanel exists) */}
      {badgesPosition === 'top' && <div className="w-full mb-2">{renderBadges()}</div>}

      <div className="relative w-full">
        <div
          className={cn(
            'flex items-center w-full transition-all duration-200 rounded-md',
            'border bg-input',
            'placeholder:text-gray-400',
            sizeClasses,
            isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
            type === 'calendar' && !isDisabled && 'cursor-pointer',
            className,
          )}
          onFocus={(e) => {
            if (e.target === e.currentTarget) return;
            setIsFocused(true);
          }}
          onBlur={(e) => {
            if (e.target === e.currentTarget) return;
            setIsFocused(false);
          }}
        >
          {/* Left Icon */}
          {showLeftIcon && <div className="flex-shrink-0 mr-2">{renderLeftIcon()}</div>}

          {/* Input Content */}
          <div className="flex-1 flex items-center">{renderInputContent()}</div>

          {/* Right Icons */}
          {showRightIcons && (
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">{renderRightIcons()}</div>
          )}
        </div>

        {/* Popover for combobox/calendar */}
        {(type === 'combobox' || type === 'calendar') &&
          popoverOpen &&
          !isDisabled &&
          popoverContent && (
            <div ref={popoverRef} className="absolute z-50 w-full top-[calc(100%+4px)] left-0">
              {popoverContent}
            </div>
          )}
      </div>

      {/* Badges on bottom (default) */}
      {badgesPosition === 'bottom' && <div className="w-full mt-2">{renderBadges()}</div>}

      {/* Inline Panel */}
      {inlinePanel && <div className="w-full mt-2">{inlinePanel}</div>}
    </div>
  );
};

export default Input;
