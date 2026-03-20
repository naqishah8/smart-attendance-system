import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Grid, Card, CardContent,
  Select, MenuItem, FormControl, InputLabel, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Box, CircularProgress, Alert
} from '@mui/material';
import { api } from '../services/api';

const SalaryManagement = () => {
  const [salaries, setSalaries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamic year range: 5 years back from current year to 1 year ahead
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 1;
    const result = [];
    for (let y = startYear; y <= endYear; y++) {
      result.push(y);
    }
    return result;
  }, []);

  useEffect(() => {
    loadSalaries();
  }, [selectedMonth, selectedYear]);

  const loadSalaries = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await api.getSalaries(selectedMonth, selectedYear);
      setSalaries(data.salaries || data || []);
    } catch (err) {
      setError('Failed to load salary data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessAll = async () => {
    if (!window.confirm(`Process salaries for ${selectedMonth}/${selectedYear}?`)) return;
    setProcessing(true);
    try {
      await api.processAllSalaries(selectedMonth, selectedYear);
      loadSalaries();
    } catch (err) {
      setError('Failed to process salaries. Please try again later.');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewPayslip = async (salaryId) => {
    try {
      const payslip = await api.getPayslip(salaryId);
      setSelectedPayslip(payslip);
      setPayslipOpen(true);
    } catch (err) {
      setError('Failed to load payslip. Please try again later.');
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div aria-label="Salary management page">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Salary Management</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleProcessAll}
          disabled={processing}
          aria-label="Process all salaries"
        >
          {processing ? 'Processing...' : 'Process All Salaries'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} aria-label="Salary error message">{error}</Alert>
      )}

      {/* Month/Year Selector */}
      <Grid container spacing={2} sx={{ mb: 3 }} aria-label="Salary period selector">
        <Grid item xs={6} sm={3}>
          <FormControl fullWidth>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              label="Month"
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select month"
            >
              {months.map((m, i) => (
                <MenuItem key={i} value={i + 1}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={3}>
          <FormControl fullWidth>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Select year"
            >
              {years.map(y => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }} aria-label="Loading salary data">
          <CircularProgress aria-label="Loading spinner" />
        </Box>
      ) : (
        /* Salary Table */
        <TableContainer component={Paper} aria-label="Salary records table">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Base Salary</TableCell>
                <TableCell>Days Present</TableCell>
                <TableCell>Bonuses</TableCell>
                <TableCell>Overtime</TableCell>
                <TableCell>Fines</TableCell>
                <TableCell>Loan Deductions</TableCell>
                <TableCell>Net Salary</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salaries.map((salary) => (
                <TableRow key={salary._id}>
                  <TableCell>
                    {salary.userId?.firstName} {salary.userId?.lastName}
                  </TableCell>
                  <TableCell>${salary.baseSalary?.toLocaleString()}</TableCell>
                  <TableCell>{salary.daysPresent}/{salary.workingDaysInMonth}</TableCell>
                  <TableCell sx={{ color: 'green' }}>
                    +${salary.bonuses?.reduce((s, b) => s + b.amount, 0)?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell sx={{ color: 'green' }}>
                    +${salary.overtimeEarnings?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell sx={{ color: 'red' }}>
                    -${salary.fines?.reduce((s, f) => s + f.amount, 0)?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell sx={{ color: 'red' }}>
                    -${salary.loanDeductions?.reduce((s, l) => s + l.amount, 0)?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell>
                    <strong>${salary.netSalary?.toLocaleString()}</strong>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={salary.paymentStatus}
                      color={
                        salary.paymentStatus === 'paid' ? 'success' :
                        salary.paymentStatus === 'processed' ? 'info' : 'default'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleViewPayslip(salary._id)} aria-label={`View payslip for ${salary.userId?.firstName} ${salary.userId?.lastName}`}>
                      Payslip
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Payslip Dialog */}
      <Dialog open={payslipOpen} onClose={() => setPayslipOpen(false)} maxWidth="md" fullWidth aria-label="Payslip details dialog">
        <DialogTitle>Payslip - {selectedPayslip?.employee?.name}</DialogTitle>
        <DialogContent>
          {selectedPayslip && (
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Employee</Typography>
                  <Typography>{selectedPayslip.employee?.name}</Typography>
                  <Typography variant="body2">ID: {selectedPayslip.employee?.employeeId}</Typography>
                  <Typography variant="body2">Dept: {selectedPayslip.employee?.department}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Period</Typography>
                  <Typography>
                    {months[selectedPayslip.period?.month - 1]} {selectedPayslip.period?.year}
                  </Typography>
                </Grid>

                <Grid item xs={12}><hr /></Grid>

                <Grid item xs={6}>
                  <Typography variant="h6">Earnings</Typography>
                  <Typography>Base Salary: ${selectedPayslip.earnings?.baseSalary?.toLocaleString()}</Typography>
                  <Typography>Overtime: ${selectedPayslip.earnings?.overtimeEarnings?.toLocaleString()}</Typography>
                  {selectedPayslip.earnings?.bonuses?.map((b, i) => (
                    <Typography key={i}>{b.description}: ${b.amount?.toLocaleString()}</Typography>
                  ))}
                  <Typography variant="subtitle1" sx={{ mt: 1 }}>
                    Total: ${selectedPayslip.earnings?.totalEarnings?.toLocaleString()}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="h6">Deductions</Typography>
                  <Typography>Fines: ${selectedPayslip.deductions?.fines?.reduce((s, f) => s + f.amount, 0)?.toLocaleString()}</Typography>
                  <Typography>Loan: ${selectedPayslip.deductions?.loanDeductions?.reduce((s, l) => s + l.amount, 0)?.toLocaleString()}</Typography>
                  <Typography>Tax: ${selectedPayslip.deductions?.taxDeductions?.toLocaleString()}</Typography>
                  <Typography variant="subtitle1" sx={{ mt: 1 }}>
                    Total: ${selectedPayslip.deductions?.totalDeductions?.toLocaleString()}
                  </Typography>
                </Grid>

                <Grid item xs={12}><hr /></Grid>

                <Grid item xs={12}>
                  <Typography variant="h5">
                    Net Salary: ${selectedPayslip.netSalary?.toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayslipOpen(false)} aria-label="Close payslip dialog">Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SalaryManagement;
