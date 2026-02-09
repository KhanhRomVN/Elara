import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';
import { ButtonProps } from './Button.types';
import {
  getButtonSizeStyles,
  getIconSize,
  getLoadingSpinner,
  shouldShowIcon,
  getContentAlignment,
} from './Button.utils';
import { cn } from '../../../../shared/utils/cn';

const Button: React.FC<ButtonProps> = ({
  size = 100,
  width = 'fit',
  children,
  loading = false,
  disabled = false,
  icon,
  align = 'right',
  className = '',
  onClick,
  loadingText,
  iconPosition = 'left',
  ...props
}) => {
  const isDisabled = disabled || loading;

  // Kiểm tra xem button có text hay không
  const hasText = React.Children.count(children) > 0;

  // Xác định xem có nên hiển thị icon hay không
  const showIcon = shouldShowIcon(icon, loading);

  // Lấy styles dựa trên size và width
  const sizeStyles = getButtonSizeStyles(size, width, hasText, showIcon);

  // Lấy icon size
  const iconSize = getIconSize(size, hasText);

  // Lấy alignment styles
  const alignmentStyles = getContentAlignment(align);

  // Render icon
  const renderIcon = () => {
    if (loading) {
      const spinnerConfig = getLoadingSpinner(size, hasText);
      return <Loader2 size={spinnerConfig.size} className="animate-spin" />;
    }

    if (!icon) return null;

    // Nếu icon là LucideIcon
    if (typeof icon === 'function') {
      const IconComponent = icon as LucideIcon;
      return <IconComponent size={iconSize} />;
    }

    // Nếu icon là ReactNode (emoji, SVG, text, etc.)
    return (
      <span
        className="button-icon-content"
        style={{
          fontSize: hasText ? `${Math.max(iconSize - 2, 12)}px` : `${iconSize}px`,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
    );
  };

  // Render content với đúng thứ tự icon và text
  const renderContent = () => {
    const iconElement = renderIcon();

    if (!hasText) {
      return iconElement;
    }

    if (iconPosition === 'right') {
      return (
        <>
          {children}
          {iconElement}
        </>
      );
    }

    // Mặc định là left
    return (
      <>
        {iconElement}
        {children}
      </>
    );
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled && onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className={cn(
        'flex items-center transition-all duration-200 border-none outline-none font-medium whitespace-nowrap',
        isDisabled && 'opacity-60 cursor-not-allowed',
        !isDisabled && 'cursor-pointer',
        className,
      )}
      style={{
        ...sizeStyles,
        ...alignmentStyles,
      }}
      disabled={isDisabled}
      onClick={handleClick}
      {...props}
    >
      {renderContent()}
      {loading && loadingText && <span className="button-loading-text">{loadingText}</span>}
    </button>
  );
};

export default Button;
