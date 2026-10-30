import api from './axios';

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const register = async ({ name, email, password }) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data;
};

export const login = async ({ email, password }) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const adminLogin = async ({ email, password }) => {
  const response = await api.post('/auth/admin-login', { email, password });
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const adminLogout = async () => {
  const response = await api.post('/auth/admin-logout');
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  return response.data;
};

export const verifyCode = async ({ email, code }) => {
  const response = await api.post('/auth/verify-code', { email, code });
  return response.data;
};

export const resendCode = async (email) => {
  const response = await api.post('/auth/resend-code', { email });
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async ({ token, password }) => {
  const response = await api.post('/auth/reset-password', { token, password });
  return response.data;
};
