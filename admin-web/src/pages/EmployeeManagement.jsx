import React, { useState, useEffect } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Chip, Box, Grid,
  Card, CardContent, CircularProgress, Alert, Snackbar
} from '@mui/material';
import { api } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmployeeManagement = () => {
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
  const [departments, setDepartments] = useState([
    'Engineering', 'HR', 'Finance', 'Operations', 'Marketing', 'Sales'
  ]);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    baseSalary: 0,
    role: 'employee'
  });

  useEffect(() => {
    loadEmployees();
    loadDepartments();
  }, [searchQuery, departmentFilter]);

  const loadDepartments = async () => {
    try {
      const data = await api.getDepartments?.();
      if (data && Array.isArray(data.departments || data)) {
        setDepartments(data.departments || data);
      }
    } catch {
      // Fall back to default departments list
    }
  };

  const loadEmployees = async () => {
    try {
      setError(null);
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (departmentFilter) params.department = departmentFilter;
      const data = await api.getEmployees(params);
      setEmployees(data.employees || data);
    } catch (err) {
      setError('Failed to load employees. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.employeeId.trim()) {
      errors.employeeId = 'Employee ID is required';
    }
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!formData.department) {
      errors.department = 'Department is required';
    }
    if (formData.baseSalary < 0) {
      errors.baseSalary = 'Salary must be 0 or greater';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (selectedEmployee) {
        await api.updateEmployee(selectedEmployee._id, formData);
        showToast('Employee updated successfully', 'success');
      } else {
        await api.createEmployee(formData);
        showToast('Employee created successfully', 'success');
      }
      setDialogOpen(false);
      resetForm();
      loadEmployees();
    } catch (err) {
      showToast('Failed to save employee. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setFormErrors({});
    setFormData({
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone || '',
      department: employee.department,
      designation: employee.designation || '',
      baseSalary: employee.baseSalary || 0,
      role: employee.role
    });
    setDialogOpen(true);
  };

  const handleDelete = async (employeeId) => {
    if (window.confirm('Are you sure you want to deactivate this employee?')) {
      setDeleting(true);
      try {
        await api.deleteEmployee(employeeId);
        showToast('Employee deactivated successfully', 'success');
        loadEmployees();
      } catch (err) {
        showToast('Failed to deactivate employee. Please try again.', 'error');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleFaceRegister = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedEmployee) return;

    setFaceRegistering(true);
    const formDataObj = new FormData();
    formDataObj.append('face', file);

    try {
      await api.registerFace(selectedEmployee._id, formDataObj);
      showToast('Face registered successfully', 'success');
      setFaceDialogOpen(false);
      loadEmployees();
    } catch (err) {
      showToast('Failed to register face. Please try again.', 'error');
    } finally {
      setFaceRegistering(false);
    }
  };

  const resetForm = () => {
    setSelectedEmployee(null);
    setFormErrors({});
    setFormData({
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '',
      designation: '',
      baseSalary: 0,
      role: 'employee'
    });
  };

  const showToast = (message, severity) => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  if (loading && employees.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }} aria-label="Loading employees">
        <CircularProgress aria-label="Loading spinner" />
      </Box>
    );
  }

  return (
    <div aria-label="Employee management page">
      {/* Toast notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Employee Management</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => { resetForm(); setDialogOpen(true); }}
          aria-label="Add new employee"
        >
          Add Employee
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} aria-label="Employee list error">{error}</Alert>
      )}

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }} aria-label="Employee filters">
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search employees by name or ID"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel>Department</InputLabel>
            <Select
              value={departmentFilter}
              label="Department"
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <MenuItem value="">All Departments</MenuItem>
              {departments.map(dept => (
                <MenuItem key={dept} value={dept}>{dept}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Employee Table */}
      <TableContainer component={Paper} aria-label="Employee list table">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell>Face Registered</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee._id}>
                <TableCell>{employee.employeeId}</TableCell>
                <TableCell>{employee.firstName} {employee.lastName}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>{employee.designation}</TableCell>
                <TableCell>
                  <Chip
                    label={employee.faceEmbeddings?.length > 0 ? 'Yes' : 'No'}
                    color={employee.faceEmbeddings?.length > 0 ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={employee.isActive ? 'Active' : 'Inactive'}
                    color={employee.isActive ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleEdit(employee)} aria-label={`Edit ${employee.firstName} ${employee.lastName}`}>Edit</Button>
                  <Button
                    size="small"
                    color="secondary"
                    onClick={() => { setSelectedEmployee(employee); setFaceDialogOpen(true); }}
                    aria-label={`Register face for ${employee.firstName} ${employee.lastName}`}
                  >
                    Register Face
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(employee._id)}
                    disabled={deleting}
                    aria-label={`Deactivate ${employee.firstName} ${employee.lastName}`}
                  >
                    Deactivate
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Employee Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-label={selectedEmployee ? 'Edit employee dialog' : 'Add employee dialog'}
      >
        <DialogTitle>{selectedEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Employee ID"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                disabled={!!selectedEmployee}
                required
                error={!!formErrors.employeeId}
                helperText={formErrors.employeeId}
                aria-label="Employee ID"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                error={!!formErrors.email}
                helperText={formErrors.email}
                aria-label="Employee email"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                error={!!formErrors.firstName}
                helperText={formErrors.firstName}
                aria-label="First name"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                error={!!formErrors.lastName}
                helperText={formErrors.lastName}
                aria-label="Last name"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                aria-label="Phone number"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required error={!!formErrors.department}>
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  label="Department"
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  aria-label="Department"
                >
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
                {formErrors.department && (
                  <Typography variant="caption" color="error" sx={{ ml: 2, mt: 0.5 }}>
                    {formErrors.department}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Designation"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                aria-label="Designation"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Base Salary"
                type="number"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                error={!!formErrors.baseSalary}
                helperText={formErrors.baseSalary}
                inputProps={{ min: 0 }}
                aria-label="Base salary"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  aria-label="Employee role"
                >
                  <MenuItem value="employee">Employee</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="super-admin">Super Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} aria-label="Cancel">Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={saving} aria-label={selectedEmployee ? 'Update employee' : 'Create employee'}>
            {saving ? <CircularProgress size={20} /> : (selectedEmployee ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Face Registration Dialog */}
      <Dialog
        open={faceDialogOpen}
        onClose={() => setFaceDialogOpen(false)}
        aria-label="Face registration dialog"
      >
        <DialogTitle>Register Face - {selectedEmployee?.firstName} {selectedEmployee?.lastName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload a clear photo of the employee's face for recognition.
          </Typography>
          {faceRegistering ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress aria-label="Uploading face image" />
            </Box>
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleFaceRegister}
              aria-label="Upload employee face photo"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFaceDialogOpen(false)} disabled={faceRegistering} aria-label="Cancel face registration">Cancel</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default EmployeeManagement;
