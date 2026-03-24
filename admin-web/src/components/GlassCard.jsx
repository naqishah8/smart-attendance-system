import React from 'react';
import { Card } from '@mui/material';
import { motion } from 'framer-motion';

const MotionCard = motion.create(Card);

const GlassCard = ({ children, sx, delay = 0, noBorder, ...props }) => (
  <MotionCard
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
    whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(108,99,255,0.12)' }}
    sx={{
      background: 'rgba(19, 24, 41, 0.55)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: noBorder ? 'none' : '1px solid rgba(108, 99, 255, 0.08)',
      ...sx,
    }}
    {...props}
  >
    {children}
  </MotionCard>
);

export default GlassCard;
