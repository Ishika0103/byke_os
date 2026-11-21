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

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
