/**
 * auth.js
 * ----------------
 * Session-scoped admin auth state (sessionStorage, same lifetime as the old
 * hardcoded 'sa_auth' flag — cleared when the tab closes). Now backed by a
 * real JWT issued by POST /api/v1/auth/login instead of a hardcoded check.
 */

const TOKEN_KEY = 'sa_token';
const EXPIRY_KEY = 'sa_token_expiry';
const USER_KEY = 'sa_user';

export function setAuth({ token, expiresAt, username, fullName }) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRY_KEY, expiresAt);
  sessionStorage.setItem(USER_KEY, JSON.stringify({ username, fullName }));
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  const token = getToken();
  const expiry = sessionStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return false;
  return new Date(expiry).getTime() > Date.now();
}
