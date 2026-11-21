/** Set by the `authenticate` middleware on every protected request. */
export type AuthContext = {
  userId: string;
  roleId: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
