import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline,
  Button, TextField, Paper, Alert, CircularProgress, Divider,
  Avatar, IconButton, useMediaQuery
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import VideocamIcon from '@mui/icons-material/Videocam';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import WifiOffIcon from '@mui/icons-material/WifiOff';

import theme from './theme';
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeeManagement from './pages/EmployeeManagement';
import AttendanceReport from './pages/AttendanceReport';
import SalaryManagement from './pages/SalaryManagement';
import CameraManagement from './pages/CameraManagement';
import InsightsPage from './pages/InsightsPage';
import NotificationManager from './pages/NotificationManager';
import LeaveManagement from './pages/LeaveManagement';
import SettingsPage from './pages/SettingsPage';
import InstallPrompt from './components/InstallPrompt';
import { api } from './services/api';

const DRAWER_WIDTH = 220;

const adminNav = [
  { label: 'Dashboard', icon: <DashboardIcon />, key: 'dashboard' },
  { label: 'Employees', icon: <PeopleIcon />, key: 'employees' },
  { label: 'Attendance', icon: <AccessTimeIcon />, key: 'attendance' },
  { label: 'Cameras', icon: <VideocamIcon />, key: 'cameras' },
  { label: 'Salary', icon: <AttachMoneyIcon />, key: 'salary' },
  { label: 'Leave & HR', icon: <EventNoteIcon />, key: 'leaves' },
  { label: 'AI Insights', icon: <AutoAwesomeIcon />, key: 'insights' },
  { label: 'Notifications', icon: <NotificationsActiveIcon />, key: 'notifications' },
  { label: 'Settings', icon: <SettingsIcon />, key: 'settings' },
];

const employeeNav = [
  { label: 'My Dashboard', icon: <DashboardIcon />, key: 'my-dashboard' },
  { label: 'My Attendance', icon: <AccessTimeIcon />, key: 'my-attendance' },
  { label: 'My Salary', icon: <AttachMoneyIcon />, key: 'my-salary' },
  { label: 'My Leaves', icon: <EventNoteIcon />, key: 'my-leaves' },
  { label: 'Notifications', icon: <NotificationsIcon />, key: 'my-notifications' },
];

/* ─── Login Page ─────────────────────────────────────────────────── */
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.login(email, password);
      onLogin(data.user);
    } catch (err) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #0B0F1A 0%, #1A1042 25%, #0B0F1A 50%, #0A2035 75%, #0B0F1A 100%)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 15s ease infinite',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Dot grid background */}
      <Box sx={{
        position: 'absolute', inset: 0, opacity: 0.3,
        backgroundImage: 'radial-gradient(rgba(108,99,255,0.15) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
      >
        <Paper sx={{
          p: { xs: 3, sm: 5 }, maxWidth: { xs: '95%', sm: 420 }, width: '100%', position: 'relative',
          background: 'rgba(19, 24, 41, 0.7)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(108,99,255,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(108,99,255,0.05)',
        }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Box sx={{
                width: { xs: 52, sm: 64 }, height: { xs: 52, sm: 64 }, borderRadius: '18px', mx: 'auto', mb: 2,
                background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 30px rgba(108,99,255,0.3)',
              }}>
                <VideocamIcon sx={{ fontSize: { xs: 24, sm: 32 }, color: '#fff' }} />
              </Box>
            </motion.div>
            <Typography variant="h4" sx={{ fontSize: '1.5rem' }}>Smart Attendance</Typography>
            <Typography variant="subtitle1" sx={{ mt: 0.5 }}>Sign in to your account</Typography>
          </Box>
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 2 }}
              InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: '#8892A8' }} /> }} />
            <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <LockIcon sx={{ mr: 1, color: '#8892A8' }} />,
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOffIcon sx={{ color: '#8892A8' }} /> : <VisibilityIcon sx={{ color: '#8892A8' }} />}
                  </IconButton>
                ),
              }} />
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button fullWidth variant="contained" type="submit" size="large" disabled={loading}
                sx={{
                  py: 1.5, fontSize: '1rem',
                  background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
                  '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
                }}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </motion.div>
          </form>
        </Paper>
      </motion.div>
    </Box>
  );
}

