import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Select, MenuItem, Box, Chip
} from '@mui/material';
import { api } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    finesToday: 0
  });

  const [liveCameras, setLiveCameras] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);

  useEffect(() => {
    loadDashboardData();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const dashboardData = await api.getDashboardStats();
      setStats(dashboardData.stats);
      setLiveCameras(dashboardData.cameras);
      setRecentDetections(dashboardData.detections);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  return (
    <div className="dashboard">
      <Typography variant="h4" gutterBottom>Attendance Dashboard</Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Total Employees</Typography>
              <Typography variant="h3">{stats.totalEmployees}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Present Today</Typography>
              <Typography variant="h3" sx={{ color: 'green' }}>{stats.presentToday}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Late Today</Typography>
              <Typography variant="h3" sx={{ color: 'orange' }}>{stats.lateToday}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>Absent Today</Typography>
              <Typography variant="h3" sx={{ color: 'red' }}>{stats.absentToday}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Live Camera Feeds */}
      <Typography variant="h5" gutterBottom>Live Camera Feeds</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {liveCameras.map((camera) => (
          <Grid item xs={12} sm={6} md={4} key={camera._id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">{camera.name}</Typography>
                  <Chip
                    label={camera.status}
                    color={camera.status === 'online' ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box
                  sx={{
                    backgroundColor: '#000',
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1
                  }}
                >
                  <Typography color="white">
                    {camera.status === 'online' ? 'Live Feed' : 'Offline'}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  {camera.location?.zone} - Floor {camera.location?.floor}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Detections */}
      <Typography variant="h5" gutterBottom>Recent Detections</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Camera</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>PPE Status</TableCell>
              <TableCell>Emotion</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentDetections.map((detection, index) => (
              <TableRow key={index}>
                <TableCell>{detection.employeeName}</TableCell>
                <TableCell>{new Date(detection.timestamp).toLocaleTimeString()}</TableCell>
                <TableCell>{detection.cameraName}</TableCell>
                <TableCell>{(detection.confidence * 100).toFixed(1)}%</TableCell>
                <TableCell>
                  <Chip
                    label={detection.ppeCompliant ? 'Compliant' : 'Violation'}
                    color={detection.ppeCompliant ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{detection.emotion || 'N/A'}</TableCell>
                <TableCell>
                  <Chip
                    label={detection.status}
                    color={
                      detection.status === 'present' ? 'success' :
                      detection.status === 'late' ? 'warning' : 'error'
                    }
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Fines Today */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h5" gutterBottom>Fines Today</Typography>
        <Card>
          <CardContent>
            <Typography variant="h3" sx={{ color: 'red' }}>${stats.finesToday}</Typography>
            <Typography color="textSecondary">Total fines issued today</Typography>
          </CardContent>
        </Card>
      </Box>
    </div>
  );
};

export default Dashboard;
