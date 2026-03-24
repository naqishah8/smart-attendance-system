import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Grid, CardContent,
  Select, MenuItem, FormControl, InputLabel, Chip,
  DialogTitle, DialogContent, DialogActions, Box, CircularProgress, Alert,
  useMediaQuery, useTheme
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { api } from '../services/api';
import { monoFont } from '../theme';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import AnimatedDialog from '../components/AnimatedDialog';
import AnimatedTableRow from '../components/AnimatedTableRow';
import MobileDataList from '../components/MobileDataList';
import { TableSkeleton } from '../components/SkeletonLoader';

const SalaryManagement = ({ isAdmin, user }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [salaries, setSalaries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => cur - 5 + i);
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => { loadSalaries(); }, [selectedMonth, selectedYear]);

  const loadSalaries = async () => {
    try {
      setError(null); setLoading(true);
      const data = await api.getSalaries(selectedMonth, selectedYear);
      setSalaries(data.salaries || data || []);
    } catch {
      setError('Failed to load salary data.');
    } finally { setLoading(false); }
  };

  const handleProcessAll = async () => {
    if (!window.confirm(`Process all salaries for ${months[selectedMonth - 1]} ${selectedYear}?`)) return;
    setProcessing(true);
    try {
      await api.processAllSalaries(selectedMonth, selectedYear);
      loadSalaries();
    } catch {
      setError('Failed to process salaries.');
    } finally { setProcessing(false); }
  };

  const handleViewPayslip = async (salaryId) => {
    try {
      const payslip = await api.getPayslip(salaryId);
      setSelectedPayslip(payslip);
      setPayslipOpen(true);
    } catch {
      setError('Failed to load payslip.');
    }
  };

  return (
    <AnimatedPage>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 4 } }}>
          <Box>
            <Typography variant="h4">{isAdmin ? 'Salary Management' : 'My Salary'}</Typography>
            <Typography variant="subtitle1">
              {isAdmin ? 'Process and manage employee salaries' : 'View your salary history and payslips'}
            </Typography>
          </Box>
          {isAdmin && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<DownloadIcon />}
                onClick={() => api.exportPayroll(selectedMonth, selectedYear)}>
                Export Excel
              </Button>
              <Button variant="contained" onClick={handleProcessAll} disabled={processing}
                sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
                  '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' } }}>
                {processing ? 'Processing...' : 'Process All Salaries'}
              </Button>
            </Box>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Selectors */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Month</InputLabel>
              <Select value={selectedMonth} label="Month" onChange={(e) => setSelectedMonth(e.target.value)}>
                {months.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Year</InputLabel>
              <Select value={selectedYear} label="Year" onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : isMobile ? (
          <MobileDataList
            items={salaries}
            accentColor={(s) => s.paymentStatus === 'paid' ? '#00D9A6' : s.paymentStatus === 'processed' ? '#4FC3F7' : '#6C63FF'}
            primaryKey={(s) => isAdmin ? `${s.userId?.firstName || ''} ${s.userId?.lastName || ''}` : 'Salary'}
            secondaryKey={(s) => (
              <Chip label={s.paymentStatus} size="small" sx={{
                textTransform: 'capitalize', height: 20, fontSize: '0.7rem',
                bgcolor: s.paymentStatus === 'paid' ? 'rgba(0,217,166,0.12)' : 'rgba(136,146,168,0.1)',
                color: s.paymentStatus === 'paid' ? '#00D9A6' : '#8892A8',
              }} />
            )}
            fields={[
              { label: 'Base', render: (s) => `$${s.baseSalary?.toLocaleString() || 0}` },
              { label: 'Days', render: (s) => `${s.daysPresent || 0}/${s.workingDaysInMonth || 0}` },
              { label: 'Net', render: (s) => `$${s.netSalary?.toLocaleString() || 0}`, color: () => '#00D9A6' },
              { label: 'Fines', render: (s) => `-$${s.fines?.reduce((sum, f) => sum + f.amount, 0)?.toLocaleString() || 0}`, color: () => '#FF5C6C' },
            ]}
            onItemClick={(s) => handleViewPayslip(s._id)}
            emptyText="No salary records for this period"
          />
        ) : (
          <GlassCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {isAdmin && <TableCell>Employee</TableCell>}
                    <TableCell>Base Salary</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Bonuses</TableCell>
                    <TableCell>Overtime</TableCell>
                    <TableCell>Fines</TableCell>
                    <TableCell>Loans</TableCell>
                    <TableCell>Net Salary</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 10 : 9} align="center" sx={{ py: 4, color: '#8892A8' }}>
                        No salary records for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    salaries.map((s, i) => (
                      <AnimatedTableRow key={s._id} index={i}>
                        {isAdmin && <TableCell>{s.userId?.firstName} {s.userId?.lastName}</TableCell>}
                        <TableCell sx={{ fontFamily: monoFont, fontSize: '0.82rem' }}>${s.baseSalary?.toLocaleString()}</TableCell>
                        <TableCell>{s.daysPresent}/{s.workingDaysInMonth}</TableCell>
                        <TableCell sx={{ color: '#00D9A6' }}>
                          +${s.bonuses?.reduce((sum, b) => sum + b.amount, 0)?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell sx={{ color: '#00D9A6' }}>+${s.overtimeEarnings?.toLocaleString() || 0}</TableCell>
                        <TableCell sx={{ color: '#FF5C6C' }}>
                          -${s.fines?.reduce((sum, f) => sum + f.amount, 0)?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell sx={{ color: '#FF5C6C' }}>
                          -${s.loanDeductions?.reduce((sum, l) => sum + l.amount, 0)?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700, fontFamily: monoFont, fontSize: '0.9rem' }}>${s.netSalary?.toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={s.paymentStatus} size="small"
                            sx={{
                              textTransform: 'capitalize',
                              bgcolor: s.paymentStatus === 'paid' ? 'rgba(0,217,166,0.12)' :
                                       s.paymentStatus === 'processed' ? 'rgba(79,195,247,0.12)' : 'rgba(136,146,168,0.1)',
                              color: s.paymentStatus === 'paid' ? '#00D9A6' :
                                     s.paymentStatus === 'processed' ? '#4FC3F7' : '#8892A8',
                            }} />
                        </TableCell>
                        <TableCell>
                          <Button size="small" onClick={() => handleViewPayslip(s._id)}>Payslip</Button>
                        </TableCell>
                      </AnimatedTableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        )}

        {/* Payslip Dialog */}
        <AnimatedDialog open={payslipOpen} onClose={() => setPayslipOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Typography variant="h6">Payslip - {selectedPayslip?.employee?.name}</Typography>
          </DialogTitle>
          <DialogContent>
            {selectedPayslip && (
              <Box sx={{ p: 2 }}>
                <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: '#8892A8', fontWeight: 600, textTransform: 'uppercase' }}>Employee</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{selectedPayslip.employee?.name}</Typography>
                    <Typography variant="body2" sx={{ color: '#8892A8' }}>ID: {selectedPayslip.employee?.employeeId}</Typography>
                    <Typography variant="body2" sx={{ color: '#8892A8' }}>Dept: {selectedPayslip.employee?.department}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: '#8892A8', fontWeight: 600, textTransform: 'uppercase' }}>Period</Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {months[selectedPayslip.period?.month - 1]} {selectedPayslip.period?.year}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}><Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} /></Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="h6" sx={{ color: '#00D9A6', mb: 1 }}>Earnings</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Base Salary</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>${selectedPayslip.earnings?.baseSalary?.toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Overtime</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>${selectedPayslip.earnings?.overtimeEarnings?.toLocaleString()}</Typography>
                      </Box>
                      {selectedPayslip.earnings?.bonuses?.map((b, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">{b.description}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>${b.amount?.toLocaleString()}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="h6" sx={{ color: '#FF5C6C', mb: 1 }}>Deductions</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Fines</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ${selectedPayslip.deductions?.fines?.reduce((s, f) => s + f.amount, 0)?.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Loans</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ${selectedPayslip.deductions?.loanDeductions?.reduce((s, l) => s + l.amount, 0)?.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Tax</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ${selectedPayslip.deductions?.taxDeductions?.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12}><Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} /></Grid>
                  <Grid item xs={12}>
                    <Box sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      p: 2, borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,217,166,0.05))',
                    }}>
                      <Typography variant="h6">Net Salary</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#00D9A6' }}>
                        ${selectedPayslip.netSalary?.toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setPayslipOpen(false)}>Close</Button>
          </DialogActions>
        </AnimatedDialog>
      </Box>
    </AnimatedPage>
  );
};

export default SalaryManagement;
