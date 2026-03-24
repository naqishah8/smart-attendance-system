import React, { forwardRef } from 'react';
import { Dialog, Slide } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = forwardRef(({ children, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, scale: 0.92, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.96, y: -10 }}
    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
    {...props}
  >
    {children}
  </motion.div>
));

const Transition = forwardRef((props, ref) => (
  <Slide direction="up" ref={ref} {...props} />
));

const AnimatedDialog = ({ open, children, ...props }) => (
  <Dialog
    open={open}
    TransitionComponent={Transition}
    PaperComponent={MotionDiv}
    {...props}
  >
    {children}
  </Dialog>
);

export default AnimatedDialog;
