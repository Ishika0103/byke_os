import type {
  AuthTokens,
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  User,
} from '@byke-os/shared';
import { AppError } from '../../utils/app-error';
import { UserModel } from '../users/user.model';
import { assertPasswordNotEmail, userService } from '../users/user.service';
import { hashPlainPassword, simulatePasswordCheck, verifyPassword } from './password';
import { issueTokens, verifyToken } from './tokens';

type LoginUser = { _id: unknown; email: string; isActive: boolean; hashPassword: string };

const invalidCredentials = () => AppError.unauthenticated('Invalid email or password');

export const authService = {
  /** Plan 01a §5.2. Unknown email and wrong password look identical (message and timing). */
  async login({ email, password }: LoginInput): Promise<LoginResponse> {
    const user = await UserModel.findOne({ email })
      .select('+hashPassword email isActive')
      .lean<LoginUser>();

    if (!user) {
      await simulatePasswordCheck(password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(password, user.hashPassword))) throw invalidCredentials();
    // Only revealed after the correct password was given.
    if (!user.isActive) throw AppError.accountDisabled();

    const userId = String(user._id);
    return { ...issueTokens(userId), user: await userService.getById(userId) };
  },

  /** Plan 01a §5.3. Issues a fresh token pair if the user is still active. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const userId = verifyToken(refreshToken, 'refresh');
    const user = await UserModel.findById(userId).select('isActive').lean<{ isActive: boolean }>();
    if (!user) throw AppError.unauthenticated('Invalid or expired token');
    if (!user.isActive) throw AppError.accountDisabled();
    return issueTokens(userId);
  },

  me(userId: string): Promise<User> {
    return userService.getById(userId);
  },

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await UserModel.findById(userId)
      .select('+hashPassword email')
      .lean<{ email: string; hashPassword: string }>();
    if (!user) throw AppError.unauthenticated();

    if (!(await verifyPassword(input.currentPassword, user.hashPassword))) {
      throw AppError.field('currentPassword', 'Current password is incorrect');
    }
    assertPasswordNotEmail(input.newPassword, user.email);

    await UserModel.updateOne(
      { _id: userId },
      { hashPassword: await hashPlainPassword(input.newPassword), updatedBy: userId },
    );
  },
};
