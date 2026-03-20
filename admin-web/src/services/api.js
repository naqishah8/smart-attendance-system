const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const REQUEST_TIMEOUT_MS = 30000;

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    // Set up AbortController for timeout
    const abortController = new AbortController();
    const { signal: externalSignal, ...restOptions } = options;

    // If an external signal is provided, listen to it as well
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => abortController.abort());
    }

    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      },
      ...restOptions,
      signal: abortController.signal
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      clearTimeout(timeoutId);

      // Handle 401 - attempt token refresh
      if (response.status === 401) {
        const refreshed = await this._tryRefreshToken();
        if (refreshed) {
          // Retry the original request with the new token
          const newToken = localStorage.getItem('token');
          config.headers.Authorization = `Bearer ${newToken}`;
          // Create a new abort controller for the retry
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT_MS);
          config.signal = retryController.signal;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
          clearTimeout(retryTimeoutId);
          if (!retryResponse.ok) {
            throw new Error('Request failed after token refresh.');
          }
          return retryResponse.json();
        } else {
          // Refresh failed - clear auth and redirect
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          throw new Error('Your session has expired. Please log in again.');
        }
      }

      if (!response.ok) {
        // Don't expose raw server error messages to users
        const statusCode = response.status;
        if (statusCode >= 500) {
          throw new Error('A server error occurred. Please try again later.');
        } else if (statusCode === 403) {
          throw new Error('You do not have permission to perform this action.');
        } else if (statusCode === 404) {
          throw new Error('The requested resource was not found.');
        } else {
          throw new Error('The request could not be completed. Please try again.');
        }
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('The request timed out. Please check your connection and try again.');
      }

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please check your network connection.');
      }

      // Re-throw our own error messages
      throw error;
    }
  }

  async _tryRefreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Dashboard
  async getDashboardStats(options = {}) {
    return this.request('/dashboard/stats', options);
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

  // Departments
  async getDepartments() {
    return this.request('/departments');
  }

  // Face Registration
  async registerFace(userId, formData) {
    const token = localStorage.getItem('token');

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/employees/${userId}/register-face`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: formData, // FormData for file upload
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Your session has expired. Please log in again.');
        }
        throw new Error('Failed to register face. Please try again.');
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('The upload timed out. Please try again.');
      }
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please check your network connection.');
      }
      throw error;
    }
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
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    return data;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }
}

export const api = new ApiService();
