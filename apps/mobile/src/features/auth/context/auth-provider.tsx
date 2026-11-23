import { AppState } from 'react-native';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, User } from '@byke-os/shared';
import { session } from '@/lib/auth/session';
import { authApi } from '../api/auth.api';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the user (role permissions, hotels) so changes by an admin show without signing in again. */
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds who is logged in. On start-up it restores the session from the stored
 * refresh token (Plan 01a flow 4: app reopened).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await session.refresh();
        const me = token ? await authApi.me() : null;
        if (cancelled) return;
        setUser(me);
        setStatus(me ? 'signedIn' : 'signedOut');
      } catch {
        // Offline or API down: show the login screen but keep the stored token.
        if (!cancelled) setStatus('signedOut');
      }
    })();

    // Session ended elsewhere (refresh failed, logout) → back to login.
    const unsubscribe = session.onEnd(() => {
      setUser(null);
      setStatus('signedOut');
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await authApi.login(input);
    await session.start(res);
    setUser(res.user);
    setStatus('signedIn');
  }, []);

  const logout = useCallback(() => session.end(), []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch {
      // Offline or signed out meanwhile: keep what we have.
    }
  }, []);

  // Coming back to the app: pick up permission changes made by an admin.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshUser();
    });
    return () => sub.remove();
  }, [status, refreshUser]);

  const value = useMemo(
    () => ({ status, user, login, logout, refreshUser }),
    [status, user, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
