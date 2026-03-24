import { motion } from 'framer-motion';

const PulsingDot = ({ color = '#00D9A6', size = 8 }) => (
  <motion.div
    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: color,
      boxShadow: `0 0 ${size}px ${color}60`,
      display: 'inline-block',
    }}
  />
);

export default PulsingDot;
