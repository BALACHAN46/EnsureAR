import { apiClient } from './apiClient';
import { setAuth, clearAuth } from '../utils/auth';

export async function login(username, password) {
  const result = await apiClient.post('/api/v1/auth/login', { username, password }, { auth: false });
  setAuth(result);
  return result;
}

export async function logout() {
  // Best-effort: clear local session regardless of whether the server call
  // succeeds (e.g. the token may already be invalid/expired, which is fine —
  // the goal here is just to make sure the browser forgets it).
  try {
    await apiClient.post('/api/v1/auth/logout');
  } catch (err) {
    console.warn('Logout API call failed (session was cleared locally anyway).', err);
  } finally {
    clearAuth();
  }
}
