import { writable } from 'svelte/store';
import { getAuthToken, setAuthToken, clearAuthToken } from '$lib/utils/ws';

export const isAuthenticated = writable(!!getAuthToken());
export const authError = writable<string | null>(null);

export function login(token: string) {
  setAuthToken(token);
  isAuthenticated.set(true);
  authError.set(null);
}

export function logout() {
  clearAuthToken();
  isAuthenticated.set(false);
}

export function skipAuth() {
  clearAuthToken();
  isAuthenticated.set(true);
  authError.set(null);
}

export function handleAuthError() {
  authError.set('Invalid or expired token');
  clearAuthToken();
  isAuthenticated.set(false);
}
