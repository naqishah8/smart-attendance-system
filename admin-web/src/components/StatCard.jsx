import React from 'react';
import { CardContent, Typography, Box, Avatar } from '@mui/material';
import GlassCard from './GlassCard';
import AnimatedCounter from './AnimatedCounter';

const StatCard = ({ title, value, sub, icon, gradient, textColor, delay = 0, compact }) => (
  <GlassCard delay={delay} sx={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
    <Box sx={{
      position: 'absolute', top: -20, right: -20, width: 90, height: 90,
      borderRadius: '50%', background: gradient, opacity: 0.08, filter: 'blur(1px)',
    }} />
    <CardContent sx={{
      p: { xs: 2, sm: compact ? 2.5 : 3 },
      '&:last-child': { pb: { xs: 2, sm: compact ? 2.5 : 3 } },
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      height: '100%',
    }}>
      <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
        <Avatar sx={{
          bgcolor: 'transparent', background: gradient,
          width: { xs: 36, sm: compact ? 38 : 44 },
          height: { xs: 36, sm: compact ? 38 : 44 },
          mx: { xs: 'auto', sm: 0 }, mb: { xs: 1, sm: 1 },
        }}>
          {icon}
        </Avatar>
        <Typography variant="caption" sx={{ color: '#8892A8', fontWeight: 500, display: 'block' }}>{title}</Typography>
        <Typography sx={{
          fontWeight: 700, color: textColor || '#E8ECF4',
          fontSize: { xs: compact ? '1.3rem' : '1.6rem', sm: compact ? '1.25rem' : '2rem' },
          lineHeight: 1.2,
        }}>
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </Typography>
        {sub && <Typography variant="caption" sx={{ color: '#555E73', display: 'block' }}>{sub}</Typography>}
      </Box>
    </CardContent>
  </GlassCard>
);

export default StatCard;
