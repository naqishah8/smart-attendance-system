import { createTheme } from '@mui/material/styles';

const fontMain = "'Plus Jakarta Sans', 'Segoe UI', sans-serif";
const fontMono = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace";

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6C63FF', light: '#8B83FF', dark: '#4A42CC' },
    secondary: { main: '#00D9A6', light: '#33E0B8', dark: '#00AD85' },
    background: { default: '#0B0F1A', paper: '#131829' },
    error: { main: '#FF5C6C' },
    warning: { main: '#FFB547' },
    success: { main: '#00D9A6' },
    info: { main: '#4FC3F7' },
    text: { primary: '#E8ECF4', secondary: '#8892A8' },
    divider: 'rgba(255,255,255,0.06)',
  },
  typography: {
    fontFamily: fontMain,
    h4: { fontWeight: 800, letterSpacing: '-0.03em', fontSize: '1.65rem' },
    h5: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.25rem' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 500, color: '#8892A8', fontSize: '0.88rem', letterSpacing: '0.01em' },
    body1: { fontWeight: 500, letterSpacing: '0.005em' },
    body2: { color: '#8892A8', fontWeight: 500, letterSpacing: '0.005em' },
    caption: { fontWeight: 500, letterSpacing: '0.02em' },
    button: { fontWeight: 700, letterSpacing: '0.02em' },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Make monospace font available globally via class
        '.mono': { fontFamily: fontMono },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(19, 24, 41, 0.55)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(108, 99, 255, 0.08)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s cubic-bezier(.4,0,.2,1)',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 12px 40px rgba(108, 99, 255, 0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 10,
          padding: '8px 22px',
          letterSpacing: '0.02em',
          transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
          '&:active': { transform: 'scale(0.97)' },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 6px 20px rgba(108,99,255,0.35)' },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: 'rgba(108,99,255,0.06)',
            fontWeight: 700,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#8892A8',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            fontFamily: fontMain,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          fontFamily: fontMain,
          fontSize: '0.84rem',
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          background: 'rgba(11, 15, 26, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(14, 18, 37, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: '0.7rem',
          letterSpacing: '0.03em',
          transition: 'box-shadow 0.2s, transform 0.15s',
          '&:hover': { boxShadow: '0 0 12px rgba(108,99,255,0.25)' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(19, 24, 41, 0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(108,99,255,0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: fontMain,
            fontWeight: 500,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.08)', transition: 'border-color 0.2s' },
            '&:hover fieldset': { borderColor: 'rgba(108,99,255,0.3)' },
            '&.Mui-focused fieldset': { borderColor: '#6C63FF' },
          },
          '& .MuiInputLabel-root': {
            fontFamily: fontMain,
            fontWeight: 500,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          fontFamily: fontMain,
          fontWeight: 500,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: fontMain,
          fontWeight: 500,
          fontSize: '0.88rem',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: fontMain,
          fontWeight: 700,
          letterSpacing: '-0.01em',
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(108, 99, 255, 0.06)',
          '&::after': {
            background: 'linear-gradient(90deg, transparent, rgba(108,99,255,0.04), transparent)',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontFamily: fontMain,
          fontWeight: 500,
        },
      },
    },
  },
});

// Export mono font for use in components
export const monoFont = fontMono;
export default theme;
