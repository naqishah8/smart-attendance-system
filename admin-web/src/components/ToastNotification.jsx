import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const ToastNotification = ({ open, message, severity = 'success', onClose }) => (
  <Snackbar
    open={open}
    autoHideDuration={4000}
    onClose={onClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
  >
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{
          width: '100%',
          backdropFilter: 'blur(12px)',
          borderRadius: '10px',
          fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {message}
      </Alert>
    </motion.div>
  </Snackbar>
);

export default ToastNotification;
