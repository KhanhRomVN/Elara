import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawerProps } from './Drawer.types';
import { getDrawerVariants, getDrawerPosition, overlayVariants } from './Drawer.utils';
import { cn } from '../../../lib/utils';

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  direction = 'right',
  children,
  className = '',
  overlayClassName = '',
  animationType = 'slide',
  closeOnOverlayClick = true,
  width,
  height,
}) => {
  const drawerVariants = getDrawerVariants(direction, animationType);
  const drawerPosition = getDrawerPosition(direction, width, height);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={{ duration: 0.3 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            className={cn('fixed inset-0 z-[999] bg-black/40', overlayClassName)}
          />

          {/* Drawer */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={drawerVariants}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={drawerPosition}
            className={cn(
              'bg-card-background border-l border-border shadow-2xl z-[1000] overflow-hidden flex flex-col',
              className,
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
