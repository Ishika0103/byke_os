/** Set by the `authenticate` middleware on every protected request. */
export type AuthContext = {
  userId: string;
  roleId: string;
  /** Hotels the user may see; null = every hotel (Super Admin). Plan 05. */
  hotelIds: string[] | null;
  /** The role's permission names; includes '*' for Super Admin. Plan 06. */
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
