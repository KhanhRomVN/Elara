import React from 'react';
import { CardFooterProps } from './Card.types';
import { cn } from '../../../../shared/utils/cn';

const CardFooter: React.FC<CardFooterProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
};

export default CardFooter;
