import React, { useState, useEffect } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Grid, Card, CardContent,
  Select, MenuItem, FormControl, InputLabel, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Box
} from '@mui/material';
import { api } from '../services/api';

const SalaryManagement = () => {
  const [salaries, setSalaries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadSalaries();
  }, [selectedMonth, selectedYear]);

  const loadSalaries = async () => {
    try {
      const data = await api.getSalaries(selectedMonth, selectedYear);
      setSalaries(data.salaries || data || []);
    } catch (error) {
      console.error('Failed to load salaries:', error);
    }
  };

  const handleProcessAll = async () => {
    if (!window.confirm(`Process salaries for ${selectedMonth}/${selectedYear}?`)) return;
    setProcessing(true);
    try {
      await api.processAllSalaries(selectedMonth, selectedYear);
      loadSalaries();
    } catch (error) {
      console.error('Failed to process salaries:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleViewPayslip = async (salaryId) => {
    try {
      const payslip = await api.getPayslip(salaryId);
      setSelectedPayslip(payslip);
      setPayslipOpen(true);
    } catch (error) {
      console.error('Failed to load payslip:', error);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Salary Management</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleProcessAll}
          disabled={processing}
        >
          {processing ? 'Processing...' : 'Process All Salaries'}
        </Button>
      </Box>

      {/* Month/Year Selector */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <FormControl fullWidth>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              label="Month"
              onChange={(e) => setSelectedMonth(e.target.value)}
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
            >
              {[2024, 2025, 2026].map(y => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Salary Table */}
      <TableContainer component={Paper}>
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
                  <Button size="small" onClick={() => handleViewPayslip(salary._id)}>
                    Payslip
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Payslip Dialog */}
      <Dialog open={payslipOpen} onClose={() => setPayslipOpen(false)} maxWidth="md" fullWidth>
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
          <Button onClick={() => setPayslipOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SalaryManagement;
