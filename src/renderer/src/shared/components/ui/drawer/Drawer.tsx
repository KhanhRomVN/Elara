import { motion, AnimatePresence } from 'framer-motion';
import { DrawerProps } from './Drawer.types';
import { getDrawerVariants, getDrawerPosition, overlayVariants } from './Drawer.utils';
import { cn } from '../../../../shared/utils/cn';

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
  showOverlay = true,
}) => {
  const drawerVariants = getDrawerVariants(direction, animationType);
  const drawerPosition = getDrawerPosition(direction, width, height);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          {showOverlay && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={overlayVariants}
              transition={{ duration: 0.3 }}
              onClick={closeOnOverlayClick ? onClose : undefined}
              className={cn('fixed inset-0 z-[999]', overlayClassName)}
            />
          )}

          {/* Drawer */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={drawerVariants}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={drawerPosition}
            className={className}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
