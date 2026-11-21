import { useContext } from 'react';
import { AuthContext } from '../context/auth-provider';

/** Current user, auth status, login() and logout(). Must be used inside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
