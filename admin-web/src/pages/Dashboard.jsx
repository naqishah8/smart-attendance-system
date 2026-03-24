import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Box, Chip, Alert, Avatar
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelIcon from '@mui/icons-material/Cancel';
import VideocamIcon from '@mui/icons-material/Videocam';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { api } from '../services/api';
import AnimatedPage from '../components/AnimatedPage';
import StatCard from '../components/StatCard';
import GlassCard from '../components/GlassCard';
import AnimatedList from '../components/AnimatedList';
import AnimatedTableRow from '../components/AnimatedTableRow';
import AnimatedCounter from '../components/AnimatedCounter';
import PulsingDot from '../components/PulsingDot';
import { DashboardSkeleton } from '../components/SkeletonLoader';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0, presentToday: 0, lateToday: 0, absentToday: 0, finesToday: 0
  });
  const [liveCameras, setLiveCameras] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    const loadData = async () => {
      try {
        setError(null);
        const data = await api.getDashboardStats({ signal: abortController.signal });
        setStats(data.stats || {});
        setLiveCameras(data.cameras || []);
        setRecentDetections(data.detections || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Failed to load dashboard data.');
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => { clearInterval(interval); abortController.abort(); };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <AnimatedPage>
      <Box sx={{ mb: { xs: 2, sm: 4 } }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>Admin Dashboard</Typography>
        <Typography variant="subtitle1">Real-time overview of attendance and system status</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Stats */}
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard title="Total Employees" value={stats.totalEmployees || 0}
            icon={<PeopleIcon />} gradient="linear-gradient(135deg, #6C63FF, #4A42CC)"
            delay={0} />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard title="Present Today" value={stats.presentToday || 0}
            icon={<CheckCircleIcon />} gradient="linear-gradient(135deg, #00D9A6, #00AD85)"
            textColor="#00D9A6" delay={0.05} />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard title="Late Today" value={stats.lateToday || 0}
            icon={<AccessTimeIcon />} gradient="linear-gradient(135deg, #FFB547, #FF9800)"
            textColor="#FFB547" delay={0.1} />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard title="Absent Today" value={stats.absentToday || 0}
            icon={<CancelIcon />} gradient="linear-gradient(135deg, #FF5C6C, #E63946)"
            textColor="#FF5C6C" delay={0.15} />
        </Grid>
      </Grid>

      {/* Camera Feeds */}
      {liveCameras.length > 0 && (
        <>
          <Typography variant="h5" sx={{ mb: 2 }}>Live Cameras</Typography>
          <AnimatedList>
            <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 4 }}>
              {liveCameras.map((camera, i) => {
                const isOnline = camera.status === 'online';
                return (
                  <Grid item xs={12} sm={6} md={4} key={i}>
                    <GlassCard delay={0.05 * i} sx={{ borderTop: `3px solid ${isOnline ? '#00D9A6' : '#555E73'}` }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VideocamIcon sx={{ color: isOnline ? '#00D9A6' : '#555E73', fontSize: 20 }} />
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{camera.name}</Typography>
                          </Box>
                          <Chip
                            icon={isOnline ? <PulsingDot color="#00D9A6" size={8} /> : <FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />}
                            label={camera.status} size="small"
                            sx={{
                              bgcolor: isOnline ? 'rgba(0,217,166,0.12)' : 'rgba(136,146,168,0.12)',
                              color: isOnline ? '#00D9A6' : '#8892A8',
                              '& .MuiChip-icon': { color: isOnline ? '#00D9A6' : '#8892A8' },
                            }}
                          />
                        </Box>
                        <Box sx={{
                          height: 120, borderRadius: '8px',
                          background: 'linear-gradient(135deg, #0a1628, #131829)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                          <Typography variant="caption" sx={{ color: isOnline ? '#00D9A6' : '#555E73' }}>
                            {isOnline ? 'Live Feed' : 'Offline'}
                          </Typography>
                        </Box>
                        {camera.location && (
                          <Typography variant="caption" sx={{ color: '#8892A8', mt: 1, display: 'block' }}>
                            {camera.location.zone || camera.location}
                          </Typography>
                        )}
                      </CardContent>
                    </GlassCard>
                  </Grid>
                );
              })}
            </Grid>
          </AnimatedList>
        </>
      )}

      {/* Recent Detections */}
      <Typography variant="h5" sx={{ mb: 2 }}>Recent Detections</Typography>
      <GlassCard delay={0.2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Time</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Camera</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>PPE</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Emotion</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentDetections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#8892A8' }}>
                    No recent detections
                  </TableCell>
                </TableRow>
              ) : (
                recentDetections.map((d, i) => (
                  <AnimatedTableRow key={i} index={i}>
                    <TableCell>{d.employeeName}</TableCell>
                    <TableCell>{new Date(d.timestamp).toLocaleTimeString()}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{d.cameraName}</TableCell>
                    <TableCell>{(d.confidence * 100).toFixed(1)}%</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Chip label={d.ppeCompliant ? 'OK' : 'Violation'} size="small"
                        sx={{
                          bgcolor: d.ppeCompliant ? 'rgba(0,217,166,0.12)' : 'rgba(255,92,108,0.12)',
                          color: d.ppeCompliant ? '#00D9A6' : '#FF5C6C',
                        }} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, textTransform: 'capitalize' }}>{d.emotion || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={d.status} size="small" sx={{
                        textTransform: 'capitalize',
                        bgcolor: d.status === 'present' ? 'rgba(0,217,166,0.12)' :
                                 d.status === 'late' ? 'rgba(255,181,71,0.12)' : 'rgba(255,92,108,0.12)',
                        color: d.status === 'present' ? '#00D9A6' :
                               d.status === 'late' ? '#FFB547' : '#FF5C6C',
                      }} />
                    </TableCell>
                  </AnimatedTableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </GlassCard>

      {/* Fines */}
      {(stats.finesToday > 0) && (
        <GlassCard delay={0.3} sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: '#8892A8', mb: 1 }}>Fines This Month</Typography>
            <Typography variant="h3" sx={{ color: '#FF5C6C', fontWeight: 700 }}>
              <AnimatedCounter value={stats.finesToday} prefix="$" />
            </Typography>
          </CardContent>
        </GlassCard>
      )}
    </AnimatedPage>
  );
};

export default Dashboard;
