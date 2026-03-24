import React from 'react';
import { TableRow } from '@mui/material';
import { motion } from 'framer-motion';

const MotionRow = motion.create(TableRow);

const AnimatedTableRow = ({ children, index = 0, ...props }) => (
  <MotionRow
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.8), ease: [0.4, 0, 0.2, 1] }}
    whileHover={{ backgroundColor: 'rgba(108,99,255,0.04)' }}
    {...props}
  >
    {children}
  </MotionRow>
);

export default AnimatedTableRow;
