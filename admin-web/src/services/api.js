const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Employees
  async getEmployees(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/employees?${query}`);
  }

  async getEmployee(id) {
    return this.request(`/employees/${id}`);
  }

  async createEmployee(data) {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateEmployee(id, data) {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteEmployee(id) {
    return this.request(`/employees/${id}`, {
      method: 'DELETE'
    });
  }

  // Face Registration
  async registerFace(userId, formData) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/employees/${userId}/register-face`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData // FormData for file upload
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message);
    }

    return response.json();
  }

  // Attendance
  async getAttendance(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/attendance?${query}`);
  }

  async getAttendanceReport(userId, startDate, endDate) {
    return this.request(`/attendance/report/${userId}?startDate=${startDate}&endDate=${endDate}`);
  }

  // Cameras
  async getCameras() {
    return this.request('/cameras');
  }

  async addCamera(data) {
    return this.request('/cameras', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCamera(id, data) {
    return this.request(`/cameras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async connectCamera(id) {
    return this.request(`/cameras/${id}/connect`, { method: 'POST' });
  }

  async disconnectCamera(id) {
    return this.request(`/cameras/${id}/disconnect`, { method: 'POST' });
  }

  // Fines
  async getFines(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/fines?${query}`);
  }

  async getUserFines(userId, startDate, endDate) {
    return this.request(`/fines/user/${userId}?startDate=${startDate}&endDate=${endDate}`);
  }

  async disputeFine(fineId, reason) {
    return this.request(`/fines/${fineId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async resolveFineDispute(fineId, resolution, waive) {
    return this.request(`/fines/${fineId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, waive })
    });
  }

  // Fine Rules
  async getFineRules() {
    return this.request('/fine-rules');
  }

  async createFineRule(data) {
    return this.request('/fine-rules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateFineRule(id, data) {
    return this.request(`/fine-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Salary
  async getSalaries(month, year) {
    return this.request(`/salaries?month=${month}&year=${year}`);
  }

  async calculateSalary(userId, month, year) {
    return this.request('/salaries/calculate', {
      method: 'POST',
      body: JSON.stringify({ userId, month, year })
    });
  }

  async processAllSalaries(month, year) {
    return this.request('/salaries/process-all', {
      method: 'POST',
      body: JSON.stringify({ month, year })
    });
  }

  async getPayslip(salaryId) {
    return this.request(`/salaries/${salaryId}/payslip`);
  }

  // Loans
  async getLoans(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/loans?${query}`);
  }

  async getUserLoans(userId) {
    return this.request(`/loans/user/${userId}`);
  }

  async approveLoan(loanId) {
    return this.request(`/loans/${loanId}/approve`, { method: 'POST' });
  }

  async getLoanReport() {
    return this.request('/loans/report');
  }

  // Shifts
  async getShifts() {
    return this.request('/shifts');
  }

  async createShift(data) {
    return this.request('/shifts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async assignShift(userId, shiftId, effectiveFrom) {
    return this.request('/shifts/assign', {
      method: 'POST',
      body: JSON.stringify({ userId, shiftId, effectiveFrom })
    });
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('token', data.token);
    return data;
  }

  logout() {
    localStorage.removeItem('token');
  }
}

export const api = new ApiService();
