import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Grid, CardContent, Button, Chip,
  CircularProgress, Alert, IconButton, Tooltip,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { api } from '../services/api';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import AnimatedList from '../components/AnimatedList';
import ToastNotification from '../components/ToastNotification';
import { CardGridSkeleton } from '../components/SkeletonLoader';

const impactConfig = {
  critical: { color: '#FF5C6C', bg: 'rgba(255,92,108,0.1)', icon: <ErrorIcon /> },
  high: { color: '#FFB547', bg: 'rgba(255,181,71,0.1)', icon: <WarningIcon /> },
  medium: { color: '#6C63FF', bg: 'rgba(108,99,255,0.1)', icon: <TipsAndUpdatesIcon /> },
  low: { color: '#00D9A6', bg: 'rgba(0,217,166,0.1)', icon: <InfoIcon /> },
};

const InsightsPage = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');

  useEffect(() => { loadInsights(); }, [categoryFilter, statusFilter]);

  const loadInsights = async () => {
    try {
      setError(null); setLoading(true);
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await api.getInsights(params);
      setInsights(data.insights || []);
    } catch {
      setError('Failed to load insights.');
    } finally { setLoading(false); }
  };

  const handleRunAnalysis = async () => {
    setRunning(true);
    try {
      const result = await api.runInsightsAnalysis();
      setToast({ open: true, message: `Analysis complete! ${result.count} new insights generated.`, severity: 'success' });
      loadInsights();
    } catch {
      setToast({ open: true, message: 'Analysis failed.', severity: 'error' });
    } finally { setRunning(false); }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.acknowledgeInsight(id);
      loadInsights();
    } catch { /* ignore */ }
  };

  const handleDismiss = async (id) => {
    try {
      await api.dismissInsight(id);
      loadInsights();
    } catch { /* ignore */ }
  };

  return (
    <AnimatedPage>
      <Box>
        <ToastNotification open={toast.open} message={toast.message} severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 4 } }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#6C63FF' }} />
              <Typography variant="h4">AI Insights</Typography>
            </Box>
            <Typography variant="subtitle1">System-generated recommendations based on your data</Typography>
          </Box>
          <Button variant="contained" startIcon={running ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={handleRunAnalysis} disabled={running}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
            {running ? 'Analyzing...' : 'Run Analysis Now'}
          </Button>
        </Box>

        {/* Filters */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="attendance-trend">Attendance Trends</MenuItem>
                <MenuItem value="department-anomaly">Department Issues</MenuItem>
                <MenuItem value="camera-performance">Camera Performance</MenuItem>
                <MenuItem value="overtime-alert">Overtime Alerts</MenuItem>
                <MenuItem value="shift-optimization">Shift Optimization</MenuItem>
                <MenuItem value="attrition-risk">Attrition Risk</MenuItem>
                <MenuItem value="fine-pattern">Fine Patterns</MenuItem>
                <MenuItem value="engagement">Engagement</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="acknowledged">Acknowledged</MenuItem>
                <MenuItem value="acted-on">Acted On</MenuItem>
                <MenuItem value="dismissed">Dismissed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <CardGridSkeleton count={4} />
        ) : insights.length === 0 ? (
          <GlassCard sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <AutoAwesomeIcon sx={{ fontSize: 64, color: '#555E73', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 1 }}>No insights yet</Typography>
              <Typography variant="body2" sx={{ color: '#8892A8', mb: 3 }}>
                Click "Run Analysis Now" to generate insights from your data.
              </Typography>
            </CardContent>
          </GlassCard>
        ) : (
          <AnimatedList>
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {insights.map((insight, idx) => {
                const config = impactConfig[insight.impact] || impactConfig.medium;
                return (
                  <Grid item xs={12} key={insight._id}>
                    <GlassCard delay={idx * 0.05} sx={{ borderLeft: `4px solid ${config.color}` }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                              <Box sx={{
                                width: 32, height: 32, borderRadius: '8px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                bgcolor: config.bg, color: config.color
                              }}>
                                {config.icon}
                              </Box>
                              <Typography variant="h6" sx={{ fontSize: '1rem' }}>{insight.title}</Typography>
                              <Chip label={insight.impact} size="small"
                                sx={{ bgcolor: config.bg, color: config.color, fontWeight: 600, textTransform: 'capitalize' }} />
                              <Chip label={insight.category.replace(/-/g, ' ')} size="small"
                                sx={{ bgcolor: 'rgba(136,146,168,0.1)', color: '#8892A8', textTransform: 'capitalize' }} />
                            </Box>
                            <Typography variant="body2" sx={{ color: '#8892A8', mb: 1.5, ml: { xs: 0, md: 5.5 } }}>
                              {insight.description}
                            </Typography>
                            <Box sx={{
                              ml: { xs: 0, md: 5.5 }, p: 1.5, borderRadius: '8px',
                              bgcolor: 'rgba(0,217,166,0.05)', border: '1px solid rgba(0,217,166,0.1)'
                            }}>
                              <Typography variant="body2" sx={{ color: '#00D9A6', fontWeight: 500 }}>
                                Suggestion: {insight.suggestion}
                              </Typography>
                            </Box>
                            {insight.data?.changePercent && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, ml: { xs: 0, md: 5.5 } }}>
                                <TrendingUpIcon sx={{ fontSize: 16, color: '#8892A8' }} />
                                <Typography variant="caption" sx={{ color: '#8892A8' }}>
                                  {insight.data.changePercent > 0 ? '+' : ''}{insight.data.changePercent.toFixed(1)}% change
                                  {insight.data.affectedCount ? ` | ${insight.data.affectedCount} affected` : ''}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                          {insight.status === 'new' && (
                            <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
                              <Tooltip title="Acknowledge">
                                <IconButton size="small" onClick={() => handleAcknowledge(insight._id)}
                                  sx={{ color: '#00D9A6' }}>
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Dismiss">
                                <IconButton size="small" onClick={() => handleDismiss(insight._id)}
                                  sx={{ color: '#8892A8' }}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </GlassCard>
                  </Grid>
                );
              })}
            </Grid>
          </AnimatedList>
        )}
      </Box>
    </AnimatedPage>
  );
};

export default InsightsPage;
