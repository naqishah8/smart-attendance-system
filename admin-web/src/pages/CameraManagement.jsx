import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Grid, CardContent, Button,
  DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, Chip, CircularProgress,
  Alert, Switch, FormControlLabel, IconButton, Tooltip
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { api } from '../services/api';
import { monoFont } from '../theme';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import AnimatedList from '../components/AnimatedList';
import AnimatedDialog from '../components/AnimatedDialog';
import ToastNotification from '../components/ToastNotification';
import PulsingDot from '../components/PulsingDot';
import { CardGridSkeleton } from '../components/SkeletonLoader';

const CameraManagement = () => {
  const [cameras, setCameras] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState({});
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [form, setForm] = useState({
    name: '',
    rtspUrl: '',
    username: '',
    password: '',
    zone: '',
    floor: '',
    description: '',
    resolution: '1080p',
    frameRate: 15,
    hasPTZ: false,
    hasThermal: false,
  });

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await api.getCameras();
      setCameras(data.cameras || data || []);
    } catch (err) {
      setError('Failed to load cameras.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCamera(null);
    setForm({
      name: '', rtspUrl: '', username: '', password: '',
      zone: '', floor: '', description: '',
      resolution: '1080p', frameRate: 15, hasPTZ: false, hasThermal: false,
    });
  };

  const handleEdit = (camera) => {
    setSelectedCamera(camera);
    setForm({
      name: camera.name || '',
      rtspUrl: camera.rtspUrl || '',
      username: camera.username || '',
      password: '',
      zone: camera.location?.zone || '',
      floor: camera.location?.floor || '',
      description: camera.location?.description || '',
      resolution: camera.resolution || '1080p',
      frameRate: camera.frameRate || 15,
      hasPTZ: camera.hasPTZ || false,
      hasThermal: camera.hasThermal || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.rtspUrl.trim()) {
      showToast('Name and RTSP URL are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        rtspUrl: form.rtspUrl,
        username: form.username || undefined,
        password: form.password || undefined,
        location: {
          zone: form.zone || undefined,
          floor: form.floor ? Number(form.floor) : undefined,
          description: form.description || undefined,
        },
        resolution: form.resolution,
        frameRate: Number(form.frameRate),
        hasPTZ: form.hasPTZ,
        hasThermal: form.hasThermal,
      };

      if (selectedCamera) {
        await api.updateCamera(selectedCamera._id, payload);
        showToast('Camera updated successfully', 'success');
      } else {
        await api.addCamera(payload);
        showToast('Camera added successfully', 'success');
      }
      setDialogOpen(false);
      resetForm();
      loadCameras();
    } catch (err) {
      showToast('Failed to save camera.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (cameraId) => {
    setConnecting(prev => ({ ...prev, [cameraId]: 'connecting' }));
    try {
      await api.connectCamera(cameraId);
      showToast('Camera connected!', 'success');
      loadCameras();
    } catch (err) {
      showToast('Failed to connect camera.', 'error');
    } finally {
      setConnecting(prev => ({ ...prev, [cameraId]: null }));
    }
  };

  const handleDisconnect = async (cameraId) => {
    setConnecting(prev => ({ ...prev, [cameraId]: 'disconnecting' }));
    try {
      await api.disconnectCamera(cameraId);
      showToast('Camera disconnected.', 'info');
      loadCameras();
    } catch (err) {
      showToast('Failed to disconnect camera.', 'error');
    } finally {
      setConnecting(prev => ({ ...prev, [cameraId]: null }));
    }
  };

  const showToast = (message, severity) => setToast({ open: true, message, severity });

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#00D9A6';
      case 'offline': return '#8892A8';
      case 'maintenance': return '#FFB547';
      default: return '#8892A8';
    }
  };

  if (loading) {
    return <AnimatedPage><CardGridSkeleton count={6} /></AnimatedPage>;
  }

  return (
    <AnimatedPage>
      <Box>
        <ToastNotification open={toast.open} message={toast.message} severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 4 } }}>
          <Box>
            <Typography variant="h4">Camera Management</Typography>
            <Typography variant="subtitle1">Connect and manage your CCTV cameras</Typography>
          </Box>
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => { resetForm(); setDialogOpen(true); }}
            sx={{
              background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
              '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
            }}
          >
            Add Camera
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {cameras.length === 0 ? (
          <GlassCard sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <VideocamOffIcon sx={{ fontSize: 64, color: '#555E73', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 1 }}>No cameras configured</Typography>
              <Typography variant="body2" sx={{ color: '#8892A8', mb: 3 }}>
                Add your first CCTV camera to start tracking attendance automatically.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => { resetForm(); setDialogOpen(true); }}>
                Add Your First Camera
              </Button>
            </CardContent>
          </GlassCard>
        ) : (
          <AnimatedList>
            <Grid container spacing={{ xs: 1.5, sm: 2, lg: 3 }}>
              {cameras.map((camera, idx) => {
                const isOnline = camera.status === 'online';
                const isConnecting = connecting[camera._id];
                return (
                  <Grid item xs={12} sm={6} lg={4} key={camera._id}>
                    <GlassCard delay={idx * 0.06} sx={{
                      borderTop: `3px solid ${getStatusColor(camera.status)}`,
                      position: 'relative',
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        {/* Status indicator */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VideocamIcon sx={{ color: isOnline ? '#00D9A6' : '#555E73' }} />
                            <Typography variant="h6" sx={{ fontSize: '1rem', wordBreak: 'break-word' }}>{camera.name}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isOnline && <PulsingDot color="#00D9A6" size={8} />}
                            <Chip
                              label={camera.status}
                              size="small"
                              sx={{
                                textTransform: 'capitalize', fontWeight: 600,
                                bgcolor: `${getStatusColor(camera.status)}18`,
                                color: getStatusColor(camera.status),
                              }}
                            />
                          </Box>
                        </Box>

                        {/* Preview area */}
                        <Box sx={{
                          height: { xs: 100, sm: 140 }, borderRadius: '8px', mb: 2,
                          background: isOnline
                            ? 'linear-gradient(135deg, #0a1628, #131829)'
                            : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                          {isOnline ? (
                            <Box sx={{ textAlign: 'center' }}>
                              <SettingsInputAntennaIcon sx={{ fontSize: 32, color: '#00D9A6', mb: 0.5 }} />
                              <Typography variant="caption" sx={{ color: '#00D9A6', display: 'block' }}>
                                Live Stream Active
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ textAlign: 'center' }}>
                              <VideocamOffIcon sx={{ fontSize: 32, color: '#555E73', mb: 0.5 }} />
                              <Typography variant="caption" sx={{ color: '#555E73', display: 'block' }}>
                                Offline
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Camera details */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 2 }}>
                          {camera.location?.zone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <LocationOnIcon sx={{ fontSize: 16, color: '#8892A8' }} />
                              <Typography variant="caption" sx={{ color: '#8892A8' }}>
                                {camera.location.zone}{camera.location.floor != null ? ` - Floor ${camera.location.floor}` : ''}
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="caption" sx={{ color: '#555E73', fontFamily: monoFont, fontSize: '0.7rem' }}>
                            {camera.rtspUrl?.replace(/\/\/.*@/, '//***@')}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {camera.resolution && (
                              <Chip label={camera.resolution} size="small"
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(108,99,255,0.1)', color: '#8B83FF' }} />
                            )}
                            {camera.frameRate && (
                              <Chip label={`${camera.frameRate} fps`} size="small"
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(0,217,166,0.1)', color: '#00D9A6' }} />
                            )}
                            {camera.hasPTZ && (
                              <Chip label="PTZ" size="small"
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,181,71,0.1)', color: '#FFB547' }} />
                            )}
                            {camera.hasThermal && (
                              <Chip label="Thermal" size="small"
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,92,108,0.1)', color: '#FF5C6C' }} />
                            )}
                          </Box>
                        </Box>

                        {/* Actions */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {isOnline ? (
                            <Button fullWidth size="small" variant="outlined" color="error"
                              startIcon={isConnecting ? <CircularProgress size={14} /> : <LinkOffIcon />}
                              disabled={!!isConnecting}
                              onClick={() => handleDisconnect(camera._id)}
                            >
                              Disconnect
                            </Button>
                          ) : (
                            <Button fullWidth size="small" variant="contained"
                              startIcon={isConnecting ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
                              disabled={!!isConnecting}
                              onClick={() => handleConnect(camera._id)}
                              sx={{
                                background: 'linear-gradient(135deg, #00D9A6, #00AD85)',
                                '&:hover': { background: 'linear-gradient(135deg, #33E0B8, #00D9A6)' },
                              }}
                            >
                              Connect
                            </Button>
                          )}
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEdit(camera)}
                              sx={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </GlassCard>
                  </Grid>
                );
              })}
            </Grid>
          </AnimatedList>
        )}

        {/* Add/Edit Camera Dialog */}
        <AnimatedDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            {selectedCamera ? 'Edit Camera' : 'Add New Camera'}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#8892A8', mb: 3 }}>
              {selectedCamera
                ? 'Update the camera configuration below.'
                : 'Enter your CCTV camera details. You\'ll need the RTSP stream URL from your camera.'
              }
            </Typography>

            <Typography variant="caption" sx={{ color: '#6C63FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Connection
            </Typography>
            <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
              <Grid item xs={12}>
                <TextField fullWidth label="Camera Name" placeholder="e.g., Main Entrance"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="RTSP URL" placeholder="rtsp://192.168.1.100:554/stream1"
                  value={form.rtspUrl} onChange={(e) => setForm({ ...form, rtspUrl: e.target.value })} required
                  helperText="The RTSP stream address of your CCTV camera" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Username (optional)" placeholder="admin"
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Password (optional)" type="password"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={selectedCamera ? '(unchanged)' : ''} />
              </Grid>
            </Grid>

            <Typography variant="caption" sx={{ color: '#6C63FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Location
            </Typography>
            <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Zone / Area" placeholder="e.g., Main Entrance"
                  value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Floor" type="number" placeholder="1"
                  value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" placeholder="Camera facing the main door"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Grid>
            </Grid>

            <Typography variant="caption" sx={{ color: '#6C63FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Hardware
            </Typography>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Resolution</InputLabel>
                  <Select value={form.resolution} label="Resolution"
                    onChange={(e) => setForm({ ...form, resolution: e.target.value })}>
                    <MenuItem value="720p">720p</MenuItem>
                    <MenuItem value="1080p">1080p (Full HD)</MenuItem>
                    <MenuItem value="2K">2K</MenuItem>
                    <MenuItem value="4K">4K (Ultra HD)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Frame Rate (fps)" type="number"
                  value={form.frameRate} onChange={(e) => setForm({ ...form, frameRate: e.target.value })}
                  inputProps={{ min: 1, max: 60 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={<Switch checked={form.hasPTZ} onChange={(e) => setForm({ ...form, hasPTZ: e.target.checked })} />}
                  label="Pan-Tilt-Zoom (PTZ)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={<Switch checked={form.hasThermal} onChange={(e) => setForm({ ...form, hasThermal: e.target.checked })} />}
                  label="Thermal Sensor"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={saving}
              sx={{
                background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
                '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
              }}>
              {saving ? <CircularProgress size={20} color="inherit" /> : (selectedCamera ? 'Update Camera' : 'Add Camera')}
            </Button>
          </DialogActions>
        </AnimatedDialog>
      </Box>
    </AnimatedPage>
  );
};

export default CameraManagement;
