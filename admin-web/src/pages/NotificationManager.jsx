import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Grid, CardContent, Button,
  DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, Chip, CircularProgress,
  Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { api } from '../services/api';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import AnimatedList from '../components/AnimatedList';
import AnimatedDialog from '../components/AnimatedDialog';
import AnimatedTableRow from '../components/AnimatedTableRow';
import ToastNotification from '../components/ToastNotification';
import { TableSkeleton } from '../components/SkeletonLoader';

const NotificationManager = ({ isAdmin = false }) => {
  const [notifications, setNotifications] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [form, setForm] = useState({
    title: '', body: '', type: 'announcement', priority: 'normal',
    targetType: 'all', targetValue: '', scheduledAt: ''
  });

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    try {
      setError(null); setLoading(true);
      const data = isAdmin
        ? await api.getAdminNotifications()
        : await api.getNotifications();
      setNotifications(data.notifications || []);
    } catch {
      setError('Failed to load notifications.');
    } finally { setLoading(false); }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      loadNotifications();
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setToast({ open: true, message: 'Title and message are required.', severity: 'error' });
      return;
    }
    setSending(true);
    try {
      await api.sendNotification({
        ...form,
        scheduledAt: form.scheduledAt || undefined,
        targetValue: form.targetValue || undefined
      });
      setToast({ open: true, message: 'Notification sent!', severity: 'success' });
      setDialogOpen(false);
      setForm({ title: '', body: '', type: 'announcement', priority: 'normal', targetType: 'all', targetValue: '', scheduledAt: '' });
      loadNotifications();
    } catch {
      setToast({ open: true, message: 'Failed to send.', severity: 'error' });
    } finally { setSending(false); }
  };

  const priorityColors = {
    urgent: { bg: 'rgba(255,92,108,0.12)', color: '#FF5C6C' },
    high: { bg: 'rgba(255,181,71,0.12)', color: '#FFB547' },
    normal: { bg: 'rgba(108,99,255,0.12)', color: '#6C63FF' },
    low: { bg: 'rgba(136,146,168,0.12)', color: '#8892A8' }
  };

  return (
    <AnimatedPage>
      <Box>
        <ToastNotification open={toast.open} message={toast.message} severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 4 } }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsActiveIcon sx={{ color: '#6C63FF' }} />
              <Typography variant="h4">{isAdmin ? 'Notifications' : 'My Notifications'}</Typography>
            </Box>
            <Typography variant="subtitle1">
              {isAdmin ? 'Send announcements, reminders, and alerts to employees' : 'Your notifications and alerts'}
            </Typography>
          </Box>
          {isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
              New Notification
            </Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : notifications.length === 0 ? (
          <GlassCard sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <NotificationsActiveIcon sx={{ fontSize: 64, color: '#555E73', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 1 }}>
                {isAdmin ? 'No notifications sent yet' : 'No notifications'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#8892A8' }}>
                {isAdmin ? 'Click "New Notification" to send your first announcement.' : 'You\'re all caught up!'}
              </Typography>
            </CardContent>
          </GlassCard>
        ) : isAdmin ? (
          <GlassCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Target</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Recipients</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Sent At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications.map((n, i) => {
                    const pc = priorityColors[n.priority] || priorityColors.normal;
                    return (
                      <AnimatedTableRow key={n._id} index={i}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{n.title}</Typography>
                          <Typography variant="caption" sx={{ color: '#8892A8' }}>
                            {n.body?.substring(0, 60)}{n.body?.length > 60 ? '...' : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={n.type} size="small"
                            sx={{ bgcolor: 'rgba(108,99,255,0.1)', color: '#8B83FF', textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, textTransform: 'capitalize' }}>{n.targetType}{n.targetValue ? `: ${n.targetValue}` : ''}</TableCell>
                        <TableCell>
                          <Chip label={n.priority} size="small" sx={{ bgcolor: pc.bg, color: pc.color, textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={n.status} size="small"
                            sx={{
                              bgcolor: n.status === 'sent' ? 'rgba(0,217,166,0.12)' :
                                       n.status === 'scheduled' ? 'rgba(79,195,247,0.12)' : 'rgba(136,146,168,0.1)',
                              color: n.status === 'sent' ? '#00D9A6' :
                                     n.status === 'scheduled' ? '#4FC3F7' : '#8892A8',
                              textTransform: 'capitalize'
                            }} />
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{n.recipients?.length || 0}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: '#8892A8' }}>
                          {n.sentAt ? new Date(n.sentAt).toLocaleString() : '-'}
                        </TableCell>
                      </AnimatedTableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        ) : (
          /* Employee inbox view */
          <AnimatedList>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {notifications.map((n, idx) => {
                const pc = priorityColors[n.priority] || priorityColors.normal;
                const isRead = n.readBy?.some(r => r.userId === n.recipients?.[0]);
                return (
                  <GlassCard key={n._id} delay={idx * 0.05} sx={{
                    borderLeft: `4px solid ${pc.color}`,
                    opacity: isRead ? 0.7 : 1,
                    cursor: 'pointer',
                  }}
                    onClick={() => handleMarkRead(n._id)}
                  >
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-start' }, gap: { xs: 1, sm: 0 } }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{n.title}</Typography>
                            <Chip label={n.type} size="small"
                              sx={{ bgcolor: 'rgba(108,99,255,0.1)', color: '#8B83FF', textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }} />
                            {n.priority !== 'normal' && (
                              <Chip label={n.priority} size="small"
                                sx={{ bgcolor: pc.bg, color: pc.color, textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: '#8892A8' }}>{n.body}</Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#555E73', whiteSpace: 'nowrap', ml: { xs: 0, sm: 2 } }}>
                          {n.sentAt ? new Date(n.sentAt).toLocaleDateString() : ''}
                        </Typography>
                      </Box>
                    </CardContent>
                  </GlassCard>
                );
              })}
            </Box>
          </AnimatedList>
        )}

        {/* Create Notification Dialog */}
        <AnimatedDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Send Notification</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth label="Title" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required placeholder="e.g., Office closed tomorrow" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Message" value={form.body} multiline rows={3}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required placeholder="Write your notification message..." />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select value={form.type} label="Type" onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <MenuItem value="announcement">Announcement</MenuItem>
                    <MenuItem value="reminder">Reminder</MenuItem>
                    <MenuItem value="alert">Alert</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select value={form.priority} label="Priority" onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Send To</InputLabel>
                  <Select value={form.targetType} label="Send To" onChange={(e) => setForm({ ...form, targetType: e.target.value, targetValue: '' })}>
                    <MenuItem value="all">All Employees</MenuItem>
                    <MenuItem value="department">Department</MenuItem>
                    <MenuItem value="role">Role</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                {form.targetType === 'department' && (
                  <FormControl fullWidth>
                    <InputLabel>Department</InputLabel>
                    <Select value={form.targetValue} label="Department" onChange={(e) => setForm({ ...form, targetValue: e.target.value })}>
                      {['Engineering', 'HR', 'Finance', 'Operations', 'Marketing', 'Sales', 'IT'].map(d => (
                        <MenuItem key={d} value={d}>{d}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {form.targetType === 'role' && (
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select value={form.targetValue} label="Role" onChange={(e) => setForm({ ...form, targetValue: e.target.value })}>
                      <MenuItem value="employee">Employees</MenuItem>
                      <MenuItem value="admin">Admins</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Schedule (optional)" type="datetime-local" value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  helperText="Leave empty to send immediately" />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSend} disabled={sending}
              startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
              {form.scheduledAt ? 'Schedule' : 'Send Now'}
            </Button>
          </DialogActions>
        </AnimatedDialog>
      </Box>
    </AnimatedPage>
  );
};

export default NotificationManager;
