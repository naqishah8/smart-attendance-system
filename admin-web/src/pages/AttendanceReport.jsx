import React, { useState, useEffect } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, Grid,
  CardContent, Chip, Box, FormControl, InputLabel,
  Select, MenuItem, CircularProgress, Alert, Avatar,
  useMediaQuery, useTheme
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelIcon from '@mui/icons-material/Cancel';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { api } from '../services/api';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import AnimatedTableRow from '../components/AnimatedTableRow';
import MobileDataList from '../components/MobileDataList';
import { TableSkeleton } from '../components/SkeletonLoader';

const AttendanceReport = ({ isAdmin, user }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [attendances, setAttendances] = useState([]);
  const [summary, setSummary] = useState({});
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateError, setDateError] = useState(null);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      setDateError('Start date must be before end date.');
      return;
    }
    setDateError(null);
    loadAttendance();
  }, [startDate, endDate, statusFilter, departmentFilter]);

  const loadAttendance = async () => {
    try {
      setError(null); setLoading(true);
      const params = { startDate, endDate };
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department = departmentFilter;
      const data = await api.getAttendance(params);
      setAttendances(data.attendances || data.records || []);
      setSummary(data.summary || {});
    } catch {
      setError('Failed to load attendance data.');
    } finally { setLoading(false); }
  };

  const getStatusChip = (status) => {
    const map = {
      present: { bg: 'rgba(0,217,166,0.12)', color: '#00D9A6' },
      late: { bg: 'rgba(255,181,71,0.12)', color: '#FFB547' },
      absent: { bg: 'rgba(255,92,108,0.12)', color: '#FF5C6C' },
      'half-day': { bg: 'rgba(79,195,247,0.12)', color: '#4FC3F7' },
      leave: { bg: 'rgba(136,146,168,0.12)', color: '#8892A8' },
    };
    const s = map[status] || map.leave;
    return <Chip label={status} size="small" sx={{ bgcolor: s.bg, color: s.color, textTransform: 'capitalize', fontWeight: 600 }} />;
  };

  return (
    <AnimatedPage>
      <Box>
        <Box sx={{ mb: { xs: 2, sm: 4 } }}>
          <Typography variant="h4">{isAdmin ? 'Attendance Reports' : 'My Attendance'}</Typography>
          <Typography variant="subtitle1">
            {isAdmin ? 'View attendance records across the organization' : 'Your attendance history and records'}
          </Typography>
        </Box>

        {/* Summary */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard compact title="Present" value={summary.present || 0}
              icon={<CheckCircleIcon sx={{ fontSize: 18 }} />} gradient="linear-gradient(135deg, #00D9A6, #00AD85)" textColor="#00D9A6" delay={0} />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard compact title="Late" value={summary.late || 0}
              icon={<AccessTimeIcon sx={{ fontSize: 18 }} />} gradient="linear-gradient(135deg, #FFB547, #FF9800)" textColor="#FFB547" delay={0.05} />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard compact title="Absent" value={summary.absent || 0}
              icon={<CancelIcon sx={{ fontSize: 18 }} />} gradient="linear-gradient(135deg, #FF5C6C, #E63946)" textColor="#FF5C6C" delay={0.1} />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard compact title="Half Day" value={summary.halfDay || 0}
              icon={<ScheduleIcon sx={{ fontSize: 18 }} />} gradient="linear-gradient(135deg, #4FC3F7, #039BE5)" textColor="#4FC3F7" delay={0.15} />
          </Grid>
          <Grid item xs={6} sm={4} md={2.4}>
            <StatCard compact title="Avg Hours" value={(summary.averageWorkHours || 0).toFixed(1)}
              icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} gradient="linear-gradient(135deg, #6C63FF, #4A42CC)" delay={0.2} />
          </Grid>
        </Grid>

        {/* Filters */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Start Date" type="date" value={startDate} size="small"
              onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }}
              error={!!dateError} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="End Date" type="date" value={endDate} size="small"
              onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }}
              error={!!dateError} helperText={dateError} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="present">Present</MenuItem>
                <MenuItem value="late">Late</MenuItem>
                <MenuItem value="absent">Absent</MenuItem>
                <MenuItem value="half-day">Half Day</MenuItem>
                <MenuItem value="leave">Leave</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {isAdmin && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={departmentFilter} label="Department" onChange={(e) => setDepartmentFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Engineering">Engineering</MenuItem>
                  <MenuItem value="HR">HR</MenuItem>
                  <MenuItem value="Finance">Finance</MenuItem>
                  <MenuItem value="Operations">Operations</MenuItem>
                  <MenuItem value="Marketing">Marketing</MenuItem>
                  <MenuItem value="Sales">Sales</MenuItem>
                  <MenuItem value="IT">IT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : isMobile ? (
          <MobileDataList
            items={attendances}
            accentColor={(a) => a.status === 'present' ? '#00D9A6' : a.status === 'late' ? '#FFB547' : '#FF5C6C'}
            primaryKey={(a) => new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            secondaryKey={(a) => getStatusChip(a.status)}
            fields={[
              ...(isAdmin ? [{ label: 'Employee', render: (a) => `${a.userId?.firstName || ''} ${a.userId?.lastName || ''}` }] : []),
              { label: 'In', render: (a) => a.firstDetection ? new Date(a.firstDetection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-' },
              { label: 'Out', render: (a) => a.lastDetection ? new Date(a.lastDetection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-' },
              { label: 'Hours', render: (a) => `${(a.effectiveWorkHours || 0).toFixed(1)}h` },
              { label: 'Late', render: (a) => a.shiftCompliance?.wasLate ? `${a.shiftCompliance.lateMinutes} min` : '-',
                color: (a) => a.shiftCompliance?.wasLate ? '#FFB547' : '#555E73' },
            ]}
            emptyText="No attendance records found"
          />
        ) : (
          <GlassCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {isAdmin && <TableCell>Employee</TableCell>}
                    <TableCell>Date</TableCell>
                    <TableCell>In</TableCell>
                    <TableCell>Out</TableCell>
                    <TableCell>Hours</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Late</TableCell>
                    <TableCell>Overtime</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4, color: '#8892A8' }}>
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendances.map((att, i) => (
                      <AnimatedTableRow key={att._id} index={i}>
                        {isAdmin && <TableCell>{att.userId?.firstName} {att.userId?.lastName}</TableCell>}
                        <TableCell>{new Date(att.date).toLocaleDateString()}</TableCell>
                        <TableCell>{att.firstDetection ? new Date(att.firstDetection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                        <TableCell>{att.lastDetection ? new Date(att.lastDetection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                        <TableCell>{(att.effectiveWorkHours || 0).toFixed(1)}</TableCell>
                        <TableCell>{getStatusChip(att.status)}</TableCell>
                        <TableCell sx={{ color: att.shiftCompliance?.wasLate ? '#FFB547' : '#8892A8' }}>
                          {att.shiftCompliance?.wasLate ? `${att.shiftCompliance.lateMinutes} min` : '-'}
                        </TableCell>
                        <TableCell sx={{ color: att.shiftCompliance?.overtimeHours ? '#00D9A6' : '#8892A8' }}>
                          {att.shiftCompliance?.overtimeHours ? `${att.shiftCompliance.overtimeHours.toFixed(1)}h` : '-'}
                        </TableCell>
                      </AnimatedTableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        )}
      </Box>
    </AnimatedPage>
  );
};

export default AttendanceReport;
