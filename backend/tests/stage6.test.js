const fs = require('fs');
const path = require('path');

const ADMIN_SRC = path.join(__dirname, '../../admin-web/src');

describe('STAGE 6: Admin Web Application', () => {

  describe('Dashboard page', () => {
    const file = path.join(ADMIN_SRC, 'pages/Dashboard.jsx');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('is a valid React component', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain("import React");
      expect(content).toContain('const Dashboard');
      expect(content).toContain('export default Dashboard');
    });

    test('has stats cards (total, present, late, absent)', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Total Employees');
      expect(content).toContain('Present Today');
      expect(content).toContain('Late Today');
      expect(content).toContain('Absent Today');
    });

    test('has live camera feeds section', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Live Camera Feeds');
      expect(content).toContain('liveCameras');
    });

    test('has recent detections table', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Recent Detections');
      expect(content).toContain('recentDetections');
    });

    test('polls for updates every 30 seconds', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('setInterval');
      expect(content).toContain('30000');
    });
  });

  describe('EmployeeManagement page', () => {
    const file = path.join(ADMIN_SRC, 'pages/EmployeeManagement.jsx');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has CRUD operations', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Add Employee');
      expect(content).toContain('handleSubmit');
      expect(content).toContain('handleEdit');
      expect(content).toContain('handleDelete');
    });

    test('has face registration feature', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Register Face');
      expect(content).toContain('handleFaceRegister');
      expect(content).toContain("accept=\"image/*\"");
    });

    test('has search and filter', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('searchQuery');
      expect(content).toContain('departmentFilter');
    });
  });

  describe('AttendanceReport page', () => {
    const file = path.join(ADMIN_SRC, 'pages/AttendanceReport.jsx');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has date range and status filters', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('startDate');
      expect(content).toContain('endDate');
      expect(content).toContain('statusFilter');
    });

    test('has summary cards', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Present');
      expect(content).toContain('Absent');
      expect(content).toContain('Late');
    });
  });

  describe('SalaryManagement page', () => {
    const file = path.join(ADMIN_SRC, 'pages/SalaryManagement.jsx');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has salary processing', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Process All Salaries');
      expect(content).toContain('handleProcessAll');
    });

    test('has payslip viewer', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Payslip');
      expect(content).toContain('handleViewPayslip');
    });
  });

  describe('API Service', () => {
    const file = path.join(ADMIN_SRC, 'services/api.js');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has all API methods', () => {
      const content = fs.readFileSync(file, 'utf8');
      // Auth
      expect(content).toContain('async login(');
      // Employees
      expect(content).toContain('async getEmployees(');
      expect(content).toContain('async createEmployee(');
      expect(content).toContain('async registerFace(');
      // Attendance
      expect(content).toContain('async getAttendance(');
      expect(content).toContain('async getAttendanceReport(');
      // Cameras
      expect(content).toContain('async getCameras(');
      expect(content).toContain('async connectCamera(');
      // Fines
      expect(content).toContain('async getFines(');
      expect(content).toContain('async disputeFine(');
      // Salary
      expect(content).toContain('async getSalaries(');
      expect(content).toContain('async processAllSalaries(');
      expect(content).toContain('async getPayslip(');
      // Loans
      expect(content).toContain('async getLoans(');
      expect(content).toContain('async approveLoan(');
      // Shifts
      expect(content).toContain('async getShifts(');
      expect(content).toContain('async assignShift(');
    });

    test('uses Bearer token auth', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Authorization');
      expect(content).toContain('Bearer');
      expect(content).toContain('localStorage');
    });
  });
});
