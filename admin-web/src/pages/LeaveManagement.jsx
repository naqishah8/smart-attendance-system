import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Grid, Button, Chip, CardContent,
  DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tab, Tabs, FormControlLabel, Checkbox,
  useMediaQuery, useTheme, IconButton, Tooltip, LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { api } from '../services/api';
import { monoFont } from '../theme';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import AnimatedDialog from '../components/AnimatedDialog';
import AnimatedTableRow from '../components/AnimatedTableRow';
import ToastNotification from '../components/ToastNotification';
import MobileDataList from '../components/MobileDataList';
import { TableSkeleton } from '../components/SkeletonLoader';

const statusColors = {
  pending: { bg: 'rgba(255,181,71,0.12)', color: '#FFB547' },
  approved: { bg: 'rgba(0,217,166,0.12)', color: '#00D9A6' },
  rejected: { bg: 'rgba(255,92,108,0.12)', color: '#FF5C6C' },
  cancelled: { bg: 'rgba(136,146,168,0.12)', color: '#8892A8' },
};

const leaveTypeLabels = {
  annual: 'Annual', sick: 'Sick', casual: 'Casual', maternity: 'Maternity',
  paternity: 'Paternity', compassionate: 'Compassionate', unpaid: 'Unpaid',
};

const LeaveManagement = ({ isAdmin = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tab, setTab] = useState(0);
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // Apply dialog
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'annual', startDate: '', endDate: '', reason: '',
    isHalfDay: false, halfDayPeriod: 'morning', isEmergency: false,
  });

  // Review dialog
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadData(); }, [tab, statusFilter]);

  const loadData = async () => {
    try {
      setError(null); setLoading(true);
      const [reqData, balData] = await Promise.all([
        api.getLeaveRequests({ status: statusFilter || undefined }),
        api.getLeaveBalance(),
      ]);
      setRequests(reqData.requests || []);
      setBalances(balData.balances || []);
    } catch {
      setError('Failed to load data.');
    } finally { setLoading(false); }
  };

  const handleApply = async () => {
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      setToast({ open: true, message: 'Fill all required fields.', severity: 'error' });
      return;
    }
    setApplying(true);
    try {
      await api.applyLeave(form);
      setToast({ open: true, message: 'Leave request submitted!', severity: 'success' });
      setApplyOpen(false);
      setForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '', isHalfDay: false, halfDayPeriod: 'morning', isEmergency: false });
      loadData();
    } catch (err) {
      setToast({ open: true, message: err.message || 'Failed to apply.', severity: 'error' });
    } finally { setApplying(false); }
  };

  const handleReview = async (action) => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      await api.reviewLeave(reviewTarget._id, action, reviewNote);
      setToast({ open: true, message: `Leave ${action}!`, severity: 'success' });
      setReviewOpen(false);
      setReviewTarget(null);
      setReviewNote('');
      loadData();
    } catch (err) {
      setToast({ open: true, message: err.message || 'Failed.', severity: 'error' });
    } finally { setReviewing(false); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await api.cancelLeave(id);
      setToast({ open: true, message: 'Leave cancelled.', severity: 'info' });
      loadData();
    } catch (err) {
      setToast({ open: true, message: err.message || 'Failed.', severity: 'error' });
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <AnimatedPage>
      <Box>
        <ToastNotification open={toast.open} message={toast.message} severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })} />

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 3 } }}>
          <Box>
            <Typography variant="h4">{isAdmin ? 'Leave Management' : 'My Leaves'}</Typography>
            <Typography variant="subtitle1">
              {isAdmin ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}` : 'Apply for leave and track your balance'}
            </Typography>
          </Box>
          {!isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setApplyOpen(true)}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
              Apply for Leave
            </Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Leave Balance Cards */}
        {!isAdmin && balances.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Leave Balance</Typography>
            <Grid container spacing={{ xs: 1, sm: 1.5 }}>
              {balances.filter(b => b.allocated > 0 || b.used > 0).map((b, i) => (
                <Grid item xs={6} sm={4} md={3} key={b.leaveType}>
                  <GlassCard delay={i * 0.04}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Typography variant="caption" sx={{ color: '#8892A8', fontWeight: 600, display: 'block', mb: 0.5 }}>
                        {b.name}
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontFamily: monoFont, fontSize: '1.4rem', color: b.available > 0 ? '#00D9A6' : '#FF5C6C' }}>
                        {b.available}
                      </Typography>
                      <LinearProgress variant="determinate"
                        value={b.allocated > 0 ? Math.min((b.used / b.allocated) * 100, 100) : 0}
                        sx={{
                          mt: 0.8, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 2,
                            bgcolor: b.used / b.allocated > 0.8 ? '#FF5C6C' : '#6C63FF',
                          },
                        }}
                      />
                      <Typography sx={{ fontSize: '0.65rem', color: '#555E73', mt: 0.4, fontFamily: monoFont }}>
                        {b.used}/{b.allocated} used
                        {b.pending > 0 && ` | ${b.pending} pending`}
                      </Typography>
                    </CardContent>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Filter */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {['', 'pending', 'approved', 'rejected', 'cancelled'].map(s => (
            <Chip key={s} label={s || 'All'} size="small"
              onClick={() => setStatusFilter(s)}
              sx={{
                textTransform: 'capitalize', fontWeight: 600, cursor: 'pointer',
                bgcolor: statusFilter === s ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.04)',
                color: statusFilter === s ? '#6C63FF' : '#8892A8',
                border: statusFilter === s ? '1px solid rgba(108,99,255,0.3)' : '1px solid transparent',
              }}
            />
          ))}
        </Box>

        {/* Requests */}
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : isMobile ? (
          <MobileDataList
            items={requests}
            accentColor={(r) => statusColors[r.status]?.color || '#8892A8'}
            primaryKey={(r) => isAdmin ? `${r.userId?.firstName || ''} ${r.userId?.lastName || ''}` : (leaveTypeLabels[r.leaveType] || r.leaveType)}
            secondaryKey={(r) => (
              <Chip label={r.status} size="small" sx={{ ...statusColors[r.status], height: 20, fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize' }} />
            )}
            fields={[
              ...(isAdmin ? [{ label: 'Type', render: (r) => leaveTypeLabels[r.leaveType] || r.leaveType }] : []),
              { label: 'From', render: (r) => new Date(r.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
              { label: 'To', render: (r) => new Date(r.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
              { label: 'Days', render: (r) => `${r.totalDays}`, color: () => '#E8ECF4' },
              { label: 'Reason', render: (r) => r.reason?.substring(0, 30) + (r.reason?.length > 30 ? '...' : '') },
            ]}
            onItemClick={isAdmin ? (r) => { if (r.status === 'pending') { setReviewTarget(r); setReviewOpen(true); } } : undefined}
            emptyText="No leave requests"
          />
        ) : (
          <GlassCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {isAdmin && <TableCell>Employee</TableCell>}
                    <TableCell>Type</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4, color: '#8892A8' }}>
                        No leave requests
                      </TableCell>
                    </TableRow>
                  ) : requests.map((r, i) => (
                    <AnimatedTableRow key={r._id} index={i}>
                      {isAdmin && <TableCell>{r.userId?.firstName} {r.userId?.lastName}</TableCell>}
                      <TableCell>
                        <Chip label={leaveTypeLabels[r.leaveType] || r.leaveType} size="small"
                          sx={{ bgcolor: 'rgba(108,99,255,0.1)', color: '#8B83FF', textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>{new Date(r.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                      <TableCell>{new Date(r.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                      <TableCell sx={{ fontFamily: monoFont, fontWeight: 600 }}>{r.totalDays}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reason}
                      </TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small"
                          sx={{ ...statusColors[r.status], fontWeight: 700, textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell align="right">
                        {isAdmin && r.status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Tooltip title="Approve">
                              <IconButton size="small" onClick={() => { setReviewTarget(r); setReviewOpen(true); }}
                                sx={{ color: '#00D9A6' }}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" onClick={() => { setReviewTarget(r); setReviewOpen(true); }}
                                sx={{ color: '#FF5C6C' }}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                        {!isAdmin && ['pending', 'approved'].includes(r.status) && (
                          <Button size="small" sx={{ color: '#FF5C6C' }} onClick={() => handleCancel(r._id)}>
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </AnimatedTableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        )}

        {/* Apply Leave Dialog */}
        <AnimatedDialog open={applyOpen} onClose={() => setApplyOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogContent>
            <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Leave Type</InputLabel>
                  <Select value={form.leaveType} label="Leave Type"
                    onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                    {Object.entries(leaveTypeLabels).map(([k, v]) => (
                      <MenuItem key={k} value={k}>{v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                  <FormControlLabel control={
                    <Checkbox checked={form.isHalfDay} onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked })} size="small" />
                  } label="Half Day" />
                  <FormControlLabel control={
                    <Checkbox checked={form.isEmergency} onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })} size="small" />
                  } label="Emergency" />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Start Date" type="date" value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="End Date" type="date" value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  InputLabelProps={{ shrink: true }} required />
              </Grid>
              {form.isHalfDay && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Half Day Period</InputLabel>
                    <Select value={form.halfDayPeriod} label="Half Day Period"
                      onChange={(e) => setForm({ ...form, halfDayPeriod: e.target.value })}>
                      <MenuItem value="morning">Morning</MenuItem>
                      <MenuItem value="afternoon">Afternoon</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField fullWidth label="Reason" value={form.reason} multiline rows={3}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  required placeholder="Why do you need this leave?" />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleApply} disabled={applying}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
              {applying ? <CircularProgress size={20} color="inherit" /> : 'Submit Request'}
            </Button>
          </DialogActions>
        </AnimatedDialog>

        {/* Review Dialog (Admin) */}
        <AnimatedDialog open={reviewOpen} onClose={() => setReviewOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Review Leave Request</DialogTitle>
          <DialogContent>
            {reviewTarget && (
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#8892A8' }}>Employee</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{reviewTarget.userId?.firstName} {reviewTarget.userId?.lastName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#8892A8' }}>Type</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{leaveTypeLabels[reviewTarget.leaveType]}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#8892A8' }}>Period</Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {new Date(reviewTarget.startDate).toLocaleDateString()} - {new Date(reviewTarget.endDate).toLocaleDateString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#8892A8' }}>Days</Typography>
                    <Typography sx={{ fontWeight: 700, fontFamily: monoFont }}>{reviewTarget.totalDays}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ color: '#8892A8' }}>Reason</Typography>
                    <Typography>{reviewTarget.reason}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Note (optional)" value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)} multiline rows={2}
                      placeholder="Add a note for the employee..." />
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setReviewOpen(false)}>Close</Button>
            <Button variant="outlined" color="error" onClick={() => handleReview('rejected')} disabled={reviewing}>
              Reject
            </Button>
            <Button variant="contained" onClick={() => handleReview('approved')} disabled={reviewing}
              sx={{ background: 'linear-gradient(135deg, #00D9A6, #00AD85)' }}>
              {reviewing ? <CircularProgress size={20} color="inherit" /> : 'Approve'}
            </Button>
          </DialogActions>
        </AnimatedDialog>
      </Box>
    </AnimatedPage>
  );
};

export default LeaveManagement;
