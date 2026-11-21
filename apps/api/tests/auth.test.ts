import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { UserModel } from '../src/modules/users/user.model';
import { PASSWORD, createUser, login, useTestDatabase } from './helpers';

useTestDatabase();

describe('POST /auth/login', () => {
  it('returns tokens and the user, never the password hash', async () => {
    const app = createApp();
    const { email } = await createUser({ name: 'Ravi Kumar', role: 'GM' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      name: 'Ravi Kumar',
      email,
      role: { code: 'GM', name: 'General Manager' },
      isActive: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('hashPassword');
  });

  it('gives the same 401 for an unknown email and a wrong password', async () => {
    const app = createApp();
    const { email } = await createUser();

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPass1' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: 'WrongPass1' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: 'UNAUTHENTICATED',
        message: 'Invalid email or password',
      });
    }
  });

  it('returns 403 ACCOUNT_DISABLED for a deactivated user with the right password', async () => {
    const app = createApp();
    const { email } = await createUser({ isActive: false });
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rejects unknown fields and invalid emails with 400', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'x', isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rate-limits repeated failures for the same email (429 on the 6th)', async () => {
    const app = createApp();
    const { email } = await createUser();
    const attempt = () =>
      request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPass1' });

    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('tokens', () => {
  it('GET /auth/me works with an access token', async () => {
    const app = createApp();
    const { email } = await createUser({ role: 'HO' });
    const { accessToken } = await login(app, email);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email, role: { code: 'HO' } });
  });

  it('a refresh token cannot be used as an access token, and vice versa', async () => {
    const app = createApp();
    const { email } = await createUser();
    const { accessToken, refreshToken } = await login(app, email);

    const meWithRefresh = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`);
    expect(meWithRefresh.status).toBe(401);

    const refreshWithAccess = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: accessToken });
    expect(refreshWithAccess.status).toBe(401);
  });

  it('POST /auth/refresh returns a new working token pair', async () => {
    const app = createApp();
    const { email } = await createUser();
    const { refreshToken } = await login(app, email);

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('rejects tampered tokens', async () => {
    const app = createApp();
    const { email } = await createUser();
    const { accessToken } = await login(app, email);
    const tampered = accessToken.slice(0, -2) + (accessToken.endsWith('a') ? 'bb' : 'aa');

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('blocks a deactivated user immediately, even with unexpired tokens', async () => {
    const app = createApp();
    const { id, email } = await createUser();
    const { accessToken, refreshToken } = await login(app, email);

    await UserModel.updateOne({ _id: id }, { isActive: false });

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe('ACCOUNT_DISABLED');

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(403);
  });

  it('blocks a soft-deleted user immediately', async () => {
    const app = createApp();
    const { id, email } = await createUser();
    const { accessToken } = await login(app, email);

    await UserModel.updateOne({ _id: id }, { isDeleted: true });

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  it('requires the correct current password, then the new one works', async () => {
    const app = createApp();
    const { email } = await createUser();
    const { accessToken } = await login(app, email);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const wrong = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth)
      .send({ currentPassword: 'WrongPass1', newPassword: 'NewPassw0rd' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details.currentPassword).toBeDefined();

    const weak = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const ok = await request(app)
      .post('/api/v1/auth/change-password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPassw0rd' });
    expect(ok.status).toBe(204);

    await expect(login(app, email, 'NewPassw0rd')).resolves.toBeDefined();
    await expect(login(app, email, PASSWORD)).rejects.toThrow();
  });
});
