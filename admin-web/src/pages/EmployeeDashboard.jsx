import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box,
  Alert, Chip, LinearProgress, Avatar
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { api } from '../services/api';
import AnimatedPage from '../components/AnimatedPage';
import StatCard from '../components/StatCard';
import GlassCard from '../components/GlassCard';
import AnimatedList from '../components/AnimatedList';
import { DashboardSkeleton } from '../components/SkeletonLoader';

const EmployeeDashboard = ({ user }) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        const data = await api.getAttendance({ startDate: monthStart, endDate: today });
        setAttendance(data.records || data.attendances || []);
      } catch (err) {
        setError('Failed to load attendance data.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const lateDays = attendance.filter(a => a.status === 'late').length;
  const absentDays = attendance.filter(a => a.status === 'absent').length;
  const totalHours = attendance.reduce((sum, a) => sum + (a.effectiveWorkHours || 0), 0);
  const avgHours = presentDays > 0 ? (totalHours / presentDays).toFixed(1) : '0';
  const currentDay = new Date().getDate();
  const attendanceRate = currentDay > 0 ? ((presentDays / currentDay) * 100).toFixed(0) : 0;

  return (
    <AnimatedPage>
      <Box sx={{ mb: { xs: 2, sm: 4 } }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Welcome back, {user.firstName}
        </Typography>
        <Typography variant="subtitle1">
          Here's your attendance overview for this month
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title="Days Present" value={presentDays} sub={`out of ${currentDay} days`}
            icon={<EventAvailableIcon />}
            gradient="linear-gradient(135deg, #00D9A6, #00AD85)"
            delay={0}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title="Late Arrivals" value={lateDays} sub="this month"
            icon={<AccessTimeIcon />}
            gradient="linear-gradient(135deg, #FFB547, #FF9800)"
            delay={0.05}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title="Avg Work Hours" value={`${avgHours}h`} sub="per day"
            icon={<TrendingUpIcon />}
            gradient="linear-gradient(135deg, #6C63FF, #4A42CC)"
            delay={0.1}
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title="Absent Days" value={absentDays} sub="this month"
            icon={<CalendarTodayIcon />}
            gradient="linear-gradient(135deg, #FF5C6C, #E63946)"
            delay={0.15}
          />
        </Grid>
      </Grid>

      {/* Attendance Rate */}
      <GlassCard delay={0.2} sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Attendance Rate</Typography>
            <Chip label={`${attendanceRate}%`}
              sx={{
                fontWeight: 700, fontSize: { xs: '0.85rem', sm: '1rem' },
                bgcolor: attendanceRate >= 90 ? 'rgba(0,217,166,0.15)' : attendanceRate >= 75 ? 'rgba(255,181,71,0.15)' : 'rgba(255,92,108,0.15)',
                color: attendanceRate >= 90 ? '#00D9A6' : attendanceRate >= 75 ? '#FFB547' : '#FF5C6C',
              }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(Number(attendanceRate), 100)}
            sx={{
              height: 10, borderRadius: 5,
              bgcolor: 'rgba(255,255,255,0.05)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
                background: attendanceRate >= 90
                  ? 'linear-gradient(90deg, #00D9A6, #00AD85)'
                  : attendanceRate >= 75
                  ? 'linear-gradient(90deg, #FFB547, #FF9800)'
                  : 'linear-gradient(90deg, #FF5C6C, #E63946)',
              },
            }}
          />
        </CardContent>
      </GlassCard>

      {/* Recent Activity */}
      <GlassCard delay={0.25}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Recent Attendance</Typography>
          {attendance.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#8892A8', py: 3, textAlign: 'center' }}>
              No attendance records this month yet.
            </Typography>
          ) : (
            <AnimatedList>
              {attendance.slice(0, 10).map((a, i) => (
                <Box key={i} sx={{
                  display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' },
                  py: 1.5, px: 2, borderRadius: '8px', gap: { xs: 0.5, sm: 0 },
                  bgcolor: 'rgba(255,255,255,0.02)',
                  '&:hover': { bgcolor: 'rgba(108,99,255,0.05)' },
                }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8892A8' }}>
                      {a.firstDetection ? new Date(a.firstDetection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      {' - '}
                      {a.lastDetection ? new Date(a.lastDetection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="body2" sx={{ color: '#8892A8' }}>
                      {(a.effectiveWorkHours || 0).toFixed(1)}h
                    </Typography>
                    <Chip
                      label={a.status}
                      size="small"
                      sx={{
                        fontWeight: 600, textTransform: 'capitalize',
                        bgcolor: a.status === 'present' ? 'rgba(0,217,166,0.12)' :
                                 a.status === 'late' ? 'rgba(255,181,71,0.12)' :
                                 'rgba(255,92,108,0.12)',
                        color: a.status === 'present' ? '#00D9A6' :
                               a.status === 'late' ? '#FFB547' : '#FF5C6C',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </AnimatedList>
          )}
        </CardContent>
      </GlassCard>
    </AnimatedPage>
  );
};

export default EmployeeDashboard;
