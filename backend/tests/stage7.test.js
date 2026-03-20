const fs = require('fs');
const path = require('path');

const MOBILE_SRC = path.join(__dirname, '../../mobile-app/src');

describe('STAGE 7: Mobile Application', () => {

  describe('EmployeeHome screen', () => {
    const file = path.join(MOBILE_SRC, 'screens/EmployeeHome.js');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('is a valid React Native component', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain("from 'react-native'");
      expect(content).toContain('const EmployeeHome');
      expect(content).toContain('export default EmployeeHome');
    });

    test('has attendance card with check-in', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('todayAttendance');
      expect(content).toContain('Check In');
      expect(content).toContain('renderAttendanceCard');
    });

    test('has camera for face capture', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('cameraVisible');
      expect(content).toContain('handleFaceCapture');
      expect(content).toContain('Camera');
    });

    test('uses useRef for camera (not this.camera)', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('useRef');
      expect(content).toContain('cameraRef');
    });

    test('has monthly summary section', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Monthly Summary');
      expect(content).toContain('Present');
      expect(content).toContain('Late');
      expect(content).toContain('Fines');
    });

    test('has proper StyleSheet', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('StyleSheet.create');
      expect(content).toContain('styles.container');
      expect(content).toContain('styles.card');
    });
  });

  describe('SalaryScreen', () => {
    const file = path.join(MOBILE_SRC, 'screens/SalaryScreen.js');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has month navigation', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('selectedMonth');
      expect(content).toContain('selectedYear');
      expect(content).toContain('prevMonth');
      expect(content).toContain('nextMonth');
    });

    test('displays salary breakdown', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Base Salary');
      expect(content).toContain('Overtime');
      expect(content).toContain('Bonuses');
      expect(content).toContain('NET SALARY');
    });

    test('has fines and loan deduction sections', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Fines Breakdown');
      expect(content).toContain('Loan Deductions');
    });

    test('has salary history', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('Salary History');
      expect(content).toContain('salaryHistory');
    });
  });

  describe('Mobile API Service', () => {
    const file = path.join(MOBILE_SRC, 'services/api.js');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has all required methods', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('async login(');
      expect(content).toContain('async getTodayAttendance(');
      expect(content).toContain('async verifyFace(');
      expect(content).toContain('async getMonthlySalary(');
      expect(content).toContain('async getSalaryHistory(');
      expect(content).toContain('async getUserFines(');
      expect(content).toContain('async disputeFine(');
      expect(content).toContain('async getUserLoans(');
      expect(content).toContain('async requestLoan(');
    });
  });

  describe('AuthContext', () => {
    const file = path.join(MOBILE_SRC, 'contexts/AuthContext.js');

    test('file exists', () => {
      expect(fs.existsSync(file)).toBe(true);
    });

    test('has auth provider and hook', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('AuthProvider');
      expect(content).toContain('useAuth');
      expect(content).toContain('createContext');
    });

    test('persists auth with AsyncStorage', () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('AsyncStorage');
      expect(content).toContain('login');
      expect(content).toContain('logout');
    });
  });
});
