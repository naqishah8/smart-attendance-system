import React, { useState, useEffect } from 'react';
import {
  Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Chip, Box, Grid,
  Card, CardContent
} from '@mui/material';
import { api } from '../services/api';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
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
  }, [searchQuery, departmentFilter]);

  const loadEmployees = async () => {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (departmentFilter) params.department = departmentFilter;
      const data = await api.getEmployees(params);
      setEmployees(data.employees || data);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      if (selectedEmployee) {
        await api.updateEmployee(selectedEmployee._id, formData);
      } else {
        await api.createEmployee(formData);
      }
      setDialogOpen(false);
      resetForm();
      loadEmployees();
    } catch (error) {
      console.error('Failed to save employee:', error);
    }
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
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
      try {
        await api.deleteEmployee(employeeId);
        loadEmployees();
      } catch (error) {
        console.error('Failed to delete employee:', error);
      }
    }
  };

  const handleFaceRegister = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedEmployee) return;

    const formData = new FormData();
    formData.append('face', file);

    try {
      await api.registerFace(selectedEmployee._id, formData);
      setFaceDialogOpen(false);
      loadEmployees();
    } catch (error) {
      console.error('Failed to register face:', error);
    }
  };

  const resetForm = () => {
    setSelectedEmployee(null);
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

  const departments = ['Engineering', 'HR', 'Finance', 'Operations', 'Marketing', 'Sales'];

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Employee Management</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => { resetForm(); setDialogOpen(true); }}
        >
          Add Employee
        </Button>
      </Box>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel>Department</InputLabel>
            <Select
              value={departmentFilter}
              label="Department"
              onChange={(e) => setDepartmentFilter(e.target.value)}
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
      <TableContainer component={Paper}>
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
                  <Button size="small" onClick={() => handleEdit(employee)}>Edit</Button>
                  <Button
                    size="small"
                    color="secondary"
                    onClick={() => { setSelectedEmployee(employee); setFaceDialogOpen(true); }}
                  >
                    Register Face
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(employee._id)}
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department}
                  label="Department"
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Designation"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Base Salary"
                type="number"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {selectedEmployee ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Face Registration Dialog */}
      <Dialog open={faceDialogOpen} onClose={() => setFaceDialogOpen(false)}>
        <DialogTitle>Register Face - {selectedEmployee?.firstName} {selectedEmployee?.lastName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Upload a clear photo of the employee's face for recognition.
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleFaceRegister}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFaceDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default EmployeeManagement;
