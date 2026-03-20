const API_BASE_URL = 'http://localhost:3000/api';

class ApiService {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
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

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  // Attendance
  async getTodayAttendance(userId) {
    return this.request(`/attendance/today/${userId}`);
  }

  async getAttendanceHistory(userId, startDate, endDate) {
    return this.request(`/attendance/report/${userId}?startDate=${startDate}&endDate=${endDate}`);
  }

  // Face Verification
  async verifyFace(userId, imageData) {
    return this.request('/attendance/verify-face', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        image: imageData.base64
      })
    });
  }

  // Salary
  async getMonthlySalary(userId, month, year) {
    return this.request(`/salaries/user/${userId}?month=${month}&year=${year}`);
  }

  async getSalaryHistory(userId) {
    return this.request(`/salaries/user/${userId}/history`);
  }

  // Fines
  async getUserFines(userId) {
    return this.request(`/fines/user/${userId}`);
  }

  async disputeFine(fineId, reason) {
    return this.request(`/fines/${fineId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Loans
  async getUserLoans(userId) {
    return this.request(`/loans/user/${userId}`);
  }

  async requestLoan(data) {
    return this.request('/loans/request', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Profile
  async getProfile() {
    return this.request('/auth/profile');
  }

  async updateProfile(data) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

export const api = new ApiService();
