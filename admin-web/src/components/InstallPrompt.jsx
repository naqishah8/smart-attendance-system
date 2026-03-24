import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, IconButton } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import { motion, AnimatePresence } from 'framer-motion';

const InstallPrompt = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('pwaInstallReady', handler);
    if (window.deferredInstallPrompt) setShow(true);
    return () => window.removeEventListener('pwaInstallReady', handler);
  }, []);

  const handleInstall = async () => {
    const prompt = window.deferredInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    window.deferredInstallPrompt = null;
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            position: 'fixed', bottom: 16, left: 12, right: 12,
            zIndex: 9999,
          }}
        >
          <Box sx={{
            p: 2.5, borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(19,24,41,0.95), rgba(30,20,60,0.95))',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(108,99,255,0.2)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 40px rgba(108,99,255,0.08)',
          }}>
            {/* Close button */}
            <IconButton size="small" onClick={() => setShow(false)}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#555E73' }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>

            {/* Content */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PhoneIphoneIcon sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#E8ECF4', lineHeight: 1.2 }}>
                  Install Smart Attendance
                </Typography>
                <Typography variant="caption" sx={{ color: '#8892A8' }}>
                  Works offline on any device
                </Typography>
              </Box>
            </Box>

            {/* Button */}
            <Button fullWidth variant="contained" onClick={handleInstall}
              startIcon={<GetAppIcon />}
              sx={{
                py: 1.2, borderRadius: '10px', fontWeight: 600,
                background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
                '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
              }}>
              Install App
            </Button>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
