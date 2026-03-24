import React, { useState, useEffect } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, Box, Grid,
  CardContent, CircularProgress, Alert, Avatar, useMediaQuery, useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../services/api';
import { monoFont } from '../theme';
import AnimatedPage from '../components/AnimatedPage';
import GlassCard from '../components/GlassCard';
import AnimatedDialog from '../components/AnimatedDialog';
import AnimatedTableRow from '../components/AnimatedTableRow';
import ToastNotification from '../components/ToastNotification';
import MobileDataList from '../components/MobileDataList';
import { TableSkeleton } from '../components/SkeletonLoader';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmployeeManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [faceRegistering, setFaceRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [departments] = useState([
    'Engineering', 'HR', 'Finance', 'Operations', 'Marketing', 'Sales', 'IT'
  ]);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    employeeId: '', firstName: '', lastName: '', email: '',
    phone: '', department: '', designation: '', baseSalary: 0, role: 'employee'
  });

  useEffect(() => { loadEmployees(); }, [searchQuery, departmentFilter]);

  const loadEmployees = async () => {
    try {
      setError(null); setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (departmentFilter) params.department = departmentFilter;
      const data = await api.getEmployees(params);
      setEmployees(data.employees || data || []);
    } catch {
      setError('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.employeeId.trim()) errors.employeeId = 'Required';
    if (!formData.firstName.trim()) errors.firstName = 'Required';
    if (!formData.lastName.trim()) errors.lastName = 'Required';
    if (!formData.email.trim()) errors.email = 'Required';
    else if (!EMAIL_REGEX.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.department) errors.department = 'Required';
    if (formData.baseSalary < 0) errors.baseSalary = 'Must be positive';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (selectedEmployee) {
        await api.updateEmployee(selectedEmployee._id, formData);
        showToast('Employee updated', 'success');
      } else {
        await api.createEmployee(formData);
        showToast('Employee created', 'success');
      }
      setDialogOpen(false); resetForm(); loadEmployees();
    } catch {
      showToast('Failed to save employee.', 'error');
    } finally { setSaving(false); }
  };

  const handleEdit = (emp) => {
    setSelectedEmployee(emp);
    setFormErrors({});
    setFormData({
      employeeId: emp.employeeId, firstName: emp.firstName, lastName: emp.lastName,
      email: emp.email, phone: emp.phone || '', department: emp.department,
      designation: emp.designation || '', baseSalary: emp.baseSalary || 0, role: emp.role,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this employee?')) return;
    setDeleting(true);
    try {
      await api.deleteEmployee(id);
      showToast('Employee deactivated', 'success');
      loadEmployees();
    } catch {
      showToast('Failed to deactivate.', 'error');
    } finally { setDeleting(false); }
  };

  const handleFaceRegister = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedEmployee) return;
    setFaceRegistering(true);
    const fd = new FormData();
    fd.append('face', file);
    try {
      await api.registerFace(selectedEmployee._id, fd);
      showToast('Face registered', 'success');
      setFaceDialogOpen(false); loadEmployees();
    } catch {
      showToast('Failed to register face.', 'error');
    } finally { setFaceRegistering(false); }
  };

  const resetForm = () => {
    setSelectedEmployee(null); setFormErrors({});
    setFormData({ employeeId: '', firstName: '', lastName: '', email: '',
      phone: '', department: '', designation: '', baseSalary: 0, role: 'employee' });
  };

  const showToast = (message, severity) => setToast({ open: true, message, severity });

  if (loading && employees.length === 0) {
    return <AnimatedPage><TableSkeleton rows={8} cols={7} /></AnimatedPage>;
  }

  return (
    <AnimatedPage>
      <Box>
        <ToastNotification open={toast.open} message={toast.message} severity={toast.severity}
          onClose={() => setToast({ ...toast, open: false })} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: { xs: 2, sm: 4 } }}>
          <Box>
            <Typography variant="h4">Employees</Typography>
            <Typography variant="subtitle1">{employees.length} total employees</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { resetForm(); setDialogOpen(true); }}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
              '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' } }}>
            Add Employee
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Filters */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth placeholder="Search by name or ID..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} size="small"
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: '#8892A8' }} /> }} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select value={departmentFilter} label="Department" onChange={(e) => setDepartmentFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Data View */}
        {isMobile ? (
          <MobileDataList
            items={employees}
            accentColor={(emp) => emp.role === 'admin' ? '#6C63FF' : '#00D9A6'}
            primaryKey={(emp) => `${emp.firstName} ${emp.lastName}`}
            secondaryKey={(emp) => (
              <Chip label={emp.isActive ? 'Active' : 'Inactive'} size="small"
                sx={{ bgcolor: emp.isActive ? 'rgba(0,217,166,0.12)' : 'rgba(255,92,108,0.12)',
                  color: emp.isActive ? '#00D9A6' : '#FF5C6C', height: 20, fontSize: '0.7rem' }} />
            )}
            fields={[
              { label: 'ID', key: 'employeeId' },
              { label: 'Email', key: 'email' },
              { label: 'Dept', key: 'department' },
              { label: 'Role', key: 'role', chip: true },
            ]}
            onItemClick={(emp) => handleEdit(emp)}
            emptyText="No employees found"
          />
        ) : (
          <GlassCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Designation</TableCell>
                    <TableCell>Face</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.map((emp, i) => {
                    const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
                    return (
                      <AnimatedTableRow key={emp._id} index={i}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700,
                              bgcolor: emp.role === 'admin' ? '#6C63FF' : '#00D9A6' }}>
                              {initials}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</Typography>
                              <Typography variant="caption" sx={{ color: '#8892A8' }}>{emp.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontFamily: monoFont, color: '#8892A8', fontSize: '0.8rem' }}>{emp.employeeId}</Typography></TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>{emp.designation || '-'}</TableCell>
                        <TableCell>
                          <Chip label={emp.faceEmbeddings?.length > 0 ? 'Registered' : 'None'} size="small"
                            sx={{
                              bgcolor: emp.faceEmbeddings?.length > 0 ? 'rgba(0,217,166,0.12)' : 'rgba(136,146,168,0.1)',
                              color: emp.faceEmbeddings?.length > 0 ? '#00D9A6' : '#8892A8',
                            }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={emp.isActive ? 'Active' : 'Inactive'} size="small"
                            sx={{
                              bgcolor: emp.isActive ? 'rgba(0,217,166,0.12)' : 'rgba(255,92,108,0.12)',
                              color: emp.isActive ? '#00D9A6' : '#FF5C6C',
                            }} />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Button size="small" onClick={() => handleEdit(emp)}>Edit</Button>
                            <Button size="small" sx={{ color: '#6C63FF' }}
                              onClick={() => { setSelectedEmployee(emp); setFaceDialogOpen(true); }}>
                              Face
                            </Button>
                            <Button size="small" sx={{ color: '#FF5C6C' }} disabled={deleting}
                              onClick={() => handleDelete(emp._id)}>
                              Deactivate
                            </Button>
                          </Box>
                        </TableCell>
                      </AnimatedTableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        )}

        {/* Add/Edit Dialog */}
        <AnimatedDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{selectedEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Employee ID" value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  disabled={!!selectedEmployee} required error={!!formErrors.employeeId} helperText={formErrors.employeeId} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Email" type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required error={!!formErrors.email} helperText={formErrors.email} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="First Name" value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required error={!!formErrors.firstName} helperText={formErrors.firstName} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Last Name" value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required error={!!formErrors.lastName} helperText={formErrors.lastName} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.department}>
                  <InputLabel>Department</InputLabel>
                  <Select value={formData.department} label="Department"
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}>
                    {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Designation" value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Base Salary" type="number" value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                  error={!!formErrors.baseSalary} helperText={formErrors.baseSalary} inputProps={{ min: 0 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select value={formData.role} label="Role"
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    <MenuItem value="employee">Employee</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="super-admin">Super Admin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={saving}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #4A42CC)' }}>
              {saving ? <CircularProgress size={20} color="inherit" /> : (selectedEmployee ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </AnimatedDialog>

        {/* Face Registration Dialog */}
        <AnimatedDialog open={faceDialogOpen} onClose={() => setFaceDialogOpen(false)}>
          <DialogTitle>Register Face - {selectedEmployee?.firstName} {selectedEmployee?.lastName}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2, color: '#8892A8' }}>
              Upload a clear photo of the employee's face for recognition.
            </Typography>
            {faceRegistering ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress /></Box>
            ) : (
              <input type="file" accept="image/*" onChange={handleFaceRegister} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFaceDialogOpen(false)} disabled={faceRegistering}>Cancel</Button>
          </DialogActions>
        </AnimatedDialog>
      </Box>
    </AnimatedPage>
  );
};

export default EmployeeManagement;
