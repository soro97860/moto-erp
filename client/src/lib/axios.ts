import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  // Read from Zustand persisted store (localStorage key: moto-auth)
  try {
    const raw = localStorage.getItem('moto-auth');
    const token = raw ? (JSON.parse(raw) as { state: { token: string | null } }).state?.token : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore parse errors
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('moto-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
