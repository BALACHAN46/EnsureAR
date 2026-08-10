/**
 * apiClient.js
 * ----------------
 * One thin wrapper around fetch() for the whole app: attaches the JWT
 * (when present), unwraps the API's { success, message, data, errors }
 * envelope, and throws a normal Error (with .status/.errors attached) on
 * any failure so callers can just try/catch like any other async call.
 */

import axios from 'axios';
import { API_BASE_URL } from './config';
import { getToken, clearAuth } from '../utils/auth';

async function request(path, { method = 'GET', body, isForm = false, auth = true } = {}) {
  const headers = {
    'ngrok-skip-browser-warning': 'true'
  };
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  let tokenAttached = false;
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      tokenAttached = true;
    } else {
      console.warn(`[apiClient] ${method} ${path}: no sa_token in sessionStorage — sending without Authorization header.`);
    }
  }

  try {
    const response = await axios({
      url: `${API_BASE_URL}${path}`,
      method,
      headers,
      data: body,
    });

    const payload = response.data;

    if (payload?.success === false) {
      const error = new Error(payload?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.errors = payload?.errors;
      throw error;
    }

    return payload?.data;
  } catch (error) {
    if (error.response) {
      const { status, data: payload } = error.response;
      
      if (status === 401 && auth) {
        console.warn(`[apiClient] ${method} ${path}: 401 — token was ${tokenAttached ? 'ATTACHED but the server rejected it' : 'NOT attached (missing from sessionStorage)'}.`);
        // Expired/invalid session — drop it so the UI's auth guards redirect to login.
        clearAuth();
      }

      const customError = new Error(payload?.message || `Request failed (${status})`);
      customError.status = status;
      customError.errors = payload?.errors;
      throw customError;
    }
    
    throw error;
  }
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  postForm: (path, formData, options) => request(path, { ...options, method: 'POST', body: formData, isForm: true }),
};
