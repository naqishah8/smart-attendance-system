import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import { monoFont } from '../theme';

const AnimatedCounter = ({ value, duration = 1.2, decimals = 0, prefix = '', suffix = '' }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = typeof value === 'number' ? value : parseFloat(value) || 0;
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span style={{ fontFamily: monoFont, fontWeight: 700 }}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
};

export default AnimatedCounter;
