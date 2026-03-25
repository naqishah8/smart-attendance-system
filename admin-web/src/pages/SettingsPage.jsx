import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Grid, CardContent, Button, TextField,
  Switch, FormControlLabel, CircularProgress, Alert, Divider, Slider
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '../services/api';
import { monoFont } from '../theme';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import ToastNotification from '../components/ToastNotification';

const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setError(null); setLoading(true);
      const data = await api.getSettings();
      setSettings(data.settings);
    } catch {
      setError('Failed to load settings.');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api.updateSettings({
        attendance: settings.attendance,
        notifications: settings.notifications,
      });
      setSettings(data.settings);
      setToast({ open: true, message: 'Settings saved!', severity: 'success' });
    } catch {
      setToast({ open: true, message: 'Failed to save settings.', severity: 'error' });
    } finally { setSaving(false); }
  };

  const updateAttendance = (key, value) => {
    setSettings(prev => ({ ...prev, attendance: { ...prev.attendance, [key]: value } }));
  };

  const updateNotifications = (key, value) => {
    setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
  };

  if (loading) {
    return <AnimatedPage><Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box></AnimatedPage>;
  }

  if (error || !settings) {
    return <AnimatedPage><Alert severity="error">{error || 'Failed to load settings'}</Alert></AnimatedPage>;
  }

  return (
    <AnimatedPage>
      <Box>
        <ToastNotification open={toast.open} message={toast.message} severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 3 } }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon sx={{ color: '#6C63FF' }} />
              <Typography variant="h4">Settings</Typography>
            </Box>
            <Typography variant="subtitle1">Configure attendance rules and notification preferences</Typography>
          </Box>
          <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave} disabled={saving}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>

        <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
          {/* Attendance Rules */}
          <Grid item xs={12} md={6}>
            <GlassCard delay={0}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <AccessTimeIcon sx={{ color: '#6C63FF' }} />
                  <Typography variant="h6">Attendance Rules</Typography>
                </Box>

                {/* Missed notification timing */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Send "we missed you" notification after
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8892A8', display: 'block', mb: 1.5 }}>
                    Minutes after shift start time with no check-in
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Slider
                      value={settings.attendance.missedNotificationAfterMinutes}
                      onChange={(_, v) => updateAttendance('missedNotificationAfterMinutes', v)}
                      min={5} max={120} step={5}
                      sx={{ flex: 1, color: '#6C63FF' }}
                    />
                    <Typography sx={{ fontFamily: monoFont, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                      {settings.attendance.missedNotificationAfterMinutes} min
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

                {/* Auto-mark absent timing */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Auto-mark absent after
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8892A8', display: 'block', mb: 1.5 }}>
                    Minutes after shift start with no check-in — employee marked absent
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Slider
                      value={settings.attendance.absentAfterMinutes}
                      onChange={(_, v) => updateAttendance('absentAfterMinutes', v)}
                      min={15} max={240} step={15}
                      sx={{ flex: 1, color: '#FF5C6C' }}
                    />
                    <Typography sx={{ fontFamily: monoFont, fontWeight: 700, minWidth: 60, textAlign: 'right', color: '#FF5C6C' }}>
                      {settings.attendance.absentAfterMinutes} min
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

                {/* Late override */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Override late threshold
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8892A8', display: 'block', mb: 1.5 }}>
                    Set to 0 to use each shift's grace period. Otherwise, global override in minutes.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Slider
                      value={settings.attendance.lateAfterMinutes}
                      onChange={(_, v) => updateAttendance('lateAfterMinutes', v)}
                      min={0} max={60} step={5}
                      sx={{ flex: 1, color: '#FFB547' }}
                    />
                    <Typography sx={{ fontFamily: monoFont, fontWeight: 700, minWidth: 60, textAlign: 'right', color: '#FFB547' }}>
                      {settings.attendance.lateAfterMinutes === 0 ? 'Shift' : `${settings.attendance.lateAfterMinutes} min`}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

                {/* Half-day threshold */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Half-day minimum hours
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8892A8', display: 'block', mb: 1.5 }}>
                    Below this = absent, above = half-day
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Slider
                      value={settings.attendance.halfDayMinHours}
                      onChange={(_, v) => updateAttendance('halfDayMinHours', v)}
                      min={1} max={6} step={0.5}
                      sx={{ flex: 1, color: '#4FC3F7' }}
                    />
                    <Typography sx={{ fontFamily: monoFont, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                      {settings.attendance.halfDayMinHours}h
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

                <FormControlLabel
                  control={<Switch checked={settings.attendance.excludeWeekends}
                    onChange={(e) => updateAttendance('excludeWeekends', e.target.checked)} />}
                  label="Skip weekends (Sat/Sun)"
                />
                <FormControlLabel
                  control={<Switch checked={settings.attendance.applyFinesOnAbsent}
                    onChange={(e) => updateAttendance('applyFinesOnAbsent', e.target.checked)} />}
                  label="Auto-apply fines when marked absent"
                />
              </CardContent>
            </GlassCard>
          </Grid>

          {/* Notification Settings */}
          <Grid item xs={12} md={6}>
            <GlassCard delay={0.1}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <NotificationsIcon sx={{ color: '#00D9A6' }} />
                  <Typography variant="h6">Notifications</Typography>
                </Box>

                <FormControlLabel
                  control={<Switch checked={settings.notifications.sendMissedNotification}
                    onChange={(e) => updateNotifications('sendMissedNotification', e.target.checked)} />}
                  label="Send 'we missed you' notification"
                  sx={{ mb: 2, display: 'block' }}
                />

                {settings.notifications.sendMissedNotification && (
                  <>
                    <TextField fullWidth label="Notification Title" size="small"
                      value={settings.notifications.missedNotificationTitle}
                      onChange={(e) => updateNotifications('missedNotificationTitle', e.target.value)}
                      sx={{ mb: 2 }} />
                    <TextField fullWidth label="Notification Message" size="small" multiline rows={2}
                      value={settings.notifications.missedNotificationBody}
                      onChange={(e) => updateNotifications('missedNotificationBody', e.target.value)}
                      helperText="Use {name} for employee first name"
                      sx={{ mb: 2 }} />
                  </>
                )}

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

                <FormControlLabel
                  control={<Switch checked={settings.notifications.sendDailySummary}
                    onChange={(e) => updateNotifications('sendDailySummary', e.target.checked)} />}
                  label="Send daily attendance summary to admin"
                  sx={{ mb: 2, display: 'block' }}
                />

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>Webhook Integrations</Typography>

                <TextField fullWidth label="Slack Webhook URL" size="small"
                  value={settings.notifications.slackWebhookUrl}
                  onChange={(e) => updateNotifications('slackWebhookUrl', e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  sx={{ mb: 2 }} />

                <TextField fullWidth label="Microsoft Teams Webhook URL" size="small"
                  value={settings.notifications.teamsWebhookUrl}
                  onChange={(e) => updateNotifications('teamsWebhookUrl', e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..." />
              </CardContent>
            </GlassCard>
          </Grid>
        </Grid>
      </Box>
    </AnimatedPage>
  );
};

export default SettingsPage;