/* ─── Main App ───────────────────────────────────────────────────── */
function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
  const navItems = isAdmin ? adminNav : employeeNav;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.request('/auth/profile')
        .then(data => { setUser(data.user); setCurrentPage(data.user.role === 'employee' ? 'my-dashboard' : 'dashboard'); })
        .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('refreshToken'); })
        .finally(() => setChecking(false));
    } else { setChecking(false); }
  }, []);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage(userData.role === 'employee' ? 'my-dashboard' : 'dashboard');
  };
  const handleLogout = () => { api.logout(); setUser(null); setCurrentPage(null); };

  if (checking) {
    return (
      <ThemeProvider theme={theme}><CssBaseline />
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0B0F1A' }}>
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px',
              background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <VideocamIcon sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
          </motion.div>
          <Typography variant="body2" sx={{ mt: 2, color: '#8892A8' }}>Loading...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (!user) {
    return (
      <ThemeProvider theme={theme}><CssBaseline />
        <LoginPage onLogin={handleLogin} />
        <InstallPrompt />
      </ThemeProvider>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return isAdmin ? <Dashboard /> : <EmployeeDashboard user={user} />;
      case 'my-dashboard': return <EmployeeDashboard user={user} />;
      case 'employees': return isAdmin ? <EmployeeManagement /> : null;
      case 'attendance': return <AttendanceReport isAdmin={isAdmin} user={user} />;
      case 'my-attendance': return <AttendanceReport isAdmin={false} user={user} />;
      case 'cameras': return isAdmin ? <CameraManagement /> : null;
      case 'salary': return <SalaryManagement isAdmin={isAdmin} user={user} />;
      case 'my-salary': return <SalaryManagement isAdmin={false} user={user} />;
      case 'leaves': return isAdmin ? <LeaveManagement isAdmin={true} /> : null;
      case 'my-leaves': return <LeaveManagement isAdmin={false} />;
      case 'settings': return isAdmin ? <SettingsPage /> : null;
      case 'insights': return isAdmin ? <InsightsPage /> : null;
      case 'notifications': return isAdmin ? <NotificationManager isAdmin={true} /> : null;
      case 'my-notifications': return <NotificationManager isAdmin={false} />;
      default: return isAdmin ? <Dashboard /> : <EmployeeDashboard user={user} />;
    }
  };

  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();

  const drawerContent = (
    <>
      <Toolbar />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: '#555E73', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {isAdmin ? 'Administration' : 'My Space'}
        </Typography>
      </Box>
      <List sx={{ px: 1 }}>
        {navItems.map((item, i) => {
          const isActive = currentPage === item.key;
          return (
            <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => { setCurrentPage(item.key); if (isMobile) setMobileOpen(false); }}
                sx={{
                  borderRadius: '12px', py: 1.2, position: 'relative', overflow: 'hidden',
                  '&.Mui-selected': {
                    background: 'transparent',
                    '&:hover': { background: 'rgba(108,99,255,0.08)' },
                  },
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,217,166,0.04))',
                      border: '1px solid rgba(108,99,255,0.1)',
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <ListItemIcon sx={{ minWidth: 38, color: isActive ? '#6C63FF' : '#555E73', position: 'relative', zIndex: 1 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{
                  fontSize: '0.88rem', fontWeight: isActive ? 600 : 400, position: 'relative', zIndex: 1,
                }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />

        {/* Offline Banner */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
            >
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap',
                py: 0.8, bgcolor: 'rgba(255,181,71,0.15)', borderBottom: '1px solid rgba(255,181,71,0.2)',
              }}>
                <WifiOffIcon sx={{ fontSize: 16, color: '#FFB547' }} />
                <Typography variant="caption" sx={{ color: '#FFB547', fontWeight: 600 }}>You're offline</Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
          <Toolbar>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 1, color: '#8892A8' }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{
              width: 32, height: 32, borderRadius: '8px', mr: 1.5,
              background: 'linear-gradient(135deg, #6C63FF, #00D9A6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <VideocamIcon sx={{ fontSize: 18, color: '#fff' }} />
            </Box>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontSize: { xs: '0.9rem', sm: '1.05rem' } }}>
              Smart Attendance
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Avatar sx={{
                width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700,
                bgcolor: isAdmin ? '#6C63FF' : '#00D9A6',
              }}>{initials}</Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ color: '#E8ECF4', fontWeight: 600, lineHeight: 1.2 }}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#8892A8', textTransform: 'capitalize' }}>
                  {user.role}
                </Typography>
              </Box>
              <motion.div whileTap={{ scale: 0.9 }}>
                <IconButton size="small" onClick={handleLogout} sx={{ color: '#8892A8', '&:hover': { color: '#FF5C6C' } }}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </motion.div>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Sidebar */}
        {isMobile ? (
          <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer variant="permanent"
            sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
            {drawerContent}
          </Drawer>
        )}

        {/* Main content with page transitions */}
        <Box component="main" sx={{
          flexGrow: 1, p: { xs: 1.5, sm: 2, md: 3 }, minHeight: '100vh', bgcolor: 'background.default',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Subtle dot grid */}
          <Box sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.15,
            backgroundImage: 'radial-gradient(rgba(108,99,255,0.12) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          <Toolbar />
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ position: 'relative' }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </Box>

        <InstallPrompt />
      </Box>
    </ThemeProvider>
  );
}

export default App;
