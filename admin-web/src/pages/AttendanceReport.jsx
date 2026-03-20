import React, { useState, useEffect } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, TextField, Grid,
  Card, CardContent, Chip, Box, FormControl, InputLabel,
  Select, MenuItem
} from '@mui/material';
import { api } from '../services/api';

const AttendanceReport = () => {
  const [attendances, setAttendances] = useState([]);
  const [summary, setSummary] = useState({});
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  useEffect(() => {
    loadAttendance();
  }, [startDate, endDate, statusFilter, departmentFilter]);

  const loadAttendance = async () => {
    try {
      const params = {
        startDate,
        endDate
      };
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department = departmentFilter;

      const data = await api.getAttendance(params);
      setAttendances(data.attendances || []);
      setSummary(data.summary || {});
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'success';
      case 'late': return 'warning';
      case 'absent': return 'error';
      case 'half-day': return 'info';
      case 'leave': return 'default';
      default: return 'default';
    }
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>Attendance Reports</Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Present</Typography>
              <Typography variant="h4" sx={{ color: 'green' }}>{summary.present || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Late</Typography>
              <Typography variant="h4" sx={{ color: 'orange' }}>{summary.late || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Absent</Typography>
              <Typography variant="h4" sx={{ color: 'red' }}>{summary.absent || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Half Day</Typography>
              <Typography variant="h4" sx={{ color: '#1976d2' }}>{summary.halfDay || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Avg Hours</Typography>
              <Typography variant="h4">{(summary.averageWorkHours || 0).toFixed(1)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            fullWidth
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="present">Present</MenuItem>
              <MenuItem value="late">Late</MenuItem>
              <MenuItem value="absent">Absent</MenuItem>
              <MenuItem value="half-day">Half Day</MenuItem>
              <MenuItem value="leave">Leave</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Department</InputLabel>
            <Select
              value={departmentFilter}
              label="Department"
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <MenuItem value="">All Departments</MenuItem>
              <MenuItem value="Engineering">Engineering</MenuItem>
              <MenuItem value="HR">HR</MenuItem>
              <MenuItem value="Finance">Finance</MenuItem>
              <MenuItem value="Operations">Operations</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Attendance Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>First In</TableCell>
              <TableCell>Last Out</TableCell>
              <TableCell>Work Hours</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Late (min)</TableCell>
              <TableCell>Overtime (hrs)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attendances.map((att) => (
              <TableRow key={att._id}>
                <TableCell>{att.userId?.firstName} {att.userId?.lastName}</TableCell>
                <TableCell>{new Date(att.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  {att.firstDetection ? new Date(att.firstDetection).toLocaleTimeString() : '-'}
                </TableCell>
                <TableCell>
                  {att.lastDetection ? new Date(att.lastDetection).toLocaleTimeString() : '-'}
                </TableCell>
                <TableCell>{(att.effectiveWorkHours || 0).toFixed(1)}</TableCell>
                <TableCell>
                  <Chip
                    label={att.status}
                    color={getStatusColor(att.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {att.shiftCompliance?.wasLate ? att.shiftCompliance.lateMinutes : '-'}
                </TableCell>
                <TableCell>
                  {att.shiftCompliance?.overtimeHours
                    ? att.shiftCompliance.overtimeHours.toFixed(1)
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default AttendanceReport;
