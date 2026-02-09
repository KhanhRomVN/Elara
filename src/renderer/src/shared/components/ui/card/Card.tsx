import React from 'react';
import { CardProps } from './Card.types';
import { getCardAlignmentStyles } from './Card.utils';
import { cn } from '../../../../shared/utils/cn';

const Card: React.FC<CardProps> = ({
  width,
  cardAlign,
  children,
  className = '',
  onClick,
  ...props
}) => {
  const cardAlignmentStyles = getCardAlignmentStyles(cardAlign);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(e);
    }
  };

  // Tính toán width style từ phân số (0-1) sang percentage
  const widthStyle = width ? { width: `${width * 100}%` } : {};

  return (
    <div
      className={cn('border rounded-md p-5', className)}
      style={{
        ...cardAlignmentStyles,
        ...widthStyle,
        ...props.style,
      }}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
