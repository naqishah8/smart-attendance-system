import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { motion } from 'framer-motion';

const MobileDataList = ({ items, fields, onItemClick, primaryKey, secondaryKey, emptyText = 'No data', accentColor }) => {
  if (!items || items.length === 0) {
    return (
      <Box sx={{
        textAlign: 'center', py: 6, borderRadius: '16px',
        background: 'rgba(19,24,41,0.4)', border: '1px dashed rgba(108,99,255,0.15)',
      }}>
        <Typography variant="body2" sx={{ color: '#555E73' }}>{emptyText}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item, idx) => {
        const accent = typeof accentColor === 'function' ? accentColor(item) : (accentColor || '#6C63FF');
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.04, 0.5), duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Box
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              sx={{
                display: 'flex', alignItems: 'stretch', borderRadius: '12px', overflow: 'hidden',
                background: 'rgba(19,24,41,0.55)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.04)',
                cursor: onItemClick ? 'pointer' : 'default',
                transition: 'all 0.2s',
                '&:hover': onItemClick ? {
                  background: 'rgba(19,24,41,0.7)',
                  borderColor: 'rgba(108,99,255,0.12)',
                  transform: 'translateX(2px)',
                } : {},
                '&:active': onItemClick ? { transform: 'scale(0.99)' } : {},
              }}
            >
              {/* Color accent bar */}
              <Box sx={{ width: 4, flexShrink: 0, background: accent }} />

              {/* Content */}
              <Box sx={{ flex: 1, p: 1.5, minWidth: 0 }}>
                {/* Header row */}
                {primaryKey && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof primaryKey === 'function' ? primaryKey(item) : item[primaryKey]}
                    </Typography>
                    {secondaryKey && (
                      <Box sx={{ flexShrink: 0, ml: 1 }}>
                        {typeof secondaryKey === 'function' ? secondaryKey(item) :
                          <Typography variant="caption" sx={{ color: '#8892A8' }}>{item[secondaryKey]}</Typography>}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Data grid — 2 columns */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '4px 12px',
                }}>
                  {fields.map((field, fi) => {
                    const val = field.render ? field.render(item) : item[field.key];
                    if (val === undefined || val === null) return null;
                    return (
                      <Box key={fi} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                        <Typography sx={{ color: '#555E73', fontSize: '0.68rem', fontWeight: 500, mr: 0.5 }}>
                          {field.label}
                        </Typography>
                        {field.chip ? (
                          <Chip label={val} size="small" sx={{
                            fontSize: '0.65rem', height: 20,
                            bgcolor: field.chipBg?.(item) || 'rgba(108,99,255,0.1)',
                            color: field.chipColor?.(item) || '#8B83FF',
                            fontWeight: 600, textTransform: 'capitalize',
                          }} />
                        ) : (
                          <Typography sx={{
                            fontWeight: 600, color: field.color?.(item) || '#E8ECF4',
                            fontSize: '0.75rem',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {val}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Chevron for clickable items */}
              {onItemClick && (
                <Box sx={{ display: 'flex', alignItems: 'center', pr: 0.5, color: '#555E73' }}>
                  <ChevronRightIcon sx={{ fontSize: 20 }} />
                </Box>
              )}
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default MobileDataList;
