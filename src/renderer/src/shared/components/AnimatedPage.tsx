import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedPageProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedPage = ({ children, className, delay = 0, ...props }: AnimatedPageProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1.0] as const,
        delay,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1.0] as const,
    },
  },
};
