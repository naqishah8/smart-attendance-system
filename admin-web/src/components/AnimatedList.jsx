import React from 'react';
import { motion } from 'framer-motion';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
};

const AnimatedList = ({ children, className, style }) => (
  <motion.div variants={container} initial="hidden" animate="show" className={className} style={style}>
    {React.Children.map(children, (child) =>
      child ? <motion.div variants={item}>{child}</motion.div> : null
    )}
  </motion.div>
);

export { item as listItemVariant };
export default AnimatedList;
