import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use environment variable for API URL with fallback
const API_BASE_URL = (Platform.OS === 'web'
  ? process.env.REACT_APP_API_URL
  : process.env.API_URL) || 'http://localhost:3000/api';

const REQUEST_TIMEOUT_MS = 30000;

class ApiService {
  constructor() {
    this.token = null;
    this._loadTokenFromStorage();
  }

  async _loadTokenFromStorage() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        this.token = token;
      }
    } catch {
      // Storage not available yet, token will be set on login
    }
  }

  async setToken(token) {
    this.token = token;
    if (token) {
      try {
        await AsyncStorage.setItem('token', token);
      } catch {
        // Storage write failed; token is still in memory
      }
    } else {
      try {
        await AsyncStorage.removeItem('token');
      } catch {
        // Ignore removal failure
      }
    }
  }

  async request(endpoint, options = {}) {
    // Set up AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    // Ensure we have the latest token from storage
    if (!this.token) {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          this.token = storedToken;
        }
      } catch {
        // Proceed without token
      }
    }

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers
      },
      ...options,
      signal: abortController.signal
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Clear stored auth on 401
        this.token = null;
        try {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
        } catch {
          // Ignore cleanup errors
        }
        throw new Error('Your session has expired. Please log in again.');
      }

      if (!response.ok) {
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

      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new Error('Unable to connect to the server. Please check your network connection.');
      }

      // Re-throw our own error messages
      throw error;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    await this.setToken(data.token);
    return data;
  }

  // Attendance
  async getTodayAttendance(userId) {
    return this.request(`/attendance/today/${userId}`);
  }

  async getAttendanceHistory(userId, startDate, endDate) {
    return this.request(`/attendance/report/${userId}?startDate=${startDate}&endDate=${endDate}`);
  }

  // Monthly Summary
  async getMonthlySummary(userId, month, year) {
    return this.request(`/attendance/summary/${userId}?month=${month}&year=${year}`);
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
